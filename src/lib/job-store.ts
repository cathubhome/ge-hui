import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { JobCreateInput, JobRecord, JobStep, JobStatus } from "@/lib/job-types";
import type { UserPreference } from "@/lib/types";
import { cleanupOldAudios } from "@/lib/audio-store";
import { dataRoot, writeJsonAtomic } from "@/lib/json-store";
import type { QuotaReservation } from "@/lib/quota-types";

const jobsDir = () => path.join(dataRoot(), "jobs");
const uploadsDir = () => path.join(dataRoot(), "uploads");

/** In-memory mirror so same Node process doesn't re-read disk every poll. */
const memory = new Map<string, JobRecord>();

/** Prevent double-run if POST is retried. */
const running = new Set<string>();
let cleanupStarted = false;

async function ensureDir() {
  await fs.mkdir(jobsDir(), { recursive: true });
  await fs.mkdir(uploadsDir(), { recursive: true });
  if (!cleanupStarted) {
    cleanupStarted = true;
    void cleanupOrphanedPdfs();
    void cleanupOrphanedUploads();
    void cleanupOldAudios(90);
  }
}

function uploadPdfPath(id: string) {
  return path.join(uploadsDir(), `${id}.pdf`);
}

export async function saveUploadPdf(id: string, bytes: Uint8Array | Buffer) {
  await ensureDir();
  await fs.writeFile(uploadPdfPath(id), bytes);
}

export async function readUploadPdf(id: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(uploadPdfPath(id));
  } catch {
    return null;
  }
}

export async function deleteUploadPdf(id: string) {
  try {
    await fs.unlink(uploadPdfPath(id));
  } catch {
    // ignore
  }
}

function uploadRefPath(id: string, i: number) {
  return path.join(uploadsDir(), `${id}.ref${i}.png`);
}

export async function saveUploadRefs(id: string, buffers: Buffer[]) {
  await ensureDir();
  let i = 0;
  for (const buf of buffers.slice(0, 2)) {
    await fs.writeFile(uploadRefPath(id, i), buf);
    i++;
  }
}

export async function readUploadRefs(id: string): Promise<Buffer[]> {
  const out: Buffer[] = [];
  for (let i = 0; i < 2; i++) {
    try {
      const buf = await fs.readFile(uploadRefPath(id, i));
      out.push(buf);
    } catch {
      // ignore
    }
  }
  return out;
}

export async function deleteUploadRefs(id: string) {
  for (let i = 0; i < 2; i++) {
    try {
      await fs.unlink(uploadRefPath(id, i));
    } catch {
      // ignore
    }
  }
}

export async function cleanupOrphanedUploads(maxAgeMs = 60 * 60 * 1000): Promise<number> {
  let cleaned = 0;
  try {
    const dir = uploadsDir();
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const now = Date.now();
    for (const entry of entries) {
      if (!entry.isFile() || (!entry.name.endsWith(".pdf") && !entry.name.includes(".ref"))) continue;
      const filePath = path.join(dir, entry.name);
      try {
        const stat = await fs.stat(filePath);
        if (now - stat.mtimeMs > maxAgeMs) {
          await fs.unlink(filePath);
          cleaned++;
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
  return cleaned;
}

function jobJsonPath(id: string) {
  return path.join(jobsDir(), `${id}.json`);
}

function jobPdfPath(id: string) {
  return path.join(jobsDir(), `${id}.pdf`);
}

function jobRefPath(id: string, i: number) {
  return path.join(jobsDir(), `${id}.ref${i}.png`);
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
  const id = input.id || randomUUID();
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
  if (input.refBuffers?.length) {
    let ri = 0;
    for (const buf of input.refBuffers.slice(0, 2)) {
      await fs.writeFile(jobRefPath(id, ri), buf);
      ri++;
    }
  }

  await writePrivateInput(id, {
    lyrics: input.lyrics || "",
    songTitle: input.songTitle || "",
    chatModel: input.chatModel || "",
    imageModel: input.imageModel || "",
    characterDescription: input.characterDescription || "",
    needsVision,
    userPreference: input.userPreference,
    audioId: input.audioId,
    quotaReservation: input.quotaReservation,
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
  userPreference?: UserPreference;
  audioId?: string;
  quotaReservation?: QuotaReservation;
};

function privatePath(id: string) {
  return path.join(jobsDir(), `${id}.input.json`);
}

async function writePrivateInput(id: string, data: PrivateInput) {
  await writeJsonAtomic(privatePath(id), data);
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

/**
 * Automatically clean up any temporary PDF files whose jobs have finished, errored,
 * or been abandoned for more than 1 hour.
 */
export async function cleanupOrphanedPdfs(maxAgeMs = 60 * 60 * 1000): Promise<number> {
  let cleaned = 0;
  try {
    const dir = jobsDir();
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const now = Date.now();

    for (const entry of entries) {
      if (!entry.isFile() || (!entry.name.endsWith(".pdf") && !entry.name.includes(".ref"))) continue;
      const pdfFilePath = path.join(dir, entry.name);
      const id = entry.name.replace(/\.pdf$/, "");

      try {
        const stat = await fs.stat(pdfFilePath);
        const ageMs = now - stat.mtimeMs;
        const job = await getJob(id);

        if (!job || job.status === "done" || job.status === "error" || ageMs > maxAgeMs) {
          await fs.unlink(pdfFilePath);
          cleaned++;
        }
      } catch {
        // ignore single file error
      }
    }
  } catch {
    // ignore
  }
  return cleaned;
}

export async function writeJobRefs(id: string, dataUrls: string[]) {
  await ensureDir();
  let i = 0;
  for (const u of dataUrls.slice(0, 2)) {
    const m = /^data:image\/\w+;base64,(.+)$/.exec(u);
    if (!m) continue;
    await fs.writeFile(jobRefPath(id, i), Buffer.from(m[1], "base64"));
    i += 1;
  }
}

export async function readJobRefs(id: string): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < 2; i++) {
    try {
      const buf = await fs.readFile(jobRefPath(id, i));
      out.push("data:image/png;base64," + buf.toString("base64"));
    } catch {
      // missing ref
    }
  }
  return out;
}

async function persist(record: JobRecord) {
  await ensureDir();
  const slim = { ...record };
  await writeJsonAtomic(jobJsonPath(record.id), slim);
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
  return job;
}

export function stepLabel(step: JobStep, status: JobStatus): string {
  if (status === "queued") return "排队中…";
  if (status === "error") return "出了点小状况";
  if (status === "done" || step === "done") return "绘本做好了";
  if (step === "reading_pdf") return "正在看绘本里的小伙伴…";
  if (step === "planning") return "正在想这一页怎么画…";
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
    userPreference?: UserPreference;
    audioId?: string;
  },
) {
  await writePrivateInput(id, { ...data, needsVision: false });
}
