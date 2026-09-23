import { NextRequest, NextResponse } from "next/server";
import { promises as fs, createReadStream } from "node:fs";
import { getAudioFile } from "@/lib/audio-store";
import { Readable } from "node:stream";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "无效的音频编号" }, { status: 400 });
  }

  const audio = await getAudioFile(id);
  if (!audio) {
    return NextResponse.json({ error: "音频文件不存在或已过期" }, { status: 404 });
  }

  const range = req.headers.get("range");
  const fileSize = audio.size;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;

    const stream = createReadStream(audio.filePath, { start, end });
    const webStream = Readable.toWeb(stream) as ReadableStream;

    return new Response(webStream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunksize),
        "Content-Type": audio.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  const fileBuf = await fs.readFile(audio.filePath);
  return new Response(fileBuf, {
    status: 200,
    headers: {
      "Content-Type": audio.contentType,
      "Content-Length": String(fileSize),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}