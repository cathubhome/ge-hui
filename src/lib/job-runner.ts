import { NextRequest } from "next/server";
import {
  deleteJobPdf,
  getJob,
  isJobRunning,
  markJobRunning,
  readJobPdf,
  readPrivateInput,
  stepLabel,
  updateJob,
  writePrivateInputAfterVision,
} from "@/lib/job-store";
import { visionExtractPdf } from "@/lib/pdf-vision";
import type { ScenePlan } from "@/lib/types";

async function callPlanScene(body: Record<string, unknown>) {
  const { POST } = await import("@/app/api/plan-scene/route");
  const req = new NextRequest("http://local/api/plan-scene", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await POST(req);
  const data = (await res.json()) as { plan?: ScenePlan; error?: string };
  if (!res.ok || !data.plan) {
    throw new Error(data.error || "画面构思没想好");
  }
  return data.plan;
}

async function callGenerateImage(body: Record<string, unknown>) {
  const { POST } = await import("@/app/api/generate-image/route");
  const req = new NextRequest("http://local/api/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await POST(req);
  const data = (await res.json()) as { imageDataUrl?: string; error?: string };
  if (!res.ok || !data.imageDataUrl) {
    throw new Error(data.error || "画画没成功");
  }
  return data.imageDataUrl;
}

/**
 * Fire-and-forget generate pipeline. Safe to call after POST /api/jobs returns.
 * Steps: (optional) vision → plan-scene → generate-image.
 * No cancel support (product rule).
 */
export function startGenerateJob(jobId: string): void {
  if (isJobRunning(jobId)) return;
  markJobRunning(jobId, true);
  void runGenerateJob(jobId).finally(() => markJobRunning(jobId, false));
}

async function runGenerateJob(jobId: string): Promise<void> {
  const existing = await getJob(jobId);
  if (!existing) return;
  if (existing.status === "done" || existing.status === "error") return;

  const priv = await readPrivateInput(jobId);
  if (!priv) {
    await updateJob(jobId, {
      status: "error",
      progressLabel: "找不到这次生成的材料了",
      error: "找不到这次生成的材料了，请再点一次生成～",
    });
    return;
  }

  let lyrics = priv.lyrics;
  let songTitle = priv.songTitle;
  let characterDescription = priv.characterDescription;
  let referenceImageDataUrls: string[] = [];
  let mode: "text" | "vision" | "lyrics" = lyrics.trim() ? "lyrics" : "text";

  try {
    await updateJob(jobId, {
      status: "running",
      step: priv.needsVision ? "reading_pdf" : "planning",
      progressLabel: priv.needsVision
        ? stepLabel("reading_pdf", "running")
        : stepLabel("planning", "running"),
      error: undefined,
    });

    if (priv.needsVision) {
      const pdf = await readJobPdf(jobId);
      if (!pdf?.length) {
        throw new Error(
          "图文绘本文件不见了。请重新上传 PDF，再点生成～",
        );
      }
      await updateJob(jobId, {
        step: "reading_pdf",
        progressLabel: "正在看绘本里的小伙伴…",
      });
      const vision = await visionExtractPdf(pdf, priv.chatModel || undefined);
      if (!lyrics.trim()) lyrics = vision.text;
      if (!songTitle.trim() && vision.titleHint) songTitle = vision.titleHint;
      if (!characterDescription.trim()) {
        characterDescription = vision.characterDescription;
      }
      referenceImageDataUrls = vision.referenceImageDataUrls;
      mode = "vision";
      await deleteJobPdf(jobId);
      // Persist so a server restart resumes at planning, not re-vision.
      await writePrivateInputAfterVision(jobId, {
        lyrics,
        songTitle,
        chatModel: priv.chatModel,
        imageModel: priv.imageModel,
        characterDescription,
      });
      await updateJob(jobId, {
        needsVision: false,
        result: {
          lyrics,
          songTitle: songTitle || undefined,
          characterDescription: characterDescription || undefined,
          mode,
        },
      });
    }

    if (!lyrics.trim() || lyrics.trim().length < 8) {
      throw new Error("还没有足够的歌词，请粘贴歌词或上传文件后再生成～");
    }

    await updateJob(jobId, {
      step: "planning",
      progressLabel: stepLabel("planning", "running"),
    });
    const plan = await callPlanScene({
      lyrics,
      songTitle: songTitle || undefined,
      chatModel: priv.chatModel || undefined,
      characterDescription: characterDescription || undefined,
    });

    await updateJob(jobId, {
      step: "drawing",
      progressLabel: stepLabel("drawing", "running"),
      result: {
        plan,
        lyrics,
        songTitle: songTitle || undefined,
        characterDescription:
          characterDescription || plan.characterDescription || undefined,
        mode,
      },
    });

    const imageDataUrl = await callGenerateImage({
      plan,
      imageModel: priv.imageModel || undefined,
      characterDescription:
        characterDescription || plan.characterDescription || undefined,
      referenceImageDataUrls: referenceImageDataUrls.length
        ? referenceImageDataUrls
        : undefined,
    });

    await updateJob(jobId, {
      status: "done",
      step: "done",
      progressLabel: stepLabel("done", "done"),
      result: {
        imageDataUrl,
        plan,
        lyrics,
        songTitle: songTitle || undefined,
        characterDescription:
          characterDescription || plan.characterDescription || undefined,
        mode,
      },
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "出了点小状况，再试一次吧";
    await updateJob(jobId, {
      status: "error",
      progressLabel: "出了点小状况",
      error: message,
    });
  }
}

/** After server restart: if job JSON says queued/running, resume work. */
export async function resumeJobIfNeeded(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job) return;
  if (job.status === "queued" || job.status === "running") {
    startGenerateJob(jobId);
  }
}
