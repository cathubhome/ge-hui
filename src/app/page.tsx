"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScenePlan } from "@/lib/types";
import type { JobRecord, JobStatus } from "@/lib/job-types";

type UiStep = "idle" | "working" | "done";

type ModelOption = {
  id: string;
  label: string;
  group: "chat" | "image";
};

type FreeSite = {
  name: string;
  url: string;
  tip: string;
};

const JOB_LS_KEY = "ge-hui-job-id";
const POLL_MS = 1500;

const WAIT_TIPS = [
  "正在听歌里的小故事…",
  "正在看绘本里的小伙伴…",
  "正在想每一格画什么…",
  "画笔正在上色中…",
  "差不多好了，再等一小会儿…",
];

const WAIT_STEPS = ["识读", "构思", "画画"] as const;

const DEMO_SONG_TITLE = "Head Shoulders Knees and Toes";

const DEMO_LYRICS = `Head, shoulders, knees and toes, knees and toes.
Head, shoulders, knees and toes, knees and toes.
And eyes and ears and mouth and nose.
Head, shoulders, knees and toes, knees and toes.`;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = String(reader.result || "");
      const i = r.indexOf("base64,");
      resolve(i >= 0 ? r.slice(i + 7) : r);
    };
    reader.onerror = () => reject(new Error("读文件失败"));
    reader.readAsDataURL(file);
  });
}

/** Infer 0/1/2 from progressLabel / jobStatus for the three wait steps. */
function inferWaitStep(progressLabel: string, jobStatus: string): number {
  const t = `${progressLabel} ${jobStatus}`.toLowerCase();
  if (/draw|画|上色|image|paint|绘/.test(t)) return 2;
  if (/plan|构思|想|画面|scene/.test(t)) return 1;
  if (/reading|vision|识读|看图|听歌|读|lyric|transcrib|extract|准备/.test(t)) return 0;
  if (jobStatus === "queued") return 0;
  if (jobStatus === "running") return 1;
  return 0;
}

