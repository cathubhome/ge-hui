import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "请上传 PDF 文件" }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      return NextResponse.json({ error: "仅支持 PDF" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: buf });
    try {
      const parsed = await parser.getText();
      const text = (parsed.text || "").trim();
      if (!text) {
        return NextResponse.json({ error: "未能从 PDF 提取到文字" }, { status: 422 });
      }
      return NextResponse.json({ text, pages: parsed.total });
    } finally {
      await parser.destroy();
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "PDF 解析失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
