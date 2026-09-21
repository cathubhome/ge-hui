import type { ScenePlan } from "@/lib/types";

export type JobStatus = "queued" | "running" | "done" | "error";

export type JobStep =
  | "reading_pdf"
  | "planning"
  | "drawing"
  | "done"
  | "";

export type JobResult = {
  imageDataUrl?: string;
  plan?: ScenePlan;
  lyrics?: string;
  songTitle?: string;
  characterDescription?: string;
  mode?: "text" | "vision" | "lyrics";
};

export type JobRecord = {
  id: string;
  status: JobStatus;
  step: JobStep;
  progressLabel: string;
  error?: string;
  result?: JobResult;
  createdAt: string;
  updatedAt: string;
  /** Whether vision PDF read is still needed (input had no text layer). */
  needsVision?: boolean;
  /** Soft inputs for UI resume (no huge blobs). */
  inputSummary?: {
    songTitle?: string;
    chatModel?: string;
    imageModel?: string;
    hasPdf?: boolean;
    lyricsPreview?: string;
  };
};

export type JobCreateInput = {
  lyrics?: string;
  songTitle?: string;
  chatModel?: string;
  imageModel?: string;
  characterDescription?: string;
  needsVision?: boolean;
  /** Raw PDF bytes when image-PDF deferred vision is needed. */
  pdfBytes?: Buffer;
};
