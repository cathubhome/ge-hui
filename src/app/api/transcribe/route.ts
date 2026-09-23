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
    const format = ["wav", "mp3", "m4a", "ogg", "flac", "webm", "aac"].includes(ext) ? ext : "wav";
    const b64 = buf.toString("base64");
    const model = String(form.get("model") || "").trim() || transcribeModel();

    const promptText = `请转写这段音频的歌词，并识别标准歌名。只输出严格的 JSON 对象（不要 markdown 格式）：
{
  "title": "识别出的标准歌曲名（英文或中文，若无法辨别歌名留空）",
  "lyrics": "完整的歌词正文（按歌词分行，不要多余闲聊解释）"
}
若无法识别任何歌声，lyrics 留空字符串。`;

    const { data, model: usedModel } = await cpaChatCompletion(
      {
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: promptText,
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

    const raw = String(data?.choices?.[0]?.message?.content || "").trim();
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let text = "";
    let titleHint = "";
    try {
      const parsed = JSON.parse(cleaned);
      text = String(parsed.lyrics || parsed.text || "").trim();
      titleHint = String(parsed.title || parsed.songTitle || "").trim();
    } catch {
      text = raw;
    }

    if (!text) {
      return NextResponse.json(
        { error: "这次没听清楚歌词，可以粘贴文字或换一段更清晰的音频再试～" },
        { status: 422 },
      );
    }
    return NextResponse.json({
      text,
      titleHint: titleHint || undefined,
      model: usedModel,
      engine: "cpa-gemini-multimodal",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "转写失败";
    const status = message.includes("CPA_API_KEY") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
