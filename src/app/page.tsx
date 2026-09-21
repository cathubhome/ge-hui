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
    if (jobBusy) return;
    setSongTitle(DEMO_SONG_TITLE);
    setLyrics(DEMO_LYRICS);
    setError("");
    setFileName("");
    setCharacterDescription("");
    setNeedsVision(false);
    setPendingPdfBase64(null);
    setUploadTip("");
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
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 text-center">
        <p className="text-sm font-medium text-[#ff6b2c]">儿童英语启蒙 · 一页歌绘本</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          歌绘
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600 sm:text-base">
          上传儿歌音频或歌词 PDF，一键生成一张适合打印的启蒙绘本页。
        </p>
      </header>

      <section className="mb-6 overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm">
        <div className="grid gap-0 sm:grid-cols-2">
          <div className="bg-[#faf7f0] p-4 sm:p-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/samples/ge-hui-final-sample.png"
              alt="歌绘成品示例：Head Shoulders Knees and Toes"
              className="w-full rounded-2xl border border-neutral-100 bg-white shadow-sm"
            />
          </div>
          <div className="flex flex-col justify-center gap-3 p-5 sm:p-6">
            <p className="text-xs font-semibold tracking-wide text-[#ff6b2c]">成品示例</p>
            <h2 className="text-lg font-bold text-neutral-900">生成后的绘本页可以长这样</h2>
            <p className="text-sm leading-relaxed text-neutral-600">
              这是一首经典儿歌做成的一页启蒙绘本示例。点下面按钮，会自动填好歌名和歌词，你可以直接生成试试。
            </p>
            <button
              type="button"
              onClick={tryDemoSong}
              disabled={jobBusy}
              className="mt-1 w-full rounded-2xl border border-[#ff6b2c]/40 bg-[#fff4ee] px-4 py-3 text-sm font-semibold text-[#c2410c] transition hover:bg-[#ffe8da] disabled:opacity-50 sm:w-auto"
            >
              用这首歌试一试
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-neutral-200/80 bg-white p-5 shadow-sm sm:p-7">
        <label className="block text-sm font-medium text-neutral-800">歌曲名（可选）</label>
        <input
          className="mt-2 w-full rounded-xl border border-neutral-200 bg-[#faf7f0] px-3 py-2.5 text-sm outline-none ring-[#ff6b2c]/40 focus:ring-2 disabled:opacity-60"
          placeholder="例如 Head Shoulders Knees and Toes"
          value={songTitle}
          disabled={jobBusy}
          onChange={(e) => setSongTitle(e.target.value)}
        />

        <div className="mt-5">
          <label className="block text-sm font-medium text-neutral-800">上传音频或 PDF</label>
          <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-[#faf7f0] px-4 py-8 text-center transition hover:border-[#ff6b2c]/60">
            <span className="text-sm text-neutral-700">点击选择文件</span>
            <span className="mt-1 text-xs text-neutral-500">支持 mp3 / wav / m4a / pdf</span>
            {fileName ? (
              <span className="mt-2 text-xs text-[#ff6b2c]">已选：{fileName}</span>
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

        <label className="mt-5 block text-sm font-medium text-neutral-800">歌词</label>
        <textarea
          className="mt-2 min-h-[160px] w-full resize-y rounded-2xl border border-neutral-200 bg-[#faf7f0] px-3 py-3 text-sm leading-relaxed outline-none ring-[#ff6b2c]/40 focus:ring-2 disabled:opacity-60"
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
          className="mt-4 flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-left text-sm text-neutral-700"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          <span>高级设置</span>
          <span className="text-neutral-400">{showAdvanced ? "收起" : "展开"}</span>
        </button>
        {showAdvanced ? (
          <div className="mt-3 grid gap-3 rounded-2xl border border-neutral-100 bg-[#faf7f0] p-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-neutral-600">听歌 / 构思模型</label>
              <select
                className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-sm disabled:opacity-60"
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
              <label className="text-xs font-medium text-neutral-600">画画模型</label>
              <select
                className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-sm disabled:opacity-60"
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

        {step === "idle" && !imageDataUrl && !error ? (
          <div className="mt-4 flex min-h-[280px] items-center justify-center rounded-2xl bg-[#faf7f0] text-sm text-neutral-500">
            做好后的绘本会出现在这里
          </div>
        ) : null}
        {step === "working" && !imageDataUrl ? (
          <div className="mt-4 grid min-h-[280px] place-items-center rounded-2xl bg-[#faf7f0]">
            <div className="text-center">
              <div className="mx-auto h-14 w-14 animate-bounce rounded-full bg-[#ff6b2c]"></div>
              <p className="mt-3 text-sm text-neutral-600">绘本正在长大...</p>
            </div>
          </div>
        ) : null}
        {imageDataUrl ? (
          <div className="mt-4 space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageDataUrl}
              alt="生成的歌绘本页"
              className="w-full rounded-2xl border border-neutral-100 bg-white shadow-sm"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onDownload}
                className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white"
              >
                下载图片
              </button>
              <button
                type="button"
                disabled={jobBusy}
                onClick={onNewGenerate}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-700 disabled:opacity-50"
              >
                再画一张
              </button>
            </div>
            {plan ? (
              <details className="rounded-xl border border-neutral-100 bg-[#faf7f0] px-3 py-2 text-xs text-neutral-600">
                <summary className="cursor-pointer select-none font-medium text-neutral-700">
                  本页画面说明
                </summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-sans leading-relaxed">
                  {JSON.stringify(plan, null, 2)}
                </pre>
              </details>
            ) : null}
          </div>
        ) : null}
      </section>

      <footer className="mt-8 text-center text-xs text-neutral-400">
        歌绘 · 一页启蒙绘本
      </footer>
    </main>
  );
}
