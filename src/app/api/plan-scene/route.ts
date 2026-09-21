import { NextRequest, NextResponse } from "next/server";
import { cpaFetch, getCpaApiKey, chatModels } from "@/lib/cpa";
import { planSceneLocal } from "@/lib/plan-scene-local";
import type { ScenePlan } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 90;

function normalizePlan(
  parsed: ScenePlan,
  characterDescription?: string,
  pictureBook?: boolean,
): ScenePlan {
  const isPictureBook = Boolean(characterDescription?.trim() || pictureBook);
  if (isPictureBook) {
    parsed.layout = "spread";
    parsed.panels = Array.isArray(parsed.panels) ? parsed.panels.slice(0, 4) : [];
    if (characterDescription?.trim()) {
      parsed.characterDescription = characterDescription.trim();
    }
    if (Array.isArray(parsed.cast)) {
      parsed.cast = parsed.cast.map((c) => String(c).trim()).filter(Boolean).slice(0, 8);
    }
    return parsed;
  }

  if (!parsed.panels || parsed.panels.length < 4) {
    const local = planSceneLocal(parsed.lyricExcerpt || parsed.titleEn || "song");
    parsed = {
      ...local,
      ...parsed,
      panels: parsed.panels?.length ? parsed.panels : local.panels,
    };
  }
  while (parsed.panels.length < 8) {
    parsed.panels.push({
      labelEn: `SCENE ${parsed.panels.length + 1}`,
      labelZh: `场景 ${parsed.panels.length + 1}`,
      action: "开心挥手",
    });
  }
  parsed.panels = parsed.panels.slice(0, 8);
  parsed.layout = parsed.layout || "grid";
  return parsed;
}

export async function POST(req: NextRequest) {
  let lyrics = "";
  let songTitle = "";
  let characterDescription = "";
  let pictureBook = false;
  let selectedChat = chatModels()[0] || "gemini-3.8-flash-high";

  try {
    const body = await req.json();
    lyrics = String(body.lyrics || "").trim();
    songTitle = String(body.songTitle || "").trim();
    characterDescription = String(body.characterDescription || "").trim();
    pictureBook = Boolean(body.pictureBook);
    selectedChat =
      String(body.chatModel || "").trim() || selectedChat;

    if (!lyrics) {
      return NextResponse.json({ error: "请提供歌词内容" }, { status: 400 });
    }

    if (!getCpaApiKey()) {
      const plan = normalizePlan(planSceneLocal(lyrics), characterDescription, pictureBook);
      if (songTitle) plan.titleEn = songTitle;
      return NextResponse.json({ plan, source: "local" });
    }

    const plan = await planWithCpa(
      lyrics,
      songTitle,
      characterDescription,
      selectedChat,
      pictureBook,
    );
    return NextResponse.json({ plan, source: "cpa" });
  } catch {
    if (lyrics) {
      const plan = normalizePlan(planSceneLocal(lyrics), characterDescription, pictureBook);
      if (songTitle) plan.titleEn = songTitle;
      return NextResponse.json({ plan, source: "local-fallback" });
    }
    return NextResponse.json(
      { error: "画面构思有点卡壳，请再试一次～" },
      { status: 500 },
    );
  }
}

async function planWithCpa(
  lyrics: string,
  songTitle: string,
  characterDescription: string,
  model: string,
  pictureBook: boolean,
): Promise<ScenePlan> {
  const isBook = Boolean(characterDescription || pictureBook);
  const charHint = isBook
    ? `\n这是已有绘本合页：layout 必须是 spread。把书里出现的卡通角色全部写进 cast 和 characterDescription，不要只留一个。禁止八宫格、禁止 8 个动作格、禁止 Head Shoulders 练习纸。panels 最多 4 条对白/互动，可以为空。角色外观：${characterDescription || "见参考图"}`
    : "\n若歌词未指定角色，使用同一位可爱的卡通小朋友。不要把每首歌都画成 Head Shoulders 练习纸，除非歌词就是这首。";

  const res = await cpaFetch("/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `你是儿童教育绘本编剧。根据歌词输出 JSON：titleEn, titleZh, lyricExcerpt, instructionZh, characterDescription, layout, cast, sceneLayout, panels(每项含 labelEn,labelZh,action)。
无绘本参考时 panels 可以为 8；有绘本合页时 layout=spread，panels 0-4 条即可，禁止八宫格。
${songTitle ? `歌名提示：${songTitle}` : ""}${charHint}`,
        },
        { role: "user", content: lyrics.slice(0, 4000) },
      ],
    }),
  });

  if (!res.ok) {
    await res.text().catch(() => "");
    const fallback = planSceneLocal(lyrics);
    if (songTitle) fallback.titleEn = songTitle;
    return normalizePlan(fallback, characterDescription, pictureBook);
  }

  const data = await res.json();
  const content = String(data.choices?.[0]?.message?.content || "").trim();
  const cleaned = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  let parsed: ScenePlan;
  try {
    parsed = JSON.parse(cleaned) as ScenePlan;
  } catch {
    parsed = planSceneLocal(lyrics);
  }
  if (songTitle) parsed.titleEn = parsed.titleEn || songTitle;
  return normalizePlan(
    parsed,
    characterDescription || parsed.characterDescription,
    pictureBook,
  );
}
