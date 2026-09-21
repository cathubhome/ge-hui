import { NextRequest, NextResponse } from "next/server";
import { requireOpenAIKey } from "@/lib/openai";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const apiKey = requireOpenAIKey();
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "请上传音频文件" }, { status: 400 });
    }

    const upstream = new FormData();
    upstream.append("file", file, file.name || "audio.mp3");
    upstream.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1");
    upstream.append("response_format", "text");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `转写失败: ${res.status} ${text}` },
        { status: 502 },
      );
    }

    const text = (await res.text()).trim();
    if (!text) {
      return NextResponse.json({ error: "转写结果为空" }, { status: 422 });
    }
    return NextResponse.json({ text });
  } catch (e) {
    const message = e instanceof Error ? e.message : "转写失败";
    const status = message.includes("OPENAI_API_KEY") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
