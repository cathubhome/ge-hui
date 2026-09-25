import { NextRequest, NextResponse } from "next/server";
import { cpaFetch, getCpaApiKey, imageModel as defaultImageModel, chatModels } from "@/lib/cpa";
import type { ScenePlan, UserPreference } from "@/lib/types";
import { CUTE_ERRORS } from "@/lib/model-options";
import { isInternalRequest } from "@/lib/internal-api";

export const runtime = "nodejs";
export const maxDuration = 180;

type GenBody = {
  plan?: ScenePlan;
  imageModel?: string;
  characterDescription?: string;
  referenceImageDataUrls?: string[];
  userPreference?: UserPreference;
};

export async function POST(req: NextRequest) {
  if (!isInternalRequest(req)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = (await req.json()) as GenBody;
    const plan = body.plan as ScenePlan;
    const selectedImageModel =
      String(body.imageModel || "").trim() || defaultImageModel();
    const characterDescription = String(
      body.characterDescription || plan?.characterDescription || "",
    ).trim();
    const referenceImageDataUrls = Array.isArray(body.referenceImageDataUrls)
      ? body.referenceImageDataUrls
          .filter((u) => typeof u === "string" && u.startsWith("data:image"))
          .slice(0, 2)
      : [];

    const isSpread =
      referenceImageDataUrls.length > 0 || plan?.layout === "spread";
    if (!plan || (!isSpread && !plan.panels?.length)) {
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

    const generated = await generateWithCpa(
      plan,
      selectedImageModel,
      characterDescription,
      referenceImageDataUrls,
      body.userPreference,
    );
    return NextResponse.json({
      imageDataUrl: `data:image/png;base64,${generated.b64}`,
      mode: "ai",
      model: selectedImageModel,
      usedReferences: generated.usedReferences,
      drawMode: generated.drawMode,
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

function panelLine(plan: ScenePlan): string {
  return (plan.panels || [])
    .slice(0, 8)
    .map(
      (p, i) =>
        `${i + 1}) label "${p.labelEn}" / "${p.labelZh}", action: ${p.action}`,
    )
    .join("; ");
}

function dataUrlToB64(u: string): string {
  return u.replace(/^data:image\/\w+;base64,/, "");
}

function buildUserOverrides(pref?: UserPreference): string {
  if (!pref) return "";
  const lines: string[] = [];
  if (pref.roleScope === "solo") {
    lines.push("ROLE OVERRIDE: Focus strictly on the single main hero character. Do NOT crowd the page with secondary animals or kids.");
  } else if (pref.roleScope === "all") {
    lines.push("ROLE OVERRIDE: Must assemble ALL characters and friends from the book together into a lively, warm group scene (小伙伴都在).");
  }

  if (pref.artStyle === "crayon") {
    lines.push("TEXTURE OVERRIDE: Render with charming wax-crayon and colored-pencil textures on soft grain paper, naive picture-book art style.");
  } else if (pref.artStyle === "clay") {
    lines.push("TEXTURE OVERRIDE: 3D paper-cut collage or soft clay-sculpture tactile texture, soft gentle lighting.");
  }

  if (pref.customPrompt?.trim()) {
    const safe = pref.customPrompt.trim().slice(0, 80).replace(/["\n\r]/g, " ");
    lines.push(`USER WISH: "${safe}" (incorporate seamlessly while keeping character designs intact).`);
  }
  return lines.length ? `\nUSER CUSTOM PREFERENCES:\n${lines.join("\n")}` : "";
}

function buildMergePrompt(
  plan: ScenePlan,
  characterDescription: string,
  pref?: UserPreference,
): string {
  const cast = (plan.cast || []).filter(Boolean).join(", ");
  const scene = String(plan.sceneLayout || "").trim();
  const charLine = [
    characterDescription
      ? `Characters from the book: ${characterDescription}`
      : "Keep every cartoon character from the first reference image.",
    cast ? `Cast that must all appear: ${cast}.` : "",
    scene ? `Composition to keep: ${scene}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const userReq = buildUserOverrides(pref);

  return `EDIT the first attached image. It is the MAIN picture-book spread (PDF page N-1).

Produce ONE landscape children's book spread (not a poster, not a worksheet).

KEEP:
- The same open double-page composition (characters sharing one sky/ground, speech bubbles OK)
- ALL cartoon characters from the reference — gather every animal/person onto this page
- Same art tone: flat vector, simple shapes, same palette and line weight
- Original English dialogue/lyrics (do not rewrite):
${(plan.lyricExcerpt || "").slice(0, 360)}

REMOVE:
- logos, trademarks, brand names (PLAYTIME etc.), websites, QR codes, page numbers, publisher badges

ADD once (not in a grid): title "${plan.titleEn}" / "${plan.titleZh}"

HARD FORBIDDEN:
- 8-grid, 2x4, 4x2, numbered cells 1-8, circular frames, worksheet, exercise cards
- Head Shoulders layout, 8 poses of a single mascot
- replacing book characters with a different cute rooster/child
- adult teaching instructions, lesson plans, parent tips, or "引导语" on the artwork (do NOT draw any lightbulb banner or instructional text like "引导孩子们观察...")

${charLine}${userReq}`;
}

function buildPrompt(
  plan: ScenePlan,
  characterDescription: string,
  pref?: UserPreference,
): string {
  const userReq = buildUserOverrides(pref);
  const charLine = characterDescription
    ? `THE SAME character in ALL panels must match this description (critical): ${characterDescription}.`
    : "THE SAME cute simple child character in all panels, only poses change.";

  return `Create ONE educational children's picture-book PAGE (not a random art poster).

Layout can vary with the song (comic strip, big hero + lyric card, or 2x4 circles only if it is a body-part rhyme).
- Landscape page, child-friendly, high contrast, bilingual labels.
- Title "${plan.titleEn}" / "${plan.titleZh}".
- A lyrics card with the song lyrics.
- ${charLine}
- Panels: ${panelLine(plan)}
- Do NOT default to Head Shoulders Knees & Toes worksheet look unless the lyrics are that song.
- NO adult teaching instructions, lesson plans, parent tips, or "引导语" on the artwork (keep the picture book clean and kid-friendly).
- NO photorealism, NO watermarks, NO social-media logos.

Lyric excerpt:
${(plan.lyricExcerpt || "").slice(0, 220)}${userReq}`;
}

async function generateWithCpa(
  plan: ScenePlan,
  model: string,
  characterDescription: string,
  referenceImageDataUrls: string[],
  pref?: UserPreference,
): Promise<{ b64: string; usedReferences: number; drawMode: string }> {
  const hasRefs = referenceImageDataUrls.length > 0;
  const useSpread = hasRefs || plan.layout === "spread";
  const prompt = useSpread
    ? buildMergePrompt(plan, characterDescription, pref)
    : buildPrompt(plan, characterDescription, pref);

  // 1. 如果选择的是 Gemini 多模态原生出图模型（如 gemini-3.1-flash-image）
  if (/gemini/i.test(model)) {
    try {
      const b64 = await generateWithGeminiChat(
        prompt,
        model,
        referenceImageDataUrls,
      );
      if (b64) {
        return {
          b64,
          usedReferences: referenceImageDataUrls.length,
          drawMode: hasRefs ? "gemini-ref-spread" : "gemini-direct",
        };
      }
    } catch {
      // 若单次生图请求偶发超时，继续尝试备用通道
    }
  }

  if (hasRefs) {
    try {
      const b64 = await generateWithReferences(
        prompt,
        model,
        referenceImageDataUrls,
      );
      if (b64) {
        return {
          b64,
          usedReferences: referenceImageDataUrls.length,
          drawMode: "edit",
        };
      }
    } catch {
      // try chat-edit next
    }

    try {
      const b64 = await generateWithChatEdit(prompt, referenceImageDataUrls);
      if (b64) {
        return {
          b64,
          usedReferences: referenceImageDataUrls.length,
          drawMode: "chat-edit",
        };
      }
    } catch {
      // last resort: keep the N-1 spread rather than invent an 8-grid
    }

    return {
      b64: dataUrlToB64(referenceImageDataUrls[0]),
      usedReferences: referenceImageDataUrls.length,
      drawMode: "reference-spread",
    };
  }

  const b64 = await callImageApi("/images/generations", {
    model,
    prompt,
    size: "1536x1024",
  });
  if (b64) return { b64, usedReferences: 0, drawMode: "text" };
  throw new Error("绘图服务忙不过来，请稍后再试～");
}

async function generateWithGeminiChat(
  prompt: string,
  model: string,
  refs: string[],
): Promise<string> {
  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: `${prompt}\n\nPlease generate and output a colorful, clean, high-resolution children's picture book spread illustration as an image directly. Do not describe it in text.`,
    },
  ];
  for (const url of refs) {
    content.push({ type: "image_url", image_url: { url } });
  }

  const res = await cpaFetch("/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini 出图响应异常: ${errText.slice(0, 100)}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  const b64 = readChatImage(data);
  if (!b64) {
    throw new Error("Gemini 未返回有效的图片数据");
  }
  return b64;
}

async function generateWithReferences(
  prompt: string,
  model: string,
  refs: string[],
): Promise<string> {
  const primary = refs[0];
  const extra = refs[1];
  const raws = refs.map((u) => dataUrlToB64(u));
  const models = Array.from(new Set([model, "gpt-image-2", "gpt-image-1.5"].filter(Boolean)));

  for (const m of models) {
    try {
      const form = new FormData();
      form.set("model", m);
      form.set("prompt", prompt);
      form.set("size", "1536x1024");
      form.append(
        "image",
        new Blob([new Uint8Array(Buffer.from(raws[0], "base64"))], {
          type: "image/png",
        }),
        "spread.png",
      );
      const b64 = await callImageApiForm("/images/edits", form);
      if (b64) return b64;
    } catch {
      // next
    }
  }

  const payloads: Array<Record<string, unknown>> = [];
  for (const m of models) {
    payloads.push({ model: m, prompt, size: "1536x1024", image: primary });
    payloads.push({
      model: m,
      prompt,
      size: "1536x1024",
      images: extra ? [primary, extra] : [primary],
    });
    payloads.push({
      model: m,
      prompt,
      size: "1536x1024",
      input_images: extra ? [primary, extra] : [primary],
    });
  }
  for (const body of payloads) {
    try {
      const b64 = await callImageApi("/images/generations", body);
      if (b64) return b64;
    } catch {
      // next payload
    }
  }
  throw new Error("skip:ref");
}

async function generateWithChatEdit(
  prompt: string,
  refs: string[],
): Promise<string> {
  const model =
    chatModels().find((id) => id.toLowerCase().includes("gemini")) ||
    chatModels()[0];
  if (!model) throw new Error("skip:chat");

  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: `${prompt}\n\nGenerate the edited landscape picture as an image. Do not describe it in words.`,
    },
  ];
  for (const url of refs) {
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
    throw new Error("skip:chat");
  }
  const data = (await res.json()) as Record<string, unknown>;
  const b64 = readChatImage(data);
  if (!b64) throw new Error("skip:chat");
  return b64;
}

function readChatImage(data: Record<string, unknown>): string | null {
  const choices = data.choices as Array<{ message?: Record<string, unknown> }> | undefined;
  const msg = choices?.[0]?.message;
  if (msg) {
    const content = msg.content;
    if (typeof content === "string") {
      const m = /data:image\/\w+;base64,([A-Za-z0-9+/=]+)/.exec(content);
      if (m) return m[1];
    }
    if (Array.isArray(content)) {
      for (const part of content as Array<Record<string, unknown>>) {
        const inline = part.inline_data as { data?: string } | undefined;
        if (inline?.data) return inline.data;
        const img = part.image_url as { url?: string } | undefined;
        if (img?.url?.startsWith("data:")) return dataUrlToB64(img.url);
        if (typeof part.b64_json === "string") return part.b64_json;
      }
    }
    const images = msg.images as Array<{ image_url?: { url?: string }; b64_json?: string }> | undefined;
    if (images?.[0]?.b64_json) return images[0].b64_json;
    if (images?.[0]?.image_url?.url?.startsWith("data:")) {
      return dataUrlToB64(images[0].image_url.url);
    }
  }
  const rows = data.data as Array<{ b64_json?: string; url?: string }> | undefined;
  if (rows?.[0]?.b64_json) return rows[0].b64_json;
  return null;
}

async function callImageApiForm(path: string, form: FormData): Promise<string> {
  const res = await cpaFetch(path, { method: "POST", body: form });
  return readImageResponse(res);
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
  return readImageResponse(res);
}

async function readImageResponse(res: Response): Promise<string> {
  if (!res.ok) {
    const t = await res.text().catch(() => "");
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
