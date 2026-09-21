import { cpaFetch, getCpaApiKey, chatModels } from "@/lib/cpa";
import { rasterizePdfPages } from "@/lib/pdf-rasterize";
import { contentSignal } from "@/lib/pdf-text";

export type VisionExtract = {
  text: string;
  characterDescription: string;
  styleNotes?: string;
  titleHint?: string;
  referenceImageDataUrls: string[];
};

function parseVisionJson(raw: string): Omit<VisionExtract, "referenceImageDataUrls"> | null {
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
): Promise<Omit<VisionExtract, "referenceImageDataUrls">> {
  if (!getCpaApiKey()) {
    throw new Error(
      "这份 PDF 是图文绘本，需要看图读词。请先在服务器配置密钥，或把歌词粘贴到下面～",
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

/** Heavy vision path — only call from job runner after Generate. */
export async function visionExtractPdf(
  pdfBytes: Uint8Array | Buffer,
  chatModel?: string,
): Promise<VisionExtract> {
  const rasters = await rasterizePdfPages(
    pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes),
    { maxPages: 8, maxEdge: 960 },
  );
  if (!rasters.length) {
    throw new Error("这份 PDF 没有可读页面。请把歌词粘贴到下面试试～");
  }
  const vision = await visionExtractFromPages(
    rasters.map((r) => r.dataUrl),
    chatModel,
  );
  const referenceImageDataUrls = rasters
    .slice(0, Math.min(2, rasters.length))
    .map((r) => r.dataUrl);
  return { ...vision, referenceImageDataUrls };
}