function SunMusicDoodle({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="56"
      height="56"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="28" cy="28" r="12" fill="#ff6b2c" opacity="0.9" />
      <g stroke="#ff6b2c" strokeWidth="2.5" strokeLinecap="round">
        <path d="M28 8v4M28 44v4M8 28h4M44 28h4M14 14l3 3M39 39l3 3M14 42l3-3M39 17l3-3" />
      </g>
      <path
        d="M40 22v22"
        stroke="#1db8a6"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="40" cy="44" r="5" fill="#1db8a6" />
      <path
        d="M40 22c6 2 10 6 12 12"
        stroke="#1db8a6"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function MusicBookIcons() {
  return (
    <div className="flex items-center justify-center gap-3 text-2xl" aria-hidden="true">
      <span>🎵</span>
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
        <rect x="6" y="4" width="18" height="24" rx="2" fill="#fffdf8" stroke="#1db8a6" strokeWidth="2" />
        <path d="M10 10h10M10 15h10M10 20h7" stroke="#ff6b2c" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span>📖</span>
    </div>
  );
}

function SoftGridSkeleton() {
  return (
    <div className="soft-grid mx-auto grid w-full max-w-xs grid-cols-2 gap-2 rounded-2xl border border-[#f0e6d4] bg-[#fffdf8]/80 p-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="h-10 animate-pulse rounded-lg bg-gradient-to-br from-[#ffe4c8]/70 to-[#c8f0e8]/60"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}

export default function HomePage() {
  const [lyrics, setLyrics] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [fileName, setFileName] = useState("");
  const [step, setStep] = useState<UiStep>("idle");
  const [progressLabel, setProgressLabel] = useState("");
  const [waitSec, setWaitSec] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<ScenePlan | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [chatModels, setChatModels] = useState<ModelOption[]>([]);
  const [imageModels, setImageModels] = useState<ModelOption[]>([]);
  const [chatModel, setChatModel] = useState("");
  const [imageModel, setImageModel] = useState("");
  const [freeSites, setFreeSites] = useState<FreeSite[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [characterDescription, setCharacterDescription] = useState("");
  const [needsVision, setNeedsVision] = useState(false);
  const [pendingPdfBase64, setPendingPdfBase64] = useState<string | null>(null);
  const [uploadTip, setUploadTip] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | "">("");
  const [dragOver, setDragOver] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const pollTimer = useRef<number | null>(null);
  const resumeTried = useRef(false);

  const jobBusy =
    jobStatus === "queued" || jobStatus === "running" || step === "working";

  const canGenerate = useMemo(() => {
    if (jobBusy) return false;
    if (lyrics.trim().length > 8) return true;
    if (needsVision && pendingPdfBase64) return true;
    return false;
  }, [lyrics, jobBusy, needsVision, pendingPdfBase64]);

  const waitStepIndex = useMemo(
    () => inferWaitStep(progressLabel, String(jobStatus)),
    [progressLabel, jobStatus],
  );

  const stopPoll = useCallback(() => {
    if (pollTimer.current != null) {
      window.clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const applyJobSnapshot = useCallback((job: JobRecord) => {
    setJobId(job.id);
    setJobStatus(job.status);
    setProgressLabel(job.progressLabel || "");
    if (job.result?.lyrics) setLyrics(job.result.lyrics);
    if (job.result?.songTitle) setSongTitle(job.result.songTitle);
    if (job.result?.characterDescription) {
      setCharacterDescription(job.result.characterDescription);
    }
    if (job.result?.plan) setPlan(job.result.plan);
    if (job.status === "queued" || job.status === "running") {
      setStep("working");
      setError("");
      setImageDataUrl("");
    } else if (job.status === "done") {
      setStep("done");
      if (job.result?.imageDataUrl) setImageDataUrl(job.result.imageDataUrl);
      setError("");
      // Keep job id so refresh still shows result; user can start a new one later.
    } else if (job.status === "error") {
      setStep("idle");
      setError(job.error || "出了点小状况，再试一次吧");
    }
  }, []);

  const pollJob = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/jobs/${id}`);
        const data = (await res.json()) as { job?: JobRecord; error?: string };
        if (!res.ok || !data.job) {
          if (res.status === 404) {
            stopPoll();
            try {
              localStorage.removeItem(JOB_LS_KEY);
            } catch {
              /* ignore */
            }
            setJobId(null);
            setJobStatus("");
            setStep("idle");
            setError(data.error || "找不到上次的任务了，请再生成一次～");
          }
          return;
        }
        applyJobSnapshot(data.job);
        if (data.job.status === "done" || data.job.status === "error") {
          stopPoll();
        }
      } catch {
        // transient network — keep polling
      }
    },
    [applyJobSnapshot, stopPoll],
  );

  const startPolling = useCallback(
    (id: string) => {
      stopPoll();
      void pollJob(id);
      pollTimer.current = window.setInterval(() => {
        void pollJob(id);
      }, POLL_MS);
    },
    [pollJob, stopPoll],
  );

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/models");
        const data = (await res.json()) as {
          chatModels?: ModelOption[];
          imageModels?: ModelOption[];
          freeTranscriptionSites?: FreeSite[];
          defaults?: { chat?: string; image?: string };
        };
        setChatModels(data.chatModels ?? []);
        setImageModels(data.imageModels ?? []);
        setFreeSites(data.freeTranscriptionSites ?? []);
        setChatModel(data.defaults?.chat ?? "");
        setImageModel(data.defaults?.image ?? "");
      } catch {
        // ignore
      }
    })();
  }, []);

  // F5 resume: if localStorage has job id and job still running, keep Generate disabled + poll.
  useEffect(() => {
    if (resumeTried.current) return;
    resumeTried.current = true;
    let saved = "";
    try {
      saved = localStorage.getItem(JOB_LS_KEY) || "";
    } catch {
      saved = "";
    }
    if (!saved) return;
    void (async () => {
      try {
        const res = await fetch(`/api/jobs/${saved}`);
        const data = (await res.json()) as { job?: JobRecord };
        if (!res.ok || !data.job) {
          try {
            localStorage.removeItem(JOB_LS_KEY);
          } catch {
            /* ignore */
          }
          return;
        }
        applyJobSnapshot(data.job);
        if (data.job.status === "queued" || data.job.status === "running") {
          startPolling(data.job.id);
        }
      } catch {
        // ignore
      }
    })();
    return () => stopPoll();
  }, [applyJobSnapshot, startPolling, stopPoll]);

  useEffect(() => {
    if (step !== "working") {
      setWaitSec(0);
      setTipIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setWaitSec((s) => s + 1);
      setTipIndex((i) => (i + 1) % WAIT_TIPS.length);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  // Tip modal: Esc to close; never leave an invisible blocker.
  useEffect(() => {
    if (!showTip) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowTip(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showTip]);

  async function onPickFile(file: File | null) {
    if (!file) return;
    if (jobBusy) return;
    setError("");
    setFileName(file.name);
    setUploadTip("");
    setNeedsVision(false);
    setPendingPdfBase64(null);
    setCharacterDescription("");
    setImageDataUrl("");
    setPlan(null);

    try {
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        // Light path only — no Gemini on upload.
        setProgressLabel("正在读你的文件…");
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/extract-pdf", { method: "POST", body: form });
        const data = (await res.json()) as {
          text?: string;
          error?: string;
          mode?: string;
          needsVision?: boolean;
          tip?: string;
        };
        if (!res.ok && !data.needsVision) {
          throw new Error(data.error || "读 PDF 没成功");
        }
        if (data.needsVision || data.mode === "needs_vision") {
          const b64 = await fileToBase64(file);
          setPendingPdfBase64(b64);
          setNeedsVision(true);
          setLyrics("");
          setUploadTip(
            data.tip ||
              "这份 PDF 的字印在图上。文件先留在你这边，点「生成歌绘本」时再帮你看图读词～",
          );
          setProgressLabel("");
          setStep("idle");
          return;
        }
        setLyrics(data.text || "");
        setNeedsVision(false);
        setPendingPdfBase64(null);
        setUploadTip("歌词已经读出来了，可以点生成啦～");
        setProgressLabel("");
        setStep("idle");
        return;
      }

      if (file.type.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|flac|aac)$/i.test(file.name)) {
        setStep("working");
        setProgressLabel("正在听歌并整理歌词…");
        const form = new FormData();
        form.append("file", file);
        if (chatModel) form.append("model", chatModel);
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        const data = (await res.json()) as { text?: string; error?: string };
        if (!res.ok) throw new Error(data.error || "听歌没听清");
        setLyrics(data.text || "");
        setNeedsVision(false);
        setPendingPdfBase64(null);
        setProgressLabel("歌词整理好了");
        setStep("idle");
        return;
      }

      throw new Error("请上传 PDF 或音频文件哦");
    } catch (e) {
      setError(e instanceof Error ? e.message : "出了点小状况");
      setStep("idle");
    }
  }

  async function onGenerate() {
    if (jobBusy) return;
    setError("");
    setImageDataUrl("");
    setPlan(null);
    setUploadTip("");
    setStep("working");
    setProgressLabel(
      needsVision && pendingPdfBase64
        ? "开始准备：先看图读词…"
        : "开始准备：想画面…",
    );

    try {
      const body: Record<string, unknown> = {
        lyrics,
        songTitle: songTitle || undefined,
        chatModel: chatModel || undefined,
        imageModel: imageModel || undefined,
        characterDescription: characterDescription || undefined,
        needsVision: Boolean(needsVision && pendingPdfBase64),
      };
      if (needsVision && pendingPdfBase64) {
        body.pdfBase64 = pendingPdfBase64;
      }

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { job?: JobRecord; error?: string };
      if (!res.ok || !data.job) {
        throw new Error(data.error || "没能开始生成");
      }

      try {
        localStorage.setItem(JOB_LS_KEY, data.job.id);
      } catch {
        /* ignore */
      }
      applyJobSnapshot(data.job);
      startPolling(data.job.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "出了点小状况，再试一次吧");
      setStep("idle");
      setJobStatus("");
    }
  }

  function tryDemoSong() {
    // Demo must always work — clear any stuck generating state first.
    stopPoll();
    try {
      localStorage.removeItem(JOB_LS_KEY);
    } catch {
      /* ignore */
    }
    setJobId(null);
    setJobStatus("");
    setStep("idle");
    setProgressLabel("");
    setImageDataUrl("");
    setPlan(null);
    setShowTip(false);
    setSongTitle(DEMO_SONG_TITLE);
    setLyrics(DEMO_LYRICS);
    setError("");
    setFileName("");
    setCharacterDescription("");
    setNeedsVision(false);
    setPendingPdfBase64(null);
    setUploadTip("已填入演示儿歌，可以直接点「生成歌绘本」啦～");
  }

  function onDownload() {
    if (!imageDataUrl) return;
    const filename = `${(songTitle || "ge-hui").replace(/[^\w\u4e00-\u9fff-]+/g, "_") || "ge-hui"}.png`;
    try {
      // Large data: URLs often fail silently with <a download>; use a Blob instead.
      const comma = imageDataUrl.indexOf(",");
      const meta = comma >= 0 ? imageDataUrl.slice(0, comma) : "";
      const b64 = comma >= 0 ? imageDataUrl.slice(comma + 1) : imageDataUrl;
      const mimeMatch = /data:([^;]+)/.exec(meta);
      const mime = mimeMatch?.[1] || "image/png";
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch {
      const a = document.createElement("a");
      a.href = imageDataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }
  function onNewGenerate() {
    if (jobBusy) return;
    void onGenerate();
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:py-10">
      {/* Brand header */}
      <header className="mb-6 flex flex-col items-center text-center sm:mb-8">
        <div className="flex items-center gap-3">
          <SunMusicDoodle className="shrink-0 drop-shadow-sm" />
          <div>
            <h1 className="font-display text-4xl tracking-wide text-neutral-900 sm:text-5xl">
              歌绘
            </h1>
            <p className="mt-1 text-sm text-neutral-600 sm:text-base">
              把儿歌变成一页可打印的启蒙绘本
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-full bg-[#ff6b2c]/12 px-3 py-1 text-xs font-semibold text-[#c2410c]">
            一页
          </span>
          <span className="rounded-full bg-[#1db8a6]/12 px-3 py-1 text-xs font-semibold text-[#0f766e]">
            可打印
          </span>
          <span className="rounded-full bg-[#ff6b2c]/10 px-3 py-1 text-xs font-semibold text-[#c2410c]">
            边唱边指
          </span>
        </div>
      </header>

      {/* Compact demo — whole card clickable */}
      <section className="paper-card mb-6 overflow-hidden rounded-3xl">
        <button
          type="button"
          onClick={tryDemoSong}
          className="flex w-full cursor-pointer flex-col gap-3 p-3 text-left transition hover:bg-[#fff4ee]/50 sm:flex-row sm:items-center sm:gap-4 sm:p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/samples/ge-hui-final-sample.png"
            alt="歌绘成品示例：Head Shoulders Knees and Toes"
            className="pointer-events-none h-24 w-full shrink-0 rounded-2xl border border-[#f0e6d4] object-cover object-top sm:h-28 sm:w-40"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wide text-[#ff6b2c]">成品小样</p>
            <p className="mt-0.5 text-sm font-semibold text-neutral-800">
              生成后的绘本页可以长这样
            </p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              点这整张卡片，会填好歌名和歌词，再点「生成歌绘本」即可～
            </p>
          </div>
          <span className="shrink-0 rounded-2xl border border-[#ff6b2c]/40 bg-[#fff4ee] px-4 py-2.5 text-center text-sm font-semibold text-[#c2410c] sm:self-center">
            填入这首歌
          </span>
        </button>
      </section>

      {/* Two-column shell: form | sticky stage */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* LEFT: input form */}
        <section className="paper-card rounded-3xl p-5 sm:p-6">
          <label className="block text-sm font-semibold text-neutral-800">歌曲名（可选）</label>
          <input
            className="mt-2 w-full rounded-xl border border-[#f0e6d4] bg-[#fffdf8] px-3 py-2.5 text-sm outline-none ring-[#ff6b2c]/40 focus:ring-2 disabled:opacity-60"
            placeholder="例如 Head Shoulders Knees and Toes"
            value={songTitle}
            disabled={jobBusy}
            onChange={(e) => setSongTitle(e.target.value)}
          />

          <div className="mt-5">
            <label className="block text-sm font-semibold text-neutral-800">
              上传音频或 PDF
            </label>
            <label
              className={`mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-7 text-center transition ${
                dragOver
                  ? "border-[#ff6b2c] bg-[#fff4ee]"
                  : "border-[#f0e6d4] bg-[#fffdf8] hover:border-[#1db8a6]/70 hover:bg-[#f0faf8]"
              } ${jobBusy ? "pointer-events-none opacity-60" : ""}`}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0] ?? null;
                void onPickFile(f);
              }}
            >
              <MusicBookIcons />
              <span className="mt-3 text-sm font-medium text-neutral-700">
                把歌或歌词本拖进来，或点这里选文件
              </span>
              <span className="mt-1 text-xs text-neutral-500">支持 mp3 / wav / m4a / pdf</span>
              {fileName ? (
                <span className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#ff6b2c]/30 bg-[#fff4ee] px-3 py-1 text-xs font-medium text-[#c2410c] shadow-sm">
                  <span aria-hidden="true">📎</span>
                  <span className="truncate">已选：{fileName}</span>
                </span>
              ) : null}
              <input
                type="file"
                accept="audio/*,.pdf,application/pdf"
                className="hidden"
                disabled={jobBusy}
                onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {uploadTip ? (
              <p className="mt-2 text-xs leading-relaxed text-[#c2410c]">{uploadTip}</p>
            ) : null}
            {freeSites.length > 0 ? (
              <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                也可以先用浏览器里的免费听写工具整理歌词，再粘贴到下面：
                {freeSites.map((s, i) => (
                  <span key={s.url}>
                    {i > 0 ? " · " : " "}
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#ff6b2c] underline-offset-2 hover:underline"
                      title={s.tip}
                    >
                      {s.name}
                    </a>
                  </span>
                ))}
              </p>
            ) : null}
          </div>

          <label className="mt-5 block text-sm font-semibold text-neutral-800">歌词</label>
          <textarea
            className="mt-2 min-h-[140px] w-full resize-y rounded-2xl border border-[#f0e6d4] bg-[#fffdf8] px-3 py-3 text-sm leading-relaxed outline-none ring-[#ff6b2c]/40 focus:ring-2 disabled:opacity-60"
            placeholder="把歌词粘贴在这里，或上传文件自动整理…"
            value={lyrics}
            disabled={jobBusy}
            onChange={(e) => setLyrics(e.target.value)}
          />
          {needsVision && pendingPdfBase64 ? (
            <p className="mt-2 text-xs leading-relaxed text-neutral-500">
              已记住这份图文绘本。生成时会先看图读词，再画画～
            </p>
          ) : null}

          <button
            type="button"
            className="mt-4 flex w-full items-center justify-between rounded-xl border border-[#f0e6d4] bg-[#fffdf8] px-3 py-2.5 text-left text-sm text-neutral-700"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            <span>更多小设置</span>
            <span className="text-neutral-400">{showAdvanced ? "收起" : "展开"}</span>
          </button>
          {showAdvanced ? (
            <div className="paper-card mt-3 grid gap-3 rounded-2xl p-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-neutral-600">
                  谁来听歌想画面
                </label>
                <select
                  className="mt-1 w-full rounded-lg border border-[#f0e6d4] bg-white px-2 py-2 text-sm disabled:opacity-60"
                  value={chatModel}
                  disabled={jobBusy}
                  onChange={(e) => setChatModel(e.target.value)}
                >
                  {chatModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-600">谁来画画</label>
                <select
                  className="mt-1 w-full rounded-lg border border-[#f0e6d4] bg-white px-2 py-2 text-sm disabled:opacity-60"
                  value={imageModel}
                  disabled={jobBusy}
                  onChange={(e) => setImageModel(e.target.value)}
                >
                  {imageModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            disabled={!canGenerate}
            onClick={() => void onGenerate()}
            className="mt-5 w-full rounded-2xl bg-[#ff6b2c] px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition enabled:hover:bg-[#ef5a1a] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {jobBusy ? "正在生成…" : "生成歌绘本"}
          </button>

          {step === "working" ? (
            <div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50/80 px-4 py-3 text-sm text-neutral-700">
              <p className="font-medium text-[#c2410c]">{progressLabel || "正在生成…"}</p>
              <p className="mt-1 text-neutral-600">{WAIT_TIPS[tipIndex]}</p>
              <p className="mt-1 text-xs text-neutral-500">
                已等待 {waitSec} 秒
                {jobId ? ` · 任务保留中，刷新页面也会继续` : ""}
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <p>{error}</p>
              <button
                type="button"
                className="mt-2 text-sm font-medium text-[#ff6b2c] underline-offset-2 hover:underline"
                disabled={jobBusy}
                onClick={() => {
                  setError("");
                  if (canGenerate) void onGenerate();
                }}
              >
                再试一次
              </button>
            </div>
          ) : null}
        </section>

        {/* RIGHT: sticky result stage */}
        <aside className="lg:sticky lg:top-6">
          <div className="paper-card doodle-bg overflow-hidden rounded-3xl p-5 sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-display text-lg text-neutral-800">绘本小舞台</h2>
              {imageDataUrl ? (
                <span className="rounded-full bg-[#1db8a6]/15 px-2.5 py-1 text-[11px] font-semibold text-[#0f766e]">
                  适合打印 · 一页启蒙绘本
                </span>
              ) : null}
            </div>

            {step === "idle" && !imageDataUrl && !error ? (
              <div className="doodle-bg soft-grid rounded-2xl border border-dashed border-[#f0e6d4] px-4 py-6 text-center">
                <p className="text-sm font-medium text-neutral-600">绘本还在等你点开魔法～</p>
                <p className="mt-1 text-xs text-neutral-400">
                  左边填好歌词或上传歌曲，右边就会长出一页小画
                </p>
              </div>
            ) : null}

            {step === "working" && !imageDataUrl ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 sm:gap-3">
                  {WAIT_STEPS.map((label, i) => {
                    const active = i === waitStepIndex;
                    const done = i < waitStepIndex;
                    return (
                      <div key={label} className="flex items-center gap-2 sm:gap-3">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${
                              active
                                ? "bg-[#ff6b2c] text-white shadow-md shadow-[#ff6b2c]/30"
                                : done
                                  ? "bg-[#1db8a6] text-white"
                                  : "bg-[#f0e6d4] text-neutral-500"
                            }`}
                          >
                            {done ? "✓" : i + 1}
                          </span>
                          <span
                            className={`text-[11px] font-medium ${
                              active ? "text-[#c2410c]" : "text-neutral-500"
                            }`}
                          >
                            {label}
                          </span>
                        </div>
                        {i < WAIT_STEPS.length - 1 ? (
                          <span
                            className={`mb-4 hidden h-0.5 w-6 rounded sm:block ${
                              done ? "bg-[#1db8a6]" : "bg-[#f0e6d4]"
                            }`}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <SoftGridSkeleton />
                <p className="text-center text-sm text-neutral-600">绘本格子正在长大…</p>
              </div>
            ) : null}

            {imageDataUrl ? (
              <div className="space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageDataUrl}
                  alt="生成的歌绘本页"
                  className="w-full rounded-2xl border border-[#f0e6d4] bg-white shadow-sm"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onDownload}
                    className="rounded-xl bg-[#ff6b2c] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#ef5a1a]"
                  >
                    下载图片
                  </button>
                  <button
                    type="button"
                    disabled={jobBusy}
                    onClick={onNewGenerate}
                    className="rounded-xl border border-[#f0e6d4] bg-white px-4 py-2.5 text-sm text-neutral-700 disabled:opacity-50"
                  >
                    再画一张
                  </button>
                </div>
                {plan ? (
                  <details className="rounded-xl border border-[#f0e6d4] bg-[#fffdf8] px-3 py-2 text-xs text-neutral-600">
                    <summary className="cursor-pointer select-none font-medium text-neutral-700">
                      给老师看的画面说明
                    </summary>
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-sans leading-relaxed">
                      {JSON.stringify(plan, null, 2)}
                    </pre>
                  </details>
                ) : null}
                <div
                  id="ge-hui-tip"
                  className="mt-4 rounded-2xl border-2 border-[#ff6b2c]/30 bg-[#fff4ee]/70 p-3 text-center"
                >
                  <p className="font-display text-base text-neutral-800">喜欢这页？请杯奶茶支持一下～</p>
                  <p className="mt-1 text-[11px] text-neutral-500">
                    自愿打赏 · 码中间头像是微信自带的
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/samples/ge-hui-tip-card.png"
                    alt="请杯奶茶打赏码"
                    className="mx-auto mt-3 w-full max-w-[260px] rounded-2xl shadow-sm"
                  />
                </div>
              </div>
            ) : null}

            {error && !imageDataUrl && step !== "working" ? (
              <div className="rounded-2xl border border-rose-100 bg-rose-50/80 px-4 py-5 text-center text-sm text-rose-600">
                小舞台暂时空着，修好左边再试一次吧～
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      <footer className="mt-10 space-y-1 text-center text-xs text-neutral-400">
        <p>歌绘 · 一页启蒙绘本</p>
        <p>适合睡前、英语角，或打印贴在墙上一起唱。</p>
      </footer>

      {/* 摆法1：右下角悬浮奶茶钮（不挡主流程） */}
      {!showTip ? (
        <button
          type="button"
          onClick={() => setShowTip(true)}
          className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#ff6b2c] text-2xl shadow-lg shadow-orange-300/40 transition hover:scale-105 hover:bg-[#ef5a1a] focus:outline-none focus:ring-2 focus:ring-[#ff6b2c]/50 sm:bottom-8 sm:right-8"
          aria-label="请杯奶茶"
          title="请杯奶茶"
        >
          <span aria-hidden>🧋</span>
        </button>
      ) : null}
      {showTip ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="关闭打赏"
            onClick={() => setShowTip(false)}
          />
          <div
            className="relative z-10 max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-3xl border-2 border-[#ff6b2c]/40 bg-[#fffdf8] p-4 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="请杯奶茶"
          >
            <button
              type="button"
              className="absolute right-3 top-3 z-20 rounded-full bg-[#f0e6d4] px-3 py-1.5 text-xs font-medium text-neutral-700"
              onClick={() => setShowTip(false)}
            >
              关闭
            </button>
            <p className="pr-14 text-center font-display text-lg text-neutral-800">请杯奶茶</p>
            <p className="mt-1 text-center text-xs text-neutral-500">
              喜欢歌绘就好 · 扫一扫自愿打赏 · Esc 也可关闭
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/samples/ge-hui-tip-card.png"
              alt="请杯奶茶打赏码"
              className="mx-auto mt-3 w-full max-w-[260px] rounded-2xl"
            />
            {imageDataUrl ? (
              <button
                type="button"
                className="mt-3 w-full text-center text-xs font-medium text-[#ff6b2c] underline-offset-2 hover:underline"
                onClick={() => {
                  setShowTip(false);
                  window.setTimeout(() => {
                    document.getElementById("ge-hui-tip")?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                  }, 50);
                }}
              >
                也可看结果区下方的码
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
