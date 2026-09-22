import { NextRequest, NextResponse } from "next/server";
import {
  createJob,
  publicJobSnapshot,
  readUploadPdf,
  deleteUploadPdf,
} from "@/lib/job-store";
import { startGenerateJob } from "@/lib/job-runner";

export const runtime = "nodejs";
export const maxDuration = 30;

type JsonBody = {
  lyrics?: string;
  songTitle?: string;
  chatModel?: string;
  imageModel?: string;
  characterDescription?: string;
  needsVision?: boolean;
  pdfBase64?: string;
  uploadId?: string;
};

function stripDataUrl(b64: string): Buffer {
  const s = b64.trim();
  const m = /^data:application\/pdf;base64,(.+)$/.exec(s);
  const raw = m ? m[1] : s.replace(/^data:[^;]+;base64,/, "");
  return Buffer.from(raw, "base64");
}

/**
 * Create a durable generate job and kick off async processing.
 * Returns quickly with job id for polling / F5 resume.
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let lyrics = "";
    let songTitle = "";
    let chatModel = "";
    let imageModel = "";
    let characterDescription = "";
    let needsVision = false;
    let pdfBytes: Buffer | undefined;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      lyrics = String(form.get("lyrics") || "");
      songTitle = String(form.get("songTitle") || "");
      chatModel = String(form.get("chatModel") || "");
      imageModel = String(form.get("imageModel") || "");
      characterDescription = String(form.get("characterDescription") || "");
      needsVision =
        String(form.get("needsVision") || "") === "1" ||
        String(form.get("needsVision") || "").toLowerCase() === "true";
      const uploadId = String(form.get("uploadId") || "");
      if (uploadId) {
        const buf = await readUploadPdf(uploadId);
        if (buf) {
          pdfBytes = buf;
          needsVision = true;
          void deleteUploadPdf(uploadId);
        }
      }
      const file = form.get("pdf") || form.get("file");
      if (!pdfBytes && file && file instanceof File) {
        pdfBytes = Buffer.from(await file.arrayBuffer());
        needsVision = true;
      }
    } else {
      const body = (await req.json()) as JsonBody;
      lyrics = String(body.lyrics || "");
      songTitle = String(body.songTitle || "");
      chatModel = String(body.chatModel || "");
      imageModel = String(body.imageModel || "");
      characterDescription = String(body.characterDescription || "");
      needsVision = Boolean(body.needsVision);
      if (body.uploadId) {
        const buf = await readUploadPdf(body.uploadId);
        if (buf) {
          pdfBytes = buf;
          needsVision = true;
          void deleteUploadPdf(body.uploadId);
        }
      }
      if (!pdfBytes && body.pdfBase64) {
        pdfBytes = stripDataUrl(String(body.pdfBase64));
        needsVision = true;
      }
    }

    const hasLyrics = lyrics.trim().length > 8;
    if (!hasLyrics && !pdfBytes?.length) {
      return NextResponse.json(
        { error: "请先填写歌词，或上传需要看图读词的 PDF～" },
        { status: 400 },
      );
    }

    // Cap PDF size (~12MB) to protect 2C2G box
    if (pdfBytes && pdfBytes.length > 12 * 1024 * 1024) {
      return NextResponse.json(
        { error: "这份 PDF 有点大，请换一份小一点的，或直接粘贴歌词～" },
        { status: 413 },
      );
    }

    const job = await createJob({
      lyrics,
      songTitle,
      chatModel,
      imageModel,
      characterDescription,
      needsVision: needsVision && Boolean(pdfBytes?.length),
      pdfBytes,
    });

    // Fire-and-forget — do not await the full pipeline.
    startGenerateJob(job.id);

    return NextResponse.json({ job: publicJobSnapshot(job) }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "创建任务失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
