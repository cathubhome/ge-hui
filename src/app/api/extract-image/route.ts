import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { cpaFetch, getCpaApiKey, chatModels } from "@/lib/cpa";
import { saveUploadRefs } from "@/lib/job-store";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Handle 1 to 3 uploaded picture-book photos/screenshots.
 * Downscales to 720px JPEG, saves references for AI drawing,
 * and calls Gemini multimodal vision to extract lyrics and character design.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const files: File[] = [];

    for (const [, value] of form.entries()) {
      if (
        value instanceof File &&
        (value.type.startsWith("image/") ||
          /\.(jpe?g|png|webp)$/i.test(value.name))
      ) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "请至少上传一张绘本图片或照片哦～" },
        { status: 400 },
      );
    }

    // Limit to at most 3 images, max 20MB each
    const slice = files.slice(0, 3);
    for (const f of slice) {
      if (f.size > 20 * 1024 * 1024) {
        return NextResponse.json(
          { error: `图片 ${f.name} 大小超过 20MB，请压缩后再试～` },
          { status: 400 },
        );
      }
    }

    const processed: Array<{ buf: Buffer; dataUrl: string }> = [];
    for (const f of slice) {
      const rawBuf = Buffer.from(await f.arrayBuffer());
      const img = await loadImage(rawBuf);
      const maxEdge = 720;
      const edge = Math.max(img.width, img.height);
      const scale = edge > maxEdge ? maxEdge / edge : 1;
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = createCanvas(w, h);
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      const jpeg = canvas.toBuffer("image/jpeg", 82);
      processed.push({
        buf: jpeg,
        dataUrl: "data:image/jpeg;base64," + jpeg.toString("base64"),
      });
    }

    const uploadId = randomUUID();
    await saveUploadRefs(
      uploadId,
      processed.map((p) => p.buf),
    );

    let text = "";
    let titleHint = "";
    let characterDescription = "";
    let cast: string[] = [];

    if (getCpaApiKey()) {
      const prompt = `你是儿童英语启蒙绘本助手。用户上传了 ${processed.length} 张绘本照片或原画插画（手机拍摄或原画截图）。

请仔细看图并提炼：
1) text：图片中能看清的英文歌词、唱词或故事句子（按行分段提取）。若图中无歌词文字（仅为纯角色插画），text 留空。
2) titleHint：如果图片中有歌名、书名或封面大字，提取歌名；若无则留空。
3) characterDescription：英文，必须详细描述图片中出现的卡通角色外观（物种、年龄感、肤色或毛色、发型/羽毛、服装色彩与款式、标志性道具与神态），以便后续 AI 绘图时严格继承同一个角色设计。
4) cast：字符串数组，列出所有识别出的卡通角色名称。
5) styleNotes：原画风格关键词（如 2D flat vector, soft watercolor, crayon texture 等）。

注意：
- 手机拍照可能有反光、手指、边缘倾斜或阴影，请在分析时完全忽略这些拍摄杂质，只关注插画原本的角色和文字。
- 只输出 JSON 对象，不要 markdown。字段：text, titleHint, characterDescription, cast, styleNotes。`;

      const content: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      > = [{ type: "text", text: prompt }];

      for (let i = 0; i < processed.length; i++) {
        content.push({ type: "text", text: `[绘本参考照片 ${i + 1}]` });
        content.push({
          type: "image_url",
          image_url: { url: processed[i].dataUrl },
        });
      }

      try {
        const model =
          chatModels().find((id) => id.toLowerCase().includes("gemini")) ||
          chatModels()[0] ||
          "gemini-3.8-flash-high";

        const res = await cpaFetch("/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            temperature: 0.2,
            messages: [{ role: "user", content }],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const raw = String(data?.choices?.[0]?.message?.content || "").trim();
          const cleaned = raw
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();
          const parsed = JSON.parse(cleaned);
          text = String(parsed.text || parsed.lyrics || "").trim();
          titleHint = String(parsed.titleHint || parsed.title || "").trim();
          characterDescription = String(
            parsed.characterDescription || "",
          ).trim();
          if (Array.isArray(parsed.cast)) {
            cast = parsed.cast.map(String).filter(Boolean).slice(0, 10);
          }
          if (parsed.styleNotes && characterDescription) {
            characterDescription = `${characterDescription}. Art style: ${parsed.styleNotes}`;
          }
        }
      } catch {
        // Vision call error is non-fatal; references are still saved
      }
    }

    return NextResponse.json({
      uploadId,
      text,
      titleHint: titleHint || undefined,
      characterDescription: characterDescription || undefined,
      cast: cast.length ? cast : undefined,
      imageCount: processed.length,
      mode: "images",
      tip: `✨ 已识别 ${processed.length} 张绘本照片！已锁定角色人设，可直接点「生成歌绘本」制作专属跨页～`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "图片读取失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}