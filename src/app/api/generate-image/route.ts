import { NextRequest, NextResponse } from "next/server";
import { cpaFetch, getCpaApiKey, imageModel as defaultImageModel } from "@/lib/cpa";
import { buildPictureBookSvg, svgToDataUrl } from "@/lib/render-picturebook";
import type { ScenePlan } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const plan = body.plan as ScenePlan;
    const mode = (body.mode as string) || process.env.DEFAULT_IMAGE_MODE || "canvas";
    const selectedImageModel = String(body.imageModel || "").trim() || defaultImageModel();

    if (!plan?.panels?.length) {
      return NextResponse.json({ error: "缺少场景规划 plan" }, { status: 400 });
    }

    if (mode === "openai-image" || mode === "cpa-image") {
      if (!getCpaApiKey()) {
        return NextResponse.json(
          { error: "AI 出图需要 CPA_API_KEY；或改用本地矢量绘本页" },
          { status: 400 },
        );
      }
      try {
        const imageBase64 = await generateWithCpa(plan, selectedImageModel);
        return NextResponse.json({
          imageDataUrl: `data:image/png;base64,${imageBase64}`,
          mode: "cpa-image",
          model: selectedImageModel,
        });
      } catch (err) {
        // fallback to local svg
        const svg = buildPictureBookSvg(plan);
        return NextResponse.json({
          imageDataUrl: svgToDataUrl(svg),
          svg,
          mode: "canvas-fallback",
          warning: err instanceof Error ? err.message : "CPA 出图失败，已回退本地矢量",
        });
      }
    }

    const svg = buildPictureBookSvg(plan);
    return NextResponse.json({
      imageDataUrl: svgToDataUrl(svg),
      svg,
      mode: "canvas",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "出图失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function generateWithCpa(plan: ScenePlan, model = defaultImageModel()): Promise<string> {
  const panelDesc = plan.panels
    .map((p, i) => `${i + 1}. ${p.labelEn}/${p.labelZh}: ${p.action}`)
    .join("; ");

  const prompt = `Children's educational picture-book page, flat vector paper-cut collage style.
Soft pastel rolling hills background (blue, yellow, teal).
Top-left bold title "${plan.titleEn}" and Chinese "${plan.titleZh}".
Left white rounded lyrics card "SING & MOVE" with short lyrics.
Main area: 2x4 grid of 8 colorful circles (orange, pink, purple, teal) each with THE SAME friendly orange-skinned child character in different poses: ${panelDesc}.
Bilingual labels above each circle. High contrast, kawaii, not photorealistic, no watermark.`;

  const res = await cpaFetch("/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      size: "1536x1024",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CPA 出图失败: ${res.status} ${text}`);
  }

  const data = await res.json();
  const b64 = data.data?.[0]?.b64_json;
  if (b64) return b64;
  const url = data.data?.[0]?.url;
  if (url) {
    const imgRes = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      },
    });
    if (!imgRes.ok) throw new Error("下载 CPA 图片失败");
    const ab = await imgRes.arrayBuffer();
    return Buffer.from(ab).toString("base64");
  }
  throw new Error("CPA 未返回图片数据");
}
