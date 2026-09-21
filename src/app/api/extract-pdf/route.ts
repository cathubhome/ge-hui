import { NextRequest, NextResponse } from "next/server";
import {
  TEXT_LAYER_MIN_SIGNAL,
  contentSignal,
  usableLyricsText,
} from "@/lib/pdf-text";
import { extractPdfTextLayer } from "@/lib/pdf-text-layer";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Light PDF path only: text-layer extract OR detect needsVision.
 * Never calls Gemini / vision here — heavy work waits for Generate (job).
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "请先选择一个 PDF 文件哦～" },
        { status: 400 },
      );
    }
    if (
      !file.name.toLowerCase().endsWith(".pdf") &&
      file.type !== "application/pdf"
    ) {
      return NextResponse.json(
        { error: "这一步只支持 PDF，音频请直接上传音频文件～" },
        { status: 400 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = await extractPdfTextLayer(bytes);
    const pages = parsed.pages || 0;
    const text = usableLyricsText((parsed.text || "").trim());
    const signal = contentSignal(text);

    if (text && signal >= TEXT_LAYER_MIN_SIGNAL) {
      return NextResponse.json({
        text,
        pages,
        extractedChars: signal,
        mode: "text",
        needsVision: false,
      });
    }

    return NextResponse.json({
      text: "",
      pages,
      extractedChars: signal,
      mode: "needs_vision",
      needsVision: true,
      tip: "这份 PDF 字印在图上。文件已留在浏览器，点「生成歌绘本」时再帮你看图读词～",
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "这份 PDF 有点调皮，没读成功。换一份带可选文字的，或直接粘贴歌词吧～",
        code: "pdf_parse_failed",
      },
      { status: 500 },
    );
  }
}
