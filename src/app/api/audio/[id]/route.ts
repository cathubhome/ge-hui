import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getAudioFile, getAudioMeta } from "@/lib/audio-store";
import { SAMPLE_BOOKS } from "@/lib/sample-books";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "无效的音频编号" }, { status: 400 });
  }

  // 0. Handle Official Sample Book Audios (e.g. sample-head-shoulders, sample-two-tigers)
  const officialSample = SAMPLE_BOOKS.find((s) => s.id === id);
  if (officialSample && officialSample.sampleAudio) {
    const url = new URL(req.url);
    if (url.searchParams.get("meta") === "1" || req.headers.get("accept")?.includes("application/json")) {
      return NextResponse.json({
        meta: {
          audioId: officialSample.id,
          songTitle: officialSample.title,
          lyrics: officialSample.lyrics,
          coverUrl: officialSample.imageUrl,
        },
      });
    }

    const localAudioPath = path.join(process.cwd(), "public", officialSample.sampleAudio.replace(/^\//, ""));
    try {
      const stat = await fs.stat(localAudioPath);
      const fileSize = stat.size;
      const range = req.headers.get("range");

      if (range && range.startsWith("bytes=")) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (isNaN(start) || start >= fileSize) {
          return new Response(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${fileSize}` },
          });
        }

        const chunksize = Math.min(end - start + 1, fileSize - start);
        const fileHandle = await fs.open(localAudioPath, "r");
        const buffer = Buffer.alloc(chunksize);
        try {
          await fileHandle.read(buffer, 0, chunksize, start);
        } finally {
          await fileHandle.close();
        }

        return new Response(buffer, {
          status: 206,
          headers: {
            "Content-Range": `bytes ${start}-${start + chunksize - 1}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(chunksize),
            "Content-Type": "audio/mpeg",
            "Cache-Control": "public, max-age=31536000, immutable",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      const fileBuf = await fs.readFile(localAudioPath);
      return new Response(fileBuf, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": String(fileSize),
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=31536000, immutable",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch {
      // fallback to dynamic
    }
  }

  // 1. Support reading metadata JSON
  const url = new URL(req.url);
  if (url.searchParams.get("meta") === "1" || req.headers.get("accept")?.includes("application/json")) {
    const meta = await getAudioMeta(id);
    if (meta) {
      return NextResponse.json({ meta });
    }
  }

  // 2. Read physical audio file
  const audio = await getAudioFile(id);
  if (!audio) {
    return NextResponse.json({ error: "音频文件不存在或已过期" }, { status: 404 });
  }

  const range = req.headers.get("range");
  const fileSize = audio.size;

  // 3. Handle Range Requests (Strictly required for iOS Safari / WeChat)
  if (range && range.startsWith("bytes=")) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (isNaN(start) || start >= fileSize) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }

    const chunksize = Math.min(end - start + 1, fileSize - start);
    const fileHandle = await fs.open(audio.filePath, "r");
    const buffer = Buffer.alloc(chunksize);
    try {
      await fileHandle.read(buffer, 0, chunksize, start);
    } finally {
      await fileHandle.close();
    }

    return new Response(buffer, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${start + chunksize - 1}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunksize),
        "Content-Type": audio.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // 4. Full Content Request
  const fileBuf = await fs.readFile(audio.filePath);
  return new Response(fileBuf, {
    status: 200,
    headers: {
      "Content-Type": audio.contentType,
      "Content-Length": String(fileSize),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
