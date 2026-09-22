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
 * Multi-page PDFs are treated as picture books even if a text layer exists,
 * so generate still uses page 1 / N-1 as the main artwork.
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
    const pictureBook = pages >= 2;

    if (pictureBook || !(text && signal >= TEXT_LAYER_MIN_SIGNAL)) {
      return NextResponse.json({
        text: "",
        pages,
        extractedChars: signal,
        mode: "needs_vision",
        needsVision: true,
        pictureBook,
        tip: pictureBook
          ? "这份是卡通绘本。生成时会用第 1 页和倒数第二页当主图，去掉商标二维码，把角色汇成一张歌绘～"
          : "这份绘本的字印在图上。生成时会看最后一页歌词和角色页，再合成一张歌绘～",
      });
    }

    return NextResponse.json({
      text,
      pages,
      extractedChars: signal,
      mode: "text",
      needsVision: false,
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
