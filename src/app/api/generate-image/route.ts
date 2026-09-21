import { NextRequest, NextResponse } from "next/server";
import { getOpenAIKey } from "@/lib/openai";
import { buildPictureBookSvg, svgToDataUrl } from "@/lib/render-picturebook";
import type { ScenePlan } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const plan = body.plan as ScenePlan;
    const mode = (body.mode as string) || "canvas";

    if (!plan?.panels?.length) {
      return NextResponse.json({ error: "缺少场景规划 plan" }, { status: 400 });
    }

    if (mode === "openai-image") {
      const key = getOpenAIKey();
      if (!key) {
        return NextResponse.json(
          { error: "openai-image 模式需要 OPENAI_API_KEY" },
          { status: 400 },
        );
      }
      const imageBase64 = await generateWithOpenAI(plan, key);
      return NextResponse.json({
        imageDataUrl: `data:image/png;base64,${imageBase64}`,
        mode: "openai-image",
      });
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

async function generateWithOpenAI(plan: ScenePlan, apiKey: string): Promise<string> {
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  const panelDesc = plan.panels
    .map((p, i) => `${i + 1}. ${p.labelEn}/${p.labelZh}: ${p.action}`)
    .join("; ");

  const prompt = `Children's educational picture-book page, flat vector paper-cut collage style.
Soft pastel rolling hills background (blue, yellow, teal).
Top-left bold title "${plan.titleEn}" and Chinese "${plan.titleZh}".
Left white rounded lyrics card "SING & MOVE" with short lyrics.
Main area: 2x4 grid of 8 colorful circles (orange, pink, purple, teal) each with THE SAME friendly orange-skinned child character in different poses: ${panelDesc}.
Bilingual labels above each circle. High contrast, kawaii, not photorealistic, no watermark, no Xiaohongshu logo.`;

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      size: "1536x1024",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI 出图失败: ${res.status} ${text}`);
  }

  const data = await res.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("OpenAI 未返回图片数据");
  }
  return b64;
}
