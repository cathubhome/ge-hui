import { NextRequest, NextResponse } from "next/server";
import { cpaChatCompletion, getCpaApiKey, chatModels, resolveChatModels } from "@/lib/cpa";
import { planSceneLocal } from "@/lib/plan-scene-local";
import type { ScenePlan } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const lyrics = String(body.lyrics || "").trim();
    const chatModel = String(body.chatModel || "").trim();
    const chatFallbackModel = String(body.chatFallbackModel || "").trim();
    const models = resolveChatModels(chatModel, chatFallbackModel);
    if (!lyrics) {
      return NextResponse.json({ error: "请提供歌词内容" }, { status: 400 });
    }

    if (!getCpaApiKey()) {
      return NextResponse.json({ plan: planSceneLocal(lyrics), source: "local", models: [] });
    }

    try {
      const plan = await planWithCpa(lyrics, models);
      return NextResponse.json({
        plan,
        source: "cpa",
        models,
      });
    } catch (err) {
      return NextResponse.json({
        plan: planSceneLocal(lyrics),
        source: "local-fallback",
        warning: err instanceof Error ? err.message : "CPA 规划失败，已用本地规则",
        models,
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "场景规划失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function planWithCpa(lyrics: string, models = chatModels()): Promise<ScenePlan> {
  const { data } = await cpaChatCompletion(
    {
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "你是儿童教育绘本编剧。根据歌词输出 JSON：titleEn, titleZh, lyricExcerpt, instructionZh, panels(长度必须为8，每项含 labelEn,labelZh,action)。风格类似 Head Shoulders Knees & Toes：同一角色多姿态、双语标注、适合童趣分格页。只输出 JSON。",
        },
        { role: "user", content: lyrics.slice(0, 4000) },
      ],
    },
    models,
  );

  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("CPA 未返回内容");
  const parsed = JSON.parse(content) as ScenePlan;
  if (!parsed.panels || parsed.panels.length < 4) {
    return planSceneLocal(lyrics);
  }
  while (parsed.panels.length < 8) {
    parsed.panels.push({
      labelEn: `SCENE ${parsed.panels.length + 1}`,
      labelZh: `场景 ${parsed.panels.length + 1}`,
      action: "开心挥手",
    });
  }
  parsed.panels = parsed.panels.slice(0, 8);
  return parsed;
}
