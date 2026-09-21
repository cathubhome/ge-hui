import { NextRequest, NextResponse } from "next/server";
import { cpaChatCompletion, transcribeModel } from "@/lib/cpa";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "请上传音频文件" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.byteLength > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "音频请小于 20MB" }, { status: 400 });
    }

    const ext = (file.name.split(".").pop() || "wav").toLowerCase();
    const format = ["wav", "mp3", "m4a", "ogg", "flac", "webm"].includes(ext) ? ext : "wav";
    const b64 = buf.toString("base64");
    const model = String(form.get("model") || "").trim() || transcribeModel();

    const { data, model: usedModel } = await cpaChatCompletion(
      {
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "请把这段音频转写成歌词或唱词文字。只输出转写正文，不要解释。若几乎听不清，输出空字符串。",
              },
              {
                type: "input_audio",
                input_audio: { data: b64, format },
              },
            ],
          },
        ],
        max_tokens: 2048,
        temperature: 0.2,
      },
      [model],
    );

    const text = String(data?.choices?.[0]?.message?.content || "").trim();
    if (!text) {
      return NextResponse.json(
        { error: "这次没听清楚歌词，可以粘贴文字或换一段更清晰的音频再试～" },
        { status: 422 },
      );
    }
    return NextResponse.json({ text, model: usedModel, engine: "cpa-gemini-multimodal" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "转写失败";
    const status = message.includes("CPA_API_KEY") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
