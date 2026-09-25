import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  createJob,
  deleteUploadPdf,
  deleteUploadRefs,
  publicJobSnapshot,
  readUploadPdf,
  readUploadRefs,
} from "@/lib/job-store";
import { attachDeviceCookie, resolveDeviceIdentity } from "@/lib/device-identity";
import { startGenerateJob } from "@/lib/job-runner";
import {
  getQuotaStatus,
  QuotaError,
  refundGeneration,
  reserveGeneration,
} from "@/lib/rate-limiter";
import type { UserPreference } from "@/lib/types";

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
  userPreference?: UserPreference;
  audioId?: string;
};

function stripDataUrl(b64: string): Buffer {
  const s = b64.trim();
  const m = /^data:application\/pdf;base64,(.+)$/.exec(s);
  const raw = m ? m[1] : s.replace(/^data:[^;]+;base64,/, "");
  return Buffer.from(raw, "base64");
}

function isValidUploadId(uploadId: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(uploadId.trim());
}

/**
 * Create a durable generate job and kick off async processing.
 * Returns quickly with job id for polling / F5 resume.
 */
export async function POST(req: NextRequest) {
  const identity = resolveDeviceIdentity(req);
  let cleanupUploadAction: (() => Promise<void>) | null = null;
  let reservationId: string | null = null;

  try {
    const contentType = req.headers.get("content-type") || "";
    let lyrics = "";
    let songTitle = "";
    let chatModel = "";
    let imageModel = "";
    let characterDescription = "";
    let needsVision = false;
    let pdfBytes: Buffer | undefined;
    let refBuffers: Buffer[] | undefined;
    let userPreference: UserPreference | undefined;
    let audioId = "";

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
      const uploadId = String(form.get("uploadId") || "").trim();
      if (uploadId) {
        if (!isValidUploadId(uploadId)) {
          return attachDeviceCookie(
            NextResponse.json({ error: "无效的上传编号" }, { status: 400 }),
            identity,
          );
        }
        const buf = await readUploadPdf(uploadId);
        if (buf) {
          pdfBytes = buf;
          needsVision = true;
          cleanupUploadAction = async () => deleteUploadPdf(uploadId);
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
      userPreference = body.userPreference;
      audioId = String(body.audioId || "");
      const uploadId = String(body.uploadId || "").trim();
      if (uploadId) {
        if (!isValidUploadId(uploadId)) {
          return attachDeviceCookie(
            NextResponse.json({ error: "无效的上传编号" }, { status: 400 }),
            identity,
          );
        }
        const buf = await readUploadPdf(uploadId);
        if (buf) {
          pdfBytes = buf;
          needsVision = true;
          cleanupUploadAction = async () => deleteUploadPdf(uploadId);
        } else {
          const refs = await readUploadRefs(uploadId);
          if (refs.length > 0) {
            refBuffers = refs;
            cleanupUploadAction = async () => deleteUploadRefs(uploadId);
          }
        }
      }
      if (!pdfBytes && body.pdfBase64) {
        pdfBytes = stripDataUrl(String(body.pdfBase64));
        needsVision = true;
      }
    }

    const hasLyrics = lyrics.trim().length > 8;
    if (!hasLyrics && !pdfBytes?.length && !refBuffers?.length) {
      return attachDeviceCookie(
        NextResponse.json(
          { error: "请先填写歌词，或上传需要看图读词的 PDF～" },
          { status: 400 },
        ),
        identity,
      );
    }

    if (pdfBytes && pdfBytes.length > 12 * 1024 * 1024) {
      return attachDeviceCookie(
        NextResponse.json(
          { error: "这份 PDF 有点大，请换一份小一点的，或直接粘贴歌词～" },
          { status: 413 },
        ),
        identity,
      );
    }

    const jobId = randomUUID();
    reservationId = jobId;
    const quotaReservation = await reserveGeneration(identity.deviceHash, jobId);

    try {
      const job = await createJob({
        id: jobId,
        quotaReservation,
        lyrics,
        songTitle,
        chatModel,
        imageModel,
        characterDescription,
        needsVision: needsVision && Boolean(pdfBytes?.length),
        pdfBytes,
        refBuffers,
        userPreference,
        audioId: audioId || undefined,
      });

      if (cleanupUploadAction) {
        void cleanupUploadAction().catch(() => undefined);
      }
      startGenerateJob(job.id);

      const quota = await getQuotaStatus(identity.deviceHash);
      const res = NextResponse.json(
        { job: publicJobSnapshot(job), quota },
        { status: 201 },
      );
      res.headers.set("Cache-Control", "no-store");
      return attachDeviceCookie(res, identity);
    } catch (createError) {
      await refundGeneration(jobId).catch(() => undefined);
      throw createError;
    }
  } catch (e) {
    if (e instanceof QuotaError) {
      const res = NextResponse.json(
        {
          error: e.message,
          quotaExceeded: !e.quota.canGenerate && e.quota.cooldownSeconds === 0,
          cooldownActive: e.quota.cooldownSeconds > 0,
          quota: e.quota,
        },
        { status: 429 },
      );
      res.headers.set("Cache-Control", "no-store");
      return attachDeviceCookie(res, identity);
    }

    if (reservationId) {
      await refundGeneration(reservationId).catch(() => undefined);
    }
    const message = e instanceof Error ? e.message : "创建任务失败";
    const res = NextResponse.json({ error: message }, { status: 500 });
    res.headers.set("Cache-Control", "no-store");
    return attachDeviceCookie(res, identity);
  }
}
