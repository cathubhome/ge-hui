import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";

/** Strip pdf-parse page banners and collapse whitespace. */
function usableLyricsText(raw: string): string {
  return raw
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, " ")
    .replace(/\f/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Count letters / CJK that look like real lyric content. */
function contentSignal(text: string): number {
  const m = text.match(/[A-Za-z\u4e00-\u9fff]/g);
  return m ? m.length : 0;
}

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
    try {
      const parsed = await parser.getText();
      const raw = (parsed.text || "").trim();
      const text = usableLyricsText(raw);
      const signal = contentSignal(text);

      // Image-only / scanned picture books: almost no extractable text layer.
      // This path does NOT call AI — intercept early with a friendly tip.
      if (!text || signal < 24) {
        return NextResponse.json(
          {
            error:
              "这份 PDF 更像图文绘本（字印在图上），目前读不出可复制的歌词。请把歌词粘贴到下面，或改用音频上传听写～",
            code: "pdf_image_only",
            pages: parsed.total,
            extractedChars: signal,
          },
          { status: 422 },
        );
      }

      return NextResponse.json({
        text,
        pages: parsed.total,
        extractedChars: signal,
      });
    } finally {
      await parser.destroy();
    }
  } catch {
    return NextResponse.json(
      {
        error: "这份 PDF 有点调皮，没读成功。换一份带可选文字的，或直接粘贴歌词吧～",
        code: "pdf_parse_failed",
      },
      { status: 500 },
    );
  }
}
