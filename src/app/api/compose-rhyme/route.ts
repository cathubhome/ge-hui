import { NextRequest, NextResponse } from "next/server";
import { cpaChatCompletion, chatModels } from "@/lib/cpa";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const topic = String(body.topic || "").trim();

    if (!topic) {
      return NextResponse.json({ error: "请提供想要创作的儿歌主题～" }, { status: 400 });
    }

    const systemPrompt = `你是中国顶级儿童文学与幼儿启蒙童谣作家。
根据用户输入的主题或生活习惯，写一首适合 2~4 岁幼儿的极其简单、朗朗上口、节奏欢快的启蒙童谣（中英双语皆可，默认根据用户语言自动匹配）。
严格要求：
1. 篇幅 4~6 行，句子短小，句句押韵，适合反复跟读拍手唱；
2. 绝对不能有成人说教词汇，充满童趣画面感；
3. 输出严格的 JSON 格式：
{
  "title": "歌名（简短童趣）",
  "lyrics": "分行童谣正文"
}`;

    const { data } = await cpaChatCompletion(
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `请以这个主题创作儿歌：${topic}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      },
      chatModels()
    );

    const raw = String(data?.choices?.[0]?.message?.content || "").trim();
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
    let parsed: { title?: string; lyrics?: string };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "童谣创作灵感卡壳了，请再试一次～" }, { status: 500 });
    }

    if (!parsed.lyrics) {
      return NextResponse.json({ error: "童谣创作未生成内容，请重试～" }, { status: 500 });
    }

    return NextResponse.json({
      title: parsed.title || topic,
      lyrics: parsed.lyrics,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "创作童谣失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
