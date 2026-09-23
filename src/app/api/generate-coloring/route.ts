import { NextRequest, NextResponse } from "next/server";
import { cpaFetch, getCpaApiKey, imageModel as defaultImageModel } from "@/lib/cpa";

export const runtime = "nodejs";
export const maxDuration = 120;

const COLORING_PROMPT = `Convert this children's book illustration into a clean BLACK AND WHITE coloring page for 3-6 year old children.

STRICT RULES:
- ONLY pure black outlines on pure white background
- Main character outlines: 3-4px thick bold lines
- Interior detail lines (eyes, mouth, clothing patterns): 1.5-2px
- NO gray shading, NO gradients, NO fills, NO halftones
- NO text, NO letters, NO words anywhere in the image
- Simplify background to minimal outline elements (simple cloud outlines, grass line, etc.)
- Keep ALL character designs and poses identical to the original
- Create 15-25 closed colorable regions (not too many, not too few)
- Characters should be enlarged to fill 60-70% of the frame
- Line art style similar to a professional children's coloring book
- Pure white background (#FFFFFF), pure black lines (#000000)`;

type GenBody = {
  imageDataUrl: string;
  imageModel?: string;
};

function dataUrlToBase64(url: string): string {
  return url.replace(/^data:image\/\w+;base64,/, "");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenBody;
    const { imageDataUrl } = body;

    if (!imageDataUrl || !imageDataUrl.startsWith("data:image")) {
      return NextResponse.json({ error: "请先生成绘本图片" }, { status: 400 });
    }

    if (!getCpaApiKey()) {
      return NextResponse.json(
        { error: "未配置 API Key，无法生成涂色卡", fallbackToCanvas: true },
        { status: 400 },
      );
    }

    const selectedModel = String(body.imageModel || "").trim() || defaultImageModel();
    const b64 = dataUrlToBase64(imageDataUrl);

    // 1. Try edits form-data
    try {
      const form = new FormData();
      form.set("model", selectedModel);
      form.set("prompt", COLORING_PROMPT);
      form.set("size", "1536x1024");
      form.append(
        "image",
        new Blob([new Uint8Array(Buffer.from(b64, "base64"))], { type: "image/png" }),
        "source.png",
      );
      const res = await cpaFetch("/images/edits", { method: "POST", body: form });
      if (res.ok) {
        const data = await res.json();
        const out = data.data?.[0]?.b64_json;
        if (out) {
          return NextResponse.json({ coloringDataUrl: `data:image/png;base64,${out}`, method: "ai" });
        }
        const url = data.data?.[0]?.url;
        if (url) {
          const imgRes = await fetch(url);
          if (imgRes.ok) {
            const ab = await imgRes.arrayBuffer();
            return NextResponse.json({
              coloringDataUrl: `data:image/png;base64,${Buffer.from(ab).toString("base64")}`,
              method: "ai",
            });
          }
        }
      }
    } catch {}

    // 2. Try generations inline image
    try {
      const res = await cpaFetch("/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          prompt: COLORING_PROMPT,
          size: "1536x1024",
          image: `data:image/png;base64,${b64}`,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const out = data.data?.[0]?.b64_json;
        if (out) {
          return NextResponse.json({ coloringDataUrl: `data:image/png;base64,${out}`, method: "ai" });
        }
        const url = data.data?.[0]?.url;
        if (url) {
          const imgRes = await fetch(url);
          if (imgRes.ok) {
            const ab = await imgRes.arrayBuffer();
            return NextResponse.json({
              coloringDataUrl: `data:image/png;base64,${Buffer.from(ab).toString("base64")}`,
              method: "ai",
            });
          }
        }
      }
    } catch {}

    return NextResponse.json(
      { error: "AI 线稿生成未响应，正在为您自动切换到本地极速线稿提取...", fallbackToCanvas: true },
      { status: 502 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "涂色卡生成失败";
    return NextResponse.json({ error: msg, fallbackToCanvas: true }, { status: 500 });
  }
}
