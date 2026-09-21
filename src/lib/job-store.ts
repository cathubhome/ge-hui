import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { JobCreateInput, JobRecord, JobStep, JobStatus } from "@/lib/job-types";

const jobsDir = () => path.join(process.cwd(), "data", "jobs");

/** In-memory mirror so same Node process doesn't re-read disk every poll. */
const memory = new Map<string, JobRecord>();

/** Prevent double-run if POST is retried. */
const running = new Set<string>();

async function ensureDir() {
  await fs.mkdir(jobsDir(), { recursive: true });
}

function jobJsonPath(id: string) {
  return path.join(jobsDir(), `${id}.json`);
}

function jobPdfPath(id: string) {
  return path.join(jobsDir(), `${id}.pdf`);
}

export function isJobRunning(id: string): boolean {
  return running.has(id);
}

export function markJobRunning(id: string, on: boolean) {
  if (on) running.add(id);
  else running.delete(id);
}

export async function createJob(input: JobCreateInput): Promise<JobRecord> {
  await ensureDir();
  const id = randomUUID();
  const now = new Date().toISOString();
  const needsVision = Boolean(input.needsVision && input.pdfBytes?.length);
  const record: JobRecord = {
    id,
    status: "queued",
    step: needsVision ? "reading_pdf" : "planning",
    progressLabel: needsVision
      ? "排队中：稍后看图读词…"
      : "排队中：准备想画面…",
    createdAt: now,
    updatedAt: now,
    needsVision,
    inputSummary: {
      songTitle: input.songTitle || undefined,
      chatModel: input.chatModel || undefined,
      imageModel: input.imageModel || undefined,
      hasPdf: Boolean(input.pdfBytes?.length),
      lyricsPreview: (input.lyrics || "").slice(0, 80) || undefined,
    },
  };

  if (input.pdfBytes?.length) {
    await fs.writeFile(jobPdfPath(id), input.pdfBytes);
  }

  // Side channel for runner (not exposed in GET snapshot heavy fields)
  await writePrivateInput(id, {
    lyrics: input.lyrics || "",
    songTitle: input.songTitle || "",
    chatModel: input.chatModel || "",
    imageModel: input.imageModel || "",
    characterDescription: input.characterDescription || "",
    needsVision,
  });

  memory.set(id, record);
  await persist(record);
  return record;
}

type PrivateInput = {
  lyrics: string;
  songTitle: string;
  chatModel: string;
  imageModel: string;
  characterDescription: string;
  needsVision: boolean;
};

function privatePath(id: string) {
  return path.join(jobsDir(), `${id}.input.json`);
}

async function writePrivateInput(id: string, data: PrivateInput) {
  await fs.writeFile(privatePath(id), JSON.stringify(data), "utf8");
}

export async function readPrivateInput(id: string): Promise<PrivateInput | null> {
  try {
    const raw = await fs.readFile(privatePath(id), "utf8");
    return JSON.parse(raw) as PrivateInput;
  } catch {
    return null;
  }
}

export async function readJobPdf(id: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(jobPdfPath(id));
  } catch {
    return null;
  }
}

export async function deleteJobPdf(id: string) {
  try {
    await fs.unlink(jobPdfPath(id));
  } catch {
    // ignore
  }
}

async function persist(record: JobRecord) {
  await ensureDir();
  const slim = { ...record };
  // Keep result.imageDataUrl in file for F5 resume; acceptable for demo scale.
  await fs.writeFile(jobJsonPath(record.id), JSON.stringify(slim, null, 2), "utf8");
  memory.set(record.id, record);
}

export async function getJob(id: string): Promise<JobRecord | null> {
  const cached = memory.get(id);
  if (cached) return cached;
  try {
    const raw = await fs.readFile(jobJsonPath(id), "utf8");
    const record = JSON.parse(raw) as JobRecord;
    memory.set(id, record);
    return record;
  } catch {
    return null;
  }
}

export async function updateJob(
  id: string,
  patch: Partial<
    Pick<JobRecord, "status" | "step" | "progressLabel" | "error" | "result" | "needsVision">
  >,
): Promise<JobRecord | null> {
  const cur = await getJob(id);
  if (!cur) return null;
  const next: JobRecord = {
    ...cur,
    ...patch,
    result: patch.result !== undefined ? { ...cur.result, ...patch.result } : cur.result,
    updatedAt: new Date().toISOString(),
  };
  await persist(next);
  return next;
}

export function publicJobSnapshot(job: JobRecord): JobRecord {
  // Already public-shaped; keep helper for future redaction.
  return job;
}

export function stepLabel(step: JobStep, status: JobStatus): string {
  if (status === "queued") return "排队中…";
  if (status === "error") return "出了点小状况";
  if (status === "done" || step === "done") return "绘本做好了";
  if (step === "reading_pdf") return "正在看绘本里的小伙伴…";
  if (step === "planning") return "正在想每一格画什么…";
  if (step === "drawing") return "画笔正在上色中…";
  return "正在生成…";
}

export async function writePrivateInputAfterVision(
  id: string,
  data: {
    lyrics: string;
    songTitle: string;
    chatModel: string;
    imageModel: string;
    characterDescription: string;
  },
) {
  await writePrivateInput(id, { ...data, needsVision: false });
}
