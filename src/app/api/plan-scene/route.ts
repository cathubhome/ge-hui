import { NextRequest, NextResponse } from "next/server";
import { getOpenAIKey } from "@/lib/openai";
import { planSceneLocal } from "@/lib/plan-scene-local";
import type { ScenePlan } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const lyrics = String(body.lyrics || "").trim();
    if (!lyrics) {
      return NextResponse.json({ error: "请提供歌词内容" }, { status: 400 });
    }

    const key = getOpenAIKey();
    if (!key) {
      return NextResponse.json({
        plan: planSceneLocal(lyrics),
        source: "local",
      });
    }

    const plan = await planWithOpenAI(lyrics, key);
    return NextResponse.json({ plan, source: "openai" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "场景规划失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function planWithOpenAI(lyrics: string, apiKey: string): Promise<ScenePlan> {
  const model = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "你是儿童教育绘本编剧。根据歌词输出 JSON：titleEn, titleZh, lyricExcerpt, instructionZh, panels(长度必须为8，每项含 labelEn,labelZh,action)。风格类似 Head Shoulders Knees & Toes：同一角色多姿态、双语标注、适合童趣分格页。",
        },
        { role: "user", content: lyrics.slice(0, 4000) },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI 场景规划失败: ${res.status} ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
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
