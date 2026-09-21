import { NextRequest, NextResponse } from "next/server";
import { cpaFetch, getCpaApiKey, imageModel as defaultImageModel } from "@/lib/cpa";
import type { ScenePlan } from "@/lib/types";
import { CUTE_ERRORS } from "@/lib/model-options";

export const runtime = "nodejs";
export const maxDuration = 180;

type GenBody = {
  plan?: ScenePlan;
  imageModel?: string;
  characterDescription?: string;
  referenceImageDataUrls?: string[];
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenBody;
    const plan = body.plan as ScenePlan;
    const selectedImageModel =
      String(body.imageModel || "").trim() || defaultImageModel();
    const characterDescription = String(
      body.characterDescription || plan?.characterDescription || "",
    ).trim();
    const referenceImageDataUrls = Array.isArray(body.referenceImageDataUrls)
      ? body.referenceImageDataUrls.filter(
          (u) => typeof u === "string" && u.startsWith("data:image"),
        ).slice(0, 2)
      : [];

    if (!plan?.panels?.length) {
      return NextResponse.json({ error: "缺少场景规划" }, { status: 400 });
    }
    if (!getCpaApiKey()) {
      return NextResponse.json(
        {
          error:
            "还没配置绘图服务密钥，请先在服务器环境变量里设置 CPA_API_KEY 哦～",
        },
        { status: 400 },
      );
    }
    if (/gemini/i.test(selectedImageModel) && /image/i.test(selectedImageModel)) {
      return NextResponse.json(
        {
          error:
            "这个画师暂时不能用，请在小设置里换推荐的出图模型再试～",
        },
        { status: 400 },
      );
    }

    const imageBase64 = await generateWithCpa(
      plan,
      selectedImageModel,
      characterDescription,
      referenceImageDataUrls,
    );
    return NextResponse.json({
      imageDataUrl: `data:image/png;base64,${imageBase64}`,
      mode: "ai",
      model: selectedImageModel,
      usedReferences: referenceImageDataUrls.length,
    });
  } catch (e) {
    const cute =
      CUTE_ERRORS[Math.floor(Math.random() * CUTE_ERRORS.length)] ||
      "小画家刚才走神了，我们再试一次好不好？";
    const detail = e instanceof Error ? e.message : "";
    return NextResponse.json(
      { error: detail && !detail.includes("fetch") ? detail : cute },
      { status: 500 },
    );
  }
}

function buildPrompt(
  plan: ScenePlan,
  characterDescription: string,
): string {
  const panelDesc = plan.panels
    .slice(0, 8)
    .map(
      (p, i) =>
        `${i + 1}) label "${p.labelEn}" / "${p.labelZh}", action: ${p.action}`,
    )
    .join("; ");

  const charLine = characterDescription
    ? `THE SAME character in ALL 8 circles must match this description (critical): ${characterDescription}.`
    : "THE SAME cute simple child character in all 8 circles, only poses change.";

  return `Create ONE educational children's picture-book PAGE (not a random art poster).

MUST match this exact layout:
- Landscape page, clean flat vector / paper-cut collage style, soft pastel rolling hills background (light blue, yellow, teal).
- Top-left: bold English title "${plan.titleEn}" and Chinese subtitle "${plan.titleZh}".
- Left side: rounded white card titled "SING & MOVE" with short lyric excerpt and instruction "${plan.instructionZh}".
- Main area: STRICT 2 rows x 4 columns = 8 colorful circular frames (orange, pink, purple, teal alternating).
- ${charLine}
- Above each circle: bilingual labels. Panels: ${panelDesc}.
- Educational nursery-rhyme worksheet look (like Head Shoulders Knees & Toes), high contrast, kawaii, friendly.
- NO photorealism, NO cinematic portrait, NO single hero in a forest/meadow filling the page, NO watermarks, NO social-media logos, NO extra slogan stickers cluttering the page.

Lyric excerpt for the card (short):
${(plan.lyricExcerpt || "").slice(0, 220)}`;
}

async function generateWithCpa(
  plan: ScenePlan,
  model: string,
  characterDescription: string,
  referenceImageDataUrls: string[],
): Promise<string> {
  const prompt = buildPrompt(plan, characterDescription);

  // Try reference-aware payloads first (gateway-dependent), then plain generations.
  const attempts: Array<{ path: string; body: Record<string, unknown> }> = [];

  if (referenceImageDataUrls.length) {
    const refs = referenceImageDataUrls.map((u) =>
      u.replace(/^data:image\/\w+;base64,/, ""),
    );
    attempts.push({
      path: "/images/generations",
      body: {
        model,
        prompt,
        size: "1536x1024",
        // Common OpenAI-compatible reference field names
        image: referenceImageDataUrls[0],
        images: referenceImageDataUrls,
        input_images: referenceImageDataUrls,
        reference_images: referenceImageDataUrls,
      },
    });
    attempts.push({
      path: "/images/edits",
      body: {
        model,
        prompt,
        size: "1536x1024",
        image: refs[0],
        images: refs,
      },
    });
  }

  attempts.push({
    path: "/images/generations",
    body: {
      model,
      prompt,
      size: "1536x1024",
    },
  });

  let lastErr = "绘图服务忙不过来，请稍后再试～";
  for (const attempt of attempts) {
    try {
      const b64 = await callImageApi(attempt.path, attempt.body);
      if (b64) return b64;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : lastErr;
    }
  }
  throw new Error(lastErr);
}

async function callImageApi(
  path: string,
  body: Record<string, unknown>,
): Promise<string> {
  const res = await cpaFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    // Unknown field / not supported — let caller try next strategy
    if (
      res.status === 400 ||
      res.status === 404 ||
      res.status === 422 ||
      /unknown|invalid|not support|unexpected/i.test(t)
    ) {
      throw new Error(`skip:${res.status}`);
    }
    throw new Error("绘图服务忙不过来，请稍后再试～");
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
    if (!imgRes.ok) throw new Error("图片下载失败，请再试一次");
    const ab = await imgRes.arrayBuffer();
    return Buffer.from(ab).toString("base64");
  }
  throw new Error("没有拿到图片，请再试一次");
}
