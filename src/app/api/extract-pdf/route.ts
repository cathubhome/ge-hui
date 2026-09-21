import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { cpaFetch, getCpaApiKey, chatModels } from "@/lib/cpa";
import { rasterizePdfPages } from "@/lib/pdf-rasterize";
import { rasterizeViaScript } from "@/lib/pdf-rasterize-script";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Strip pdf-parse page banners and collapse whitespace. */
function usableLyricsText(raw: string): string {
  return raw
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, " ")
    .replace(/\f/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Count letters / CJK that look like real lyric content. */
function contentSignal(text: string): number {
  const m = text.match(/[A-Za-z\u4e00-\u9fff]/g);
  return m ? m.length : 0;
}

type VisionExtract = {
  text: string;
  characterDescription: string;
  styleNotes?: string;
  titleHint?: string;
};

function parseVisionJson(raw: string): VisionExtract | null {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    const obj = JSON.parse(cleaned) as Record<string, unknown>;
    const text = String(obj.text || obj.lyrics || obj.story || "").trim();
    const characterDescription = String(
      obj.characterDescription || obj.character || obj.mainCharacter || "",
    ).trim();
    if (!text || contentSignal(text) < 12) return null;
    return {
      text,
      characterDescription:
        characterDescription ||
        "a cute friendly cartoon character from a children's picture book",
      styleNotes: String(obj.styleNotes || obj.style || "").trim() || undefined,
      titleHint: String(obj.titleHint || obj.title || "").trim() || undefined,
    };
  } catch {
    return null;
  }
}

async function visionExtractFromPages(
  dataUrls: string[],
  chatModel?: string,
): Promise<VisionExtract> {
  if (!getCpaApiKey()) {
    throw new Error(
      "这份 PDF 是图文绘本，需要看图读词。请先在服务器配置 CPA_API_KEY，或把歌词粘贴到下面～",
    );
  }

  const model =
    String(chatModel || "").trim() ||
    chatModels().find((id) => id.toLowerCase().includes("gemini")) ||
    chatModels()[0] ||
    "gemini-3.8-flash-high";

  const prompt = `你是儿童英语启蒙绘本助手。下面是绘本 PDF 每一页的截图（按页序）。
请仔细看图，提取：
1) text：可见的歌词 / 故事正文（尽量保留原文语言与分行，去掉页码装饰）
2) characterDescription：英文，详细描述主角色外观（物种/年龄感、肤色或毛色、发型/羽毛、服装颜色与款式、标志性道具），以便后续 AI 画「同一个角色」
3) styleNotes：画面风格关键词（flat vector / watercolor / collage 等）
4) titleHint：如果封面有歌名就写上

只输出 JSON 对象，不要 markdown。字段：text, characterDescription, styleNotes, titleHint。`;

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [{ type: "text", text: prompt }];

  for (const url of dataUrls.slice(0, 8)) {
    content.push({ type: "image_url", image_url: { url } });
  }

  const res = await cpaFetch("/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    await res.text().catch(() => "");
    throw new Error("看图读词时服务有点忙，请稍后再试，或直接粘贴歌词～");
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = String(data.choices?.[0]?.message?.content || "").trim();
  const parsed = parseVisionJson(raw);
  if (!parsed) {
    throw new Error(
      "看见图了，但没读清歌词。请把歌词粘贴到下面，我们也能画～",
    );
  }
  if (parsed.styleNotes) {
    parsed.characterDescription = `${parsed.characterDescription}. Art style: ${parsed.styleNotes}`;
  }
  return parsed;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const chatModel = String(form.get("chatModel") || form.get("model") || "");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "请先选择一个 PDF 文件哦～" },
        { status: 400 },
      );
    }
    if (
      !file.name.toLowerCase().endsWith(".pdf") &&
      file.type !== "application/pdf"
    ) {
      return NextResponse.json(
        { error: "这一步只支持 PDF，音频请直接上传音频文件～" },
        { status: 400 },
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: buf });
    let pages = 0;
    let text = "";
    let signal = 0;

    try {
      const parsed = await parser.getText();
      pages = parsed.total || 0;
      const raw = (parsed.text || "").trim();
      text = usableLyricsText(raw);
      signal = contentSignal(text);
    } finally {
      await parser.destroy().catch(() => undefined);
    }

    // Fast path: real text layer
    if (text && signal >= 24) {
      return NextResponse.json({
        text,
        pages,
        extractedChars: signal,
        mode: "text",
      });
    }

    // Vision path: image-only / scanned picture books
    let rasters;
    try {
      try {
        rasters = await rasterizeViaScript(new Uint8Array(buf));
      } catch (scriptErr) {
        console.error("[extract-pdf] script rasterize failed", scriptErr);
        rasters = await rasterizePdfPages(new Uint8Array(buf), {
          maxPages: 8,
          maxEdge: 960,
        });
      }
    } catch (rasterErr) {
      const detail = rasterErr instanceof Error ? rasterErr.message : String(rasterErr);
      console.error("[extract-pdf] rasterize failed", detail);
      return NextResponse.json(
        {
          error:
            "这份 PDF 更像图文绘本，翻页成图片时没成功。请把歌词粘贴到下面，或换一份带可选文字的 PDF～",
          code: "pdf_rasterize_failed",
            detail,
          pages,
          extractedChars: signal,
        },
        { status: 422 },
      );
    }

    if (!rasters.length) {
      return NextResponse.json(
        {
          error:
            "这份 PDF 没有可读页面。请把歌词粘贴到下面试试～",
          code: "pdf_empty",
          pages,
        },
        { status: 422 },
      );
    }

    const vision = await visionExtractFromPages(
      rasters.map((r) => r.dataUrl),
      chatModel,
    );

    // Keep 1–2 reference pages (prefer page 1 cover/character).
    const referenceImageDataUrls = rasters
      .slice(0, Math.min(2, rasters.length))
      .map((r) => r.dataUrl);

    return NextResponse.json({
      text: vision.text,
      pages: pages || rasters.length,
      extractedChars: contentSignal(vision.text),
      mode: "vision",
      characterDescription: vision.characterDescription,
      titleHint: vision.titleHint,
      referenceImageDataUrls,
    });
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : "这份 PDF 有点调皮，没读成功。换一份带可选文字的，或直接粘贴歌词吧～";
    const isCute = /CPA_API_KEY|粘贴|忙|读清|看图/.test(message);
    return NextResponse.json(
      {
        error: isCute
          ? message
          : "这份 PDF 有点调皮，没读成功。换一份带可选文字的，或直接粘贴歌词吧～",
        code: "pdf_parse_failed",
      },
      { status: isCute ? 422 : 500 },
    );
  }
}
