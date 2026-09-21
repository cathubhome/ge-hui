import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import {
  TEXT_LAYER_MIN_SIGNAL,
  contentSignal,
  usableLyricsText,
} from "@/lib/pdf-text";

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

    const buf = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: buf });
    let pages = 0;
    let text = "";
    let signal = 0;

    try {
      const parsed = await parser.getText();
      pages = parsed.total || 0;
      const raw = (parsed.text || "").trim();
      text = usableLyricsText(raw);
      signal = contentSignal(text);
    } finally {
      await parser.destroy().catch(() => undefined);
    }

    if (text && signal >= TEXT_LAYER_MIN_SIGNAL) {
      return NextResponse.json({
        text,
        pages,
        extractedChars: signal,
        mode: "text",
        needsVision: false,
      });
    }

    // Image-only / low-signal: detect only — keep PDF on client for Generate.
    return NextResponse.json({
      text: "",
      pages,
      extractedChars: signal,
      mode: "needs_vision",
      needsVision: true,
      tip: "这份 PDF 的字印在图上。文件先留在你这边，点「生成歌绘本」时再帮你看图读词～",
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
