"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScenePlan, UserPreference } from "@/lib/types";
import type { QuotaStatus } from "@/lib/quota-types";
import { triggerNativePrintA4, downloadA4Pdf } from "@/lib/print-canvas";
import { downloadColoringPdf, canvasEdgeDetect } from "@/lib/coloring-card";
import { SAMPLE_BOOKS, type SampleBook } from "@/lib/sample-books";
import { loadBookHistory, saveBookHistoryItem, clearBookHistory, type HistoryBookItem } from "@/lib/book-history";
import { SONG_CATEGORIES, SONG_PRESETS, type SongCategory, type SongPreset } from "@/lib/song-presets";
import { cleanTitleFromFileName } from "@/lib/file-title";
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
  "正在想这一页怎么画…",
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

function TeaCupIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M17 9v8a4 4 0 01-4 4H7a4 4 0 01-4-4V9a2 2 0 012-2h10a2 2 0 012 2z"
        fill="#ff6b2c"
        fillOpacity="0.15"
        stroke="#ff6b2c"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 11h2a3 3 0 013 3v0a3 3 0 01-3 3h-2"
        stroke="#ff6b2c"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 3l-1.5 4"
        stroke="#ff6b2c"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="7" cy="14" r="1" fill="#c2410c" />
      <circle cx="10" cy="16" r="1" fill="#c2410c" />
      <circle cx="13" cy="14" r="1" fill="#c2410c" />
      <circle cx="9" cy="12" r="1" fill="#c2410c" />
    </svg>
  );
}

function RefreshIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 2v6h-6M3 12a9 9 0 0115.36-6.36L21 8M3 22v-6h6M21 12a9 9 0 01-15.36 6.36L3 16" />
    </svg>
  );
}

function PdfFileIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  );
}

function PrintIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </svg>
  );
}

function ImageIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function PencilIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

function SpeakerIcon({ className = "w-3.5 h-3.5", playing = false }: { className?: string; playing?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={playing ? "currentColor" : "none"} fillOpacity={playing ? "0.2" : "0"} />
      {playing ? (
        <>
          <path d="M15.54 8.46a5 5 0 010 7.07" strokeWidth="2.5" className="animate-pulse" />
          <path d="M19.07 4.93a10 10 0 010 14.14" strokeWidth="2" className="opacity-80" />
        </>
      ) : (
        <>
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </>
      )}
    </svg>
  );
}

function ZoomInIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
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
  const [modelsLoading, setModelsLoading] = useState(true);
  const [characterDescription, setCharacterDescription] = useState("");
  const [roleScope, setRoleScope] = useState<"default" | "solo" | "all">("default");
  const [artStyle, setArtStyle] = useState<"default" | "crayon" | "clay">("default");
  const [customPrompt, setCustomPrompt] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);
  const [isColoring, setIsColoring] = useState(false);
  const [inspirationBatch, setInspirationBatch] = useState(0);
  const [showAiComposer, setShowAiComposer] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [isComposing, setIsComposing] = useState(false);

  const [historyList, setHistoryList] = useState<HistoryBookItem[]>([]);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [activeSampleId, setActiveSampleId] = useState<string>("sample-head-shoulders");
  const [sampleCarouselIndex, setSampleCarouselIndex] = useState(0);
  const [isSampleMode, setIsSampleMode] = useState<boolean>(false);
  const [previewImageModal, setPreviewImageModal] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  const prevSample = useCallback(() => {
    const prevIdx = (sampleCarouselIndex - 1 + SAMPLE_BOOKS.length) % SAMPLE_BOOKS.length;
    setSampleCarouselIndex(prevIdx);
    applySampleBook(SAMPLE_BOOKS[prevIdx]);
  }, [sampleCarouselIndex]);

  const nextSample = useCallback(() => {
    const nextIdx = (sampleCarouselIndex + 1) % SAMPLE_BOOKS.length;
    setSampleCarouselIndex(nextIdx);
    applySampleBook(SAMPLE_BOOKS[nextIdx]);
  }, [sampleCarouselIndex]);

  // Toggle sample native vocal audio playback
  const togglePlayAudio = useCallback(() => {
    const currentSample = SAMPLE_BOOKS[sampleCarouselIndex];
    if (!currentSample?.sampleAudio) return;

    if (!audioPlayerRef.current) {
      const audio = new Audio(currentSample.sampleAudio);
      audio.onended = () => setIsPlayingAudio(false);
      audio.onerror = () => setIsPlayingAudio(false);
      audioPlayerRef.current = audio;
    }

    if (isPlayingAudio) {
      audioPlayerRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      if (audioPlayerRef.current.src !== window.location.origin + currentSample.sampleAudio) {
        audioPlayerRef.current.src = currentSample.sampleAudio;
      }
      audioPlayerRef.current.play().then(
        () => setIsPlayingAudio(true),
        () => setIsPlayingAudio(false)
      );
    }
  }, [sampleCarouselIndex, isPlayingAudio]);

  // Stop audio on switching songs
  useEffect(() => {
    if (audioPlayerRef.current && isPlayingAudio) {
      audioPlayerRef.current.pause();
      setIsPlayingAudio(false);
    }
  }, [sampleCarouselIndex]);

  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [vipCodeInput, setVipCodeInput] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");
  const magicLinkHandled = useRef(false);

  const currentPresets = useMemo(() => {
    const start = (inspirationBatch * 3) % SONG_PRESETS.length;
    return SONG_PRESETS.slice(start, start + 3);
  }, [inspirationBatch]);

  useEffect(() => {
    setHistoryList(loadBookHistory());
  }, []);

  const refreshQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/quota");
      if (res.ok) {
        const data = (await res.json()) as { quota?: QuotaStatus };
        if (data.quota) setQuota(data.quota);
      }
    } catch {}
  }, []);

  useEffect(() => {
    void refreshQuota();
  }, [refreshQuota]);

  // Magic Link auto-redeem: check ?code= or ?token= on load
  useEffect(() => {
    if (typeof window === "undefined" || magicLinkHandled.current) return;
    magicLinkHandled.current = true;

    const params = new URLSearchParams(window.location.search);
    const codeParam = (params.get("code") || params.get("token") || "").trim();
    if (!codeParam || !/^GH1-[A-Z2-7]{4}/i.test(codeParam)) return;

    void (async () => {
      try {
        const res = await fetch("/api/activate-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: codeParam }),
        });
        const data = (await res.json()) as {
          message?: string;
          error?: string;
          quota?: QuotaStatus;
        };

        // Clean query params from address bar silently
        params.delete("code");
        params.delete("token");
        const nextQuery = params.toString();
        const nextUrl = window.location.pathname + (nextQuery ? `?${nextQuery}` : "") + window.location.hash;
        window.history.replaceState({}, "", nextUrl);

        if (res.ok) {
          if (data.quota) setQuota(data.quota);
          else void refreshQuota();
          setRedeemMsg(data.message || "激活成功！已为您同步创作额度～");
          setShowQuotaModal(true);
        } else {
          setRedeemMsg(data.error || "链接中的兑换码无效或已达设备上限");
          setShowQuotaModal(true);
        }
      } catch {
        // network error
      }
    })();
  }, [refreshQuota]);

  function openSampleGallery() {
    setIsSampleMode(true);
    setStep("done");
    applySampleBook(SAMPLE_BOOKS[sampleCarouselIndex || 0]);
  }

  function closeSampleGallery() {
    setIsSampleMode(false);
    setImageDataUrl("");
    setPlan(null);
    setStep("idle");
    setSongTitle("");
    setLyrics("");
  }

  function adoptSampleForCustomization(sample: SampleBook) {
    setSongTitle(sample.title);
    setLyrics(sample.lyrics);
    setIsSampleMode(false);
    setImageDataUrl("");
    setPlan(null);
    setStep("idle");
    setUploadTip(`✨ 已将《${sample.title}》载入左侧，可以定制宝宝专属角色并生成啦～`);
    document.getElementById("lyrics-textarea")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function applySampleBook(sample: SampleBook) {
    setActiveSampleId(sample.id);
    setIsSampleMode(true);
    setSongTitle(sample.title);
    setLyrics(sample.lyrics);
    setImageDataUrl(sample.imageUrl);
    setPlan(sample.plan);
    setStep("done");
    setError("");

    if (sample.sampleAudio) {
      void fetch(sample.sampleAudio)
        .then((res) => (res.ok ? res.blob() : null))
        .then((blob) => {
          if (!blob) return;
          const form = new FormData();
          form.append("file", blob, `${sample.id}.m4a`);
          return fetch("/api/transcribe", { method: "POST", body: form });
        })
        .then((res) => (res && res.ok ? res.json() : null))
        .then((data) => {
          if (data?.audioId) setAudioId(data.audioId);
        })
        .catch(() => {});
    }
  }

  function restoreHistoryBook(item: HistoryBookItem) {
    setIsSampleMode(false);
    setSongTitle(item.songTitle);
    setLyrics(item.lyrics);
    setImageDataUrl(item.imageDataUrl);
    setPlan(item.plan || null);
    setAudioId(item.audioId || null);
    setStep("done");
    setShowHistoryDrawer(false);
    setError("");
    setUploadTip(`✨ 已为你恢复历史画作《${item.songTitle}》，可随时导出 PDF、打印或涂色～`);
  }

  async function applySongPreset(preset: SongPreset) {
    setSongTitle(preset.title);
    setLyrics(preset.lyrics);
    setNeedsVision(false);
    setPendingPdfBase64(null);
    setUploadTip(`✨ 已为你载入经典儿歌《${preset.title}》，点下方「生成歌绘本」即可出画～`);

    if (preset.sampleAudio) {
      try {
        const audioRes = await fetch(preset.sampleAudio);
        if (audioRes.ok) {
          const blob = await audioRes.blob();
          const form = new FormData();
          form.append("file", blob, `${preset.id}.mp3`);
          const trRes = await fetch("/api/transcribe", { method: "POST", body: form });
          if (trRes.ok) {
            const data = await trRes.json();
            if (data.audioId) setAudioId(data.audioId);
          }
        }
      } catch {}
    } else {
      setAudioId(null);
    }
  }

  async function onComposeRhyme() {
    if (!aiTopic.trim() || isComposing) return;
    setIsComposing(true);
    setError("");
    try {
      const res = await fetch("/api/compose-rhyme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: aiTopic.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "童谣创作失败");
      if (data.title) setSongTitle(data.title);
      if (data.lyrics) setLyrics(data.lyrics);
      setAudioId(null);
      setShowAiComposer(false);
      setAiTopic("");
      setUploadTip(`✨ AI 已为宝贝创作出童谣《${data.title || aiTopic}》，点下方「生成歌绘本」即可出画～`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创作童谣出错了");
    } finally {
      setIsComposing(false);
    }
  }

  async function onRedeemVipCode() {
    if (!vipCodeInput.trim() || isRedeeming) return;
    setIsRedeeming(true);
    setRedeemMsg("");
    try {
      const res = await fetch("/api/activate-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: vipCodeInput.trim() }),
      });
      const data = (await res.json()) as {
        message?: string;
        error?: string;
        quota?: QuotaStatus;
      };
      if (!res.ok) throw new Error(data.error || "激活码校验失败");
      if (data.quota) setQuota(data.quota);
      else void refreshQuota();
      setRedeemMsg(data.message || "激活成功！已增加绘本创作额度～");
      // Keep code in input or sync link so user can copy/share if needed
      setTimeout(() => {
        setShowQuotaModal(false);
        setRedeemMsg("");
      }, 2000);
    } catch (e) {
      setRedeemMsg(e instanceof Error ? e.message : "激活失败，请检查输入");
    } finally {
      setIsRedeeming(false);
    }
  }

  function copyMagicSyncLink() {
    if (typeof window === "undefined") return;
    const cleanCode = vipCodeInput.trim();
    if (!cleanCode) {
      setCopyFeedback("请先在输入框粘贴卡密，再生成链接哦～");
      setTimeout(() => setCopyFeedback(""), 2500);
      return;
    }
    const url = `${window.location.origin}/?code=${encodeURIComponent(cleanCode)}`;
    void navigator.clipboard.writeText(url).then(
      () => {
        setCopyFeedback("✓ 链接已复制！发给电脑或微信打开即自动同步");
        setTimeout(() => setCopyFeedback(""), 3000);
      },
      () => {
        setCopyFeedback(url);
      }
    );
  }
  const [coloringSuccess, setColoringSuccess] = useState(false);
  const [coloringStage, setColoringStage] = useState("提取线稿中…");
  const [modelHighlight, setModelHighlight] = useState<"chat" | "image" | "both" | null>(null);

  const isChatReady = Boolean(chatModel && chatModels.some((m) => m.id === chatModel));
  const isImageReady = Boolean(imageModel && imageModels.some((m) => m.id === imageModel));
  const isBothModelsReady = isChatReady && isImageReady;

  function handleModelMissingClick() {
    setShowAdvanced(true);
    if (!isChatReady && !isImageReady) {
      setModelHighlight("both");
    } else if (!isChatReady) {
      setModelHighlight("chat");
    } else {
      setModelHighlight("image");
    }
    setTimeout(() => {
      document.getElementById("advanced-settings-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }
  const [audioId, setAudioId] = useState<string | null>(null);
  const [needsVision, setNeedsVision] = useState(false);
  const [pendingPdfBase64, setPendingPdfBase64] = useState<string | null>(null);
  const [pendingUploadId, setPendingUploadId] = useState<string | null>(null);
  const [uploadTip, setUploadTip] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | "">("");
  const [dragOver, setDragOver] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const pollTimer = useRef<number | null>(null);
  const resumeTried = useRef(false);

  const jobBusy =
    jobStatus === "queued" ||
    jobStatus === "running" ||
    step === "working" ||
    isUploading;

  const canGenerate = useMemo(() => {
    if (jobBusy) return false;
    if (lyrics.trim().length > 8) return true;
    if (needsVision && (pendingUploadId || pendingPdfBase64)) return true;
    if (pendingUploadId && (lyrics.trim().length > 0 || characterDescription.trim().length > 0)) return true;
    return false;
  }, [lyrics, jobBusy, needsVision, pendingUploadId, pendingPdfBase64, characterDescription]);

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
    if (job.result?.audioId) setAudioId(job.result.audioId);
    if (job.status === "queued" || job.status === "running") {
      setStep("working");
      setError("");
      setImageDataUrl("");
    } else if (job.status === "done") {
      setStep("done");
      setIsSampleMode(false);
      if (job.result?.imageDataUrl) {
        setImageDataUrl(job.result.imageDataUrl);
        // 保存历史画册
        const savedList = saveBookHistoryItem({
          id: job.id,
          songTitle: job.result.songTitle || songTitle || "启蒙儿歌",
          lyrics: job.result.lyrics || lyrics,
          imageDataUrl: job.result.imageDataUrl,
          plan: job.result.plan || plan,
          audioId: job.result.audioId || audioId,
        });
        setHistoryList([...savedList]);
      }
      setError("");
      // 从服务端权威同步最新配额
      void refreshQuota();
      // Keep job id so refresh still shows result; user can start a new one later.
    } else if (job.status === "error") {
      setStep("idle");
      setError(job.error || "出了点小状况，再试一次吧");
      void refreshQuota();
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
      } finally {
        setModelsLoading(false);
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
    if (step !== "working") return;
    const resetTimer = window.setTimeout(() => {
      setWaitSec(0);
      setTipIndex(0);
    }, 0);
    const timer = window.setInterval(() => {
      setWaitSec((s) => s + 1);
      setTipIndex((i) => (i + 1) % WAIT_TIPS.length);
    }, 1000);
    return () => {
      window.clearTimeout(resetTimer);
      window.clearInterval(timer);
    };
  }, [step]);

  // Modal Escape handling: tip, quota, and preview image modals
  useEffect(() => {
    if (!showTip && !showQuotaModal && !previewImageModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowTip(false);
        setShowQuotaModal(false);
        setPreviewImageModal(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showTip, showQuotaModal, previewImageModal]);

  async function onPickFiles(fileList: FileList | File[] | null) {
    if (!fileList || fileList.length === 0) return;
    if (jobBusy) return;
    setError("");

    const files = Array.from(fileList);
    const first = files[0];
    if (!first) return;

    // Pre-check size limit: 20MB per file
    for (const f of files) {
      if (f.size > 20 * 1024 * 1024) {
        setError(`文件「${f.name}」大小超过 20MB，请压缩后再试～`);
        return;
      }
    }

    setUploadTip("");
    setNeedsVision(false);
    setPendingPdfBase64(null);
    setPendingUploadId(null);
    setCharacterDescription("");
    setImageDataUrl("");
    setPlan(null);

    // Level 1: Instantly clean previous title and prefill clean title from filename
    const autoTitle = cleanTitleFromFileName(first.name);
    setSongTitle(autoTitle);
    setLyrics("");

    setIsUploading(true);

    try {
      // 1. Photo Remake / Multiple Images (JPG, PNG, WebP)
      const isAllImages = files.every(
        (f) =>
          f.type.startsWith("image/") ||
          /\.(jpe?g|png|webp)$/i.test(f.name),
      );

      if (isAllImages) {
        const count = Math.min(files.length, 3);
        const nameDisplay = count === 1 ? first.name : `${first.name} 等 ${count} 张照片`;
        setFileName(nameDisplay);
        setUploadProgressText("正在看绘本照片，读取歌词并锁定角色…");

        const form = new FormData();
        for (const f of files.slice(0, 3)) {
          form.append("files", f);
        }

        const res = await fetch("/api/extract-image", {
          method: "POST",
          body: form,
        });
        const data = (await res.json()) as {
          uploadId?: string;
          text?: string;
          titleHint?: string;
          characterDescription?: string;
          imageCount?: number;
          tip?: string;
          error?: string;
        };

        if (!res.ok) throw new Error(data.error || "读取绘本照片失败");

        if (data.text) setLyrics(data.text);
        if (data.titleHint && data.titleHint.trim()) {
          setSongTitle(data.titleHint.trim());
        }
        if (data.characterDescription) {
          setCharacterDescription(data.characterDescription);
        }
        if (data.uploadId) {
          setPendingUploadId(data.uploadId);
        }

        setNeedsVision(false);
        setUploadTip(
          data.tip ||
            `✨ 已就绪 ${data.imageCount || count} 张绘本照片！已锁定角色人设，可直接点「生成歌绘本」制作专属跨页～`,
        );
        setIsUploading(false);
        setUploadProgressText("");
        return;
      }

      // 2. PDF Picture Book
      const pdfFile = files.find(
        (f) =>
          f.type === "application/pdf" ||
          f.name.toLowerCase().endsWith(".pdf"),
      );
      if (pdfFile) {
        const sizeMb = (pdfFile.size / (1024 * 1024)).toFixed(1);
        setFileName(`${pdfFile.name} (${sizeMb}MB)`);
        setUploadProgressText("正在翻阅绘本页面，识别歌词与角色页…");
        const form = new FormData();
        form.append("file", pdfFile);
        const res = await fetch("/api/extract-pdf", { method: "POST", body: form });
        const data = (await res.json()) as {
          text?: string;
          error?: string;
          mode?: string;
          needsVision?: boolean;
          tip?: string;
          uploadId?: string;
        };
        if (!res.ok && !data.needsVision) {
          throw new Error(data.error || "读 PDF 没成功");
        }
        if (data.needsVision || data.mode === "needs_vision") {
          setUploadProgressText("绘本已识别，正在载入画板…");
          if (data.uploadId) {
            setPendingUploadId(data.uploadId);
          } else {
            const b64 = await fileToBase64(pdfFile);
            setPendingPdfBase64(b64);
          }
          setNeedsVision(true);
          setLyrics("");
          setUploadTip(
            data.tip ||
              "✨ 绘本已就绪！生成时会自动定位倒数第二页角色定妆与最后一页歌词，合成一张精美歌绘～",
          );
          setIsUploading(false);
          setUploadProgressText("");
          return;
        }
        setLyrics(data.text || "");
        setNeedsVision(false);
        setPendingPdfBase64(null);
        setUploadTip("✨ 歌词文本已提取就绪，可以随时点「生成歌绘本」啦～");
        setIsUploading(false);
        setUploadProgressText("");
        return;
      }

      // 3. Audio Nursery Rhymes
      const audioFile = files.find(
        (f) =>
          f.type.startsWith("audio/") ||
          /\.(mp3|wav|m4a|ogg|flac|aac)$/i.test(f.name),
      );
      if (audioFile) {
        const sizeMb = (audioFile.size / (1024 * 1024)).toFixed(1);
        setFileName(`${audioFile.name} (${sizeMb}MB)`);
        setUploadProgressText("正在听歌并智能转写歌词…");
        const form = new FormData();
        form.append("file", audioFile);
        if (chatModel) form.append("model", chatModel);
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        const data = (await res.json()) as { text?: string; titleHint?: string; audioId?: string; error?: string };
        if (!res.ok) throw new Error(data.error || "听歌没听清");
        setLyrics(data.text || "");
        if (data.titleHint && data.titleHint.trim()) {
          setSongTitle(data.titleHint.trim());
        }
        if (data.audioId) {
          setAudioId(data.audioId);
        }
        setNeedsVision(false);
        setPendingPdfBase64(null);
        setUploadTip("✨ 歌声已转写成歌词，确认无误后即可点「生成歌绘本」～");
        setIsUploading(false);
        setUploadProgressText("");
        return;
      }

      throw new Error("暂不支持该格式，请上传常见音频（MP3/WAV/M4A等）、PDF或绘本照片（JPG/PNG/WebP）～");
    } catch (e) {
      setError(e instanceof Error ? e.message : "出了点小状况");
      setIsUploading(false);
      setUploadProgressText("");
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
      const hasPdf = Boolean(needsVision && (pendingUploadId || pendingPdfBase64));
      const userPreference: UserPreference = {
        roleScope: roleScope !== "default" ? roleScope : undefined,
        artStyle: artStyle !== "default" ? artStyle : undefined,
        customPrompt: customPrompt.trim() ? customPrompt.trim().slice(0, 40) : undefined,
      };
      const hasPref = Boolean(userPreference.roleScope || userPreference.artStyle || userPreference.customPrompt);

      const body: Record<string, unknown> = {
        lyrics,
        songTitle: songTitle || undefined,
        chatModel: chatModel || undefined,
        imageModel: imageModel || undefined,
        characterDescription: characterDescription || undefined,
        needsVision: hasPdf,
        userPreference: hasPref ? userPreference : undefined,
        audioId: audioId || undefined,
      };
      if (hasPdf) {
        if (pendingUploadId) {
          body.uploadId = pendingUploadId;
        } else if (pendingPdfBase64) {
          body.pdfBase64 = pendingPdfBase64;
        }
      }

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        job?: JobRecord;
        error?: string;
        quotaExceeded?: boolean;
        cooldownActive?: boolean;
        quota?: QuotaStatus;
      };
      if (data.quota) {
        setQuota(data.quota);
      }
      if (!res.ok || !data.job) {
        if (data.quotaExceeded) {
          setShowQuotaModal(true);
        }
        throw new Error(data.error || "没能开始生成");
      }

      setQuota((prev) => {
        if (!prev) return prev;
        if (prev.freeRemainingToday > 0) {
          const nextFree = Math.max(0, prev.freeRemainingToday - 1);
          return {
            ...prev,
            freeRemainingToday: nextFree,
            canGenerate: nextFree > 0 || prev.paidRemaining > 0,
          };
        }
        const nextPaid = Math.max(0, prev.paidRemaining - 1);
        return {
          ...prev,
          paidRemaining: nextPaid,
          canGenerate: nextPaid > 0,
        };
      });

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

  function getListenUrl(): string | undefined {
    if (typeof window === "undefined") return undefined;
    // 1. 官方精选样板模式：仅当该官方绘本具备对应原声音频时，生成官方经典伴唱播放二维码
    if (isSampleMode) {
      const sample = SAMPLE_BOOKS[sampleCarouselIndex];
      if (sample && sample.sampleAudio) {
        return `${window.location.origin}/p/${sample.id}`;
      }
      return undefined;
    }
    // 2. 自定义创作模式：仅当用户真正上传并压缩了音频时才生成专属伴唱码
    if (audioId) {
      return `${window.location.origin}/p/${audioId}`;
    }
    // 3. 纯文本歌词/纯绘本抽词无音频：严格返回 undefined，画布引擎优雅绘制亲子启蒙徽章，杜绝无效死码
    return undefined;
  }

  async function onPrintA4() {
    if (!imageDataUrl || isPrinting) return;
    setIsPrinting(true);
    try {
      await triggerNativePrintA4(imageDataUrl, songTitle, getListenUrl());
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法调起系统打印");
    } finally {
      setIsPrinting(false);
    }
  }

  async function onDownloadColoring() {
    if (!imageDataUrl || isColoring || isPrinting) return;
    setIsColoring(true);
    setColoringSuccess(false);
    setColoringStage("构思线稿中…");
    try {
      let coloringDataUrl = "";
      // 1. Try AI-assisted line art API
      try {
        const res = await fetch("/api/generate-coloring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageDataUrl, imageModel }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.coloringDataUrl) {
            coloringDataUrl = data.coloringDataUrl;
          }
        }
      } catch {}

      // 2. Fallback to high-precision local canvas edge detection
      if (!coloringDataUrl) {
        coloringDataUrl = await canvasEdgeDetect(imageDataUrl);
      }

      setColoringStage("排版 A4 中…");
      const excerpt = plan?.lyricExcerpt || lyrics.split("\n").filter(Boolean).slice(0, 2).join("\n");
      await downloadColoringPdf(coloringDataUrl, songTitle, excerpt, getListenUrl());
      setColoringSuccess(true);
      setTimeout(() => setColoringSuccess(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成涂色卡失败，请重试");
    } finally {
      setIsColoring(false);
    }
  }

  async function onDownloadPdf() {
    if (!imageDataUrl || isPrinting) return;
    setIsPrinting(true);
    try {
      await downloadA4Pdf(imageDataUrl, songTitle, getListenUrl());
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法导出 PDF 文件");
    } finally {
      setIsPrinting(false);
    }
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

      {/* Compact demo — 只有点击右侧按钮才载入 */}
      <section className="paper-card mb-6 overflow-hidden rounded-3xl">
        <div className="flex w-full flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/samples/ge-hui-final-sample.png"
            alt="歌绘成品示例：Head Shoulders Knees and Toes"
            className="w-full aspect-[16/10] sm:aspect-auto sm:h-28 sm:w-44 shrink-0 rounded-2xl border border-[#f0e6d4] object-contain sm:object-cover sm:object-top bg-white cursor-pointer hover:opacity-95 transition"
            onClick={() => setPreviewImageModal("/samples/ge-hui-final-sample.png")}
            title="点击放大查看高清大图"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wide text-[#ff6b2c]">成品小样</p>
            <p className="mt-0.5 text-sm font-semibold text-neutral-800">
              生成后的绘本页可以长这样
            </p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              点击右侧按钮载入这首经典儿歌，为宝贝制作同款精美绘本～
            </p>
          </div>
          <button
            type="button"
            onClick={tryDemoSong}
            className="group flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-orange-200/90 bg-white/95 px-4 py-2 text-xs font-bold text-[#c2410c] shadow-2xs transition-all duration-300 hover:border-[#ff6b2c] hover:bg-[#fff4ee] hover:shadow-xs active:scale-95 sm:self-center cursor-pointer"
          >
            <span>一键做同款 ✨</span>
            <span className="text-sm font-bold text-orange-400 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden>›</span>
          </button>
        </div>
      </section>

      {/* Two-column shell: form | sticky stage */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* LEFT: input form */}
        <section className="paper-card rounded-3xl p-5 sm:p-6">
          <label className="block text-sm font-semibold text-neutral-800">歌曲名（可选）</label>
          <input
            className="mt-2 w-full rounded-xl border border-[#f0e6d4] bg-[#fffdf8] px-3 py-2.5 text-base sm:text-sm outline-none ring-[#ff6b2c]/40 focus:ring-2 disabled:opacity-60"
            placeholder="例如 Head Shoulders Knees and Toes"
            value={songTitle}
            disabled={jobBusy}
            onChange={(e) => setSongTitle(e.target.value)}
          />

          <div className="mt-5">
            <label className="block text-sm font-semibold text-neutral-800">
              上传儿歌、绘本文件或照片
            </label>
            <label
              className={`mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-7 text-center transition ${
                dragOver
                  ? "border-[#ff6b2c] bg-[#fff4ee]"
                  : isUploading
                  ? "border-[#ff6b2c]/60 bg-[#fff4ee]/40 animate-pulse"
                  : "border-[#f0e6d4] bg-[#fffdf8] hover:border-[#1db8a6]/70 hover:bg-[#f0faf8]"
              } ${jobBusy && !isUploading ? "pointer-events-none opacity-60" : ""}`}
              onDragEnter={(e) => {
                e.preventDefault();
                if (!isUploading && !jobBusy) setDragOver(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (!isUploading && !jobBusy) setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (isUploading || jobBusy) return;
                void onPickFiles(e.dataTransfer.files);
              }}
            >
              {isUploading ? (
                <div className="flex flex-col items-center py-1">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ff6b2c]/10 text-[#ff6b2c]">
                    <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#ff6b2c] border-t-transparent" />
                  </div>
                  <span className="mt-3 text-sm font-semibold text-[#c2410c]">
                    {uploadProgressText || "正在解析文件，请稍候…"}
                  </span>
                  {fileName ? (
                    <span className="mt-1 text-xs text-neutral-500 truncate max-w-[260px]">
                      {fileName}
                    </span>
                  ) : null}
                </div>
              ) : (
                <>
                  <MusicBookIcons />
                  <span className="mt-3 text-sm font-medium text-neutral-700">
                    把儿歌、绘本文件或照片拖进来，或点击选择
                  </span>

                  {/* 清晰分类的格式卡片 */}
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[11px]">
                    <div className="flex items-center gap-1 rounded-lg border border-[#f0e6d4] bg-white px-2 py-1 text-neutral-600 shadow-2xs">
                      <span>🎵 音频：</span>
                      <span className="font-semibold text-neutral-700">MP3 · WAV · M4A · AAC · FLAC · OGG</span>
                    </div>
                    <div className="flex items-center gap-1 rounded-lg border border-[#f0e6d4] bg-white px-2 py-1 text-neutral-600 shadow-2xs">
                      <span>📖 绘本：</span>
                      <span className="font-semibold text-neutral-700">PDF 文件 · 拍照/截图 (JPG · PNG · WebP 可多选)</span>
                    </div>
                  </div>

                  {fileName ? (
                    <span className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 shadow-sm">
                      <span aria-hidden="true">✓</span>
                      <span className="truncate">已就绪：{fileName}</span>
                    </span>
                  ) : null}
                </>
              )}
              <input
                type="file"
                multiple
                accept=".mp3,.wav,.m4a,.ogg,.flac,.aac,.pdf,.jpg,.jpeg,.png,.webp"
                className="hidden"
                disabled={jobBusy}
                onChange={(e) => void onPickFiles(e.target.files)}
              />
            </label>
            {uploadTip ? (
              <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-emerald-200/90 bg-emerald-50/80 p-2.5 text-xs text-emerald-800 shadow-sm">
                <span className="text-sm shrink-0 leading-none mt-0.5">✨</span>
                <span className="leading-relaxed font-medium">{uploadTip}</span>
              </div>
            ) : null}
            
          </div>

          <div className="mt-5 flex items-center justify-between">
            <label className="text-sm font-semibold text-neutral-800 flex items-center gap-1.5">
              <span>歌词</span>
              <span className="text-[11px] font-normal text-neutral-400">（支持中英文，自动分行）</span>
            </label>
            <button
              type="button"
              disabled={jobBusy}
              onClick={() => setShowAiComposer((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full border border-orange-200/80 bg-orange-50/70 px-2.5 py-0.5 text-[11px] font-medium text-[#c2410c] transition hover:bg-[#fff4ee] hover:border-[#ff6b2c]/50"
              title="根据宝宝名字或习惯，让 AI 秒写一首押韵短童谣"
            >
              <span aria-hidden>🪄</span>
              <span>{showAiComposer ? "收起创作" : "AI 帮我写儿歌"}</span>
            </button>
          </div>

          {showAiComposer ? (
            <div className="mt-2 rounded-xl border border-orange-200/80 bg-[#fffbf7] p-2.5 transition">
              <p className="text-[11px] font-medium text-neutral-600">
                告诉 AI 宝贝的名字或小习惯，为 Ta 创作一首押韵小童谣：
              </p>
              <div className="mt-1.5 flex gap-1.5">
                <input
                  type="text"
                  maxLength={30}
                  disabled={jobBusy || isComposing}
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="如：宝宝乐乐不肯刷牙 / 喜欢大恐龙"
                  className="flex-1 rounded-lg border border-[#f0e6d4] bg-white px-2.5 py-1 text-base sm:text-xs outline-none ring-[#ff6b2c]/40 focus:ring-1 text-neutral-700 placeholder:text-neutral-400"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void onComposeRhyme();
                  }}
                />
                <button
                  type="button"
                  disabled={jobBusy || isComposing || !aiTopic.trim()}
                  onClick={() => void onComposeRhyme()}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#ff6b2c] px-3 py-1 text-xs font-semibold text-white transition hover:bg-[#ef5a1a] disabled:opacity-50 whitespace-nowrap shadow-2xs"
                >
                  {isComposing ? (
                    <>
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>写歌中…</span>
                    </>
                  ) : (
                    <span>生成</span>
                  )}
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-2 flex items-center justify-between gap-1 text-[11px]">
            <div className="flex items-center gap-1 text-neutral-400 shrink-0">
              <span aria-hidden>💡</span>
              <span>试试经典：</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {currentPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  disabled={jobBusy}
                  onClick={() => void applySongPreset(preset)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#f0e6d4] bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-700 transition hover:border-[#ff6b2c]/50 hover:bg-[#fff7f2] hover:text-[#c2410c] shadow-2xs whitespace-nowrap"
                  title={preset.tag}
                >
                  <span aria-hidden>{preset.icon}</span>
                  <span>{preset.title.split("(")[0].trim().slice(0, 10)}</span>
                </button>
              ))}
              <button
                type="button"
                disabled={jobBusy}
                onClick={() => setInspirationBatch((v) => v + 1)}
                className="inline-flex items-center gap-0.5 text-[11px] text-neutral-400 hover:text-[#c2410c] transition ml-1"
                title="换另外3首经典儿歌"
              >
                <span>换一批</span>
                <span aria-hidden>🔄</span>
              </button>
            </div>
          </div>
          <textarea
            className="mt-2 min-h-[140px] w-full resize-y rounded-2xl border border-[#f0e6d4] bg-[#fffdf8] px-3 py-3 text-base sm:text-sm leading-relaxed outline-none ring-[#ff6b2c]/40 focus:ring-2 disabled:opacity-60"
            placeholder="把歌词粘贴在这里，或上传文件自动整理…"
            value={lyrics}
            disabled={jobBusy}
            onChange={(e) => setLyrics(e.target.value)}
          />
          {needsVision && (pendingUploadId || pendingPdfBase64) ? (
            <p className="mt-2 text-xs leading-relaxed text-neutral-500">
              已记住这份绘本。生成时会看最后一页歌词和角色页，再合成一张歌绘～
            </p>
          ) : null}

          {/* 画面定制（可选芯片） */}
          <div className="mt-4 rounded-2xl border border-[#f0e6d4] bg-[#fffdf8] p-3.5 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                <span>🎨</span> 画面定制（可选）
              </span>
              <span className="text-[11px] text-neutral-400 font-medium">给画师的小贴士 ✨</span>
            </div>

            {/* 出镜角色 */}
            <div className="mt-3">
              <p className="text-[11px] font-medium text-neutral-500 mb-1.5">出镜角色</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "default", label: "跟随绘本 (默认)" },
                  { id: "solo", label: "只要主角" },
                  { id: "all", label: "小伙伴都在" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={jobBusy}
                    onClick={() => setRoleScope(item.id as "default" | "solo" | "all")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      roleScope === item.id
                        ? "border border-orange-300/90 bg-orange-50/90 text-orange-900 font-bold shadow-2xs"
                        : "border border-[#f0e6d4] bg-white text-neutral-600 hover:border-[#ff6b2c]/40 hover:bg-[#fff4ee]/50"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 画面风格 */}
            <div className="mt-3">
              <p className="text-[11px] font-medium text-neutral-500 mb-1.5">画面质感</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "default", label: "绘本原画 (默认)" },
                  { id: "crayon", label: "蜡笔童趣风" },
                  { id: "clay", label: "立体彩泥/剪纸" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={jobBusy}
                    onClick={() => setArtStyle(item.id as "default" | "crayon" | "clay")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      artStyle === item.id
                        ? "border border-orange-300/90 bg-orange-50/90 text-orange-900 font-bold shadow-2xs"
                        : "border border-[#f0e6d4] bg-white text-neutral-600 hover:border-[#ff6b2c]/40 hover:bg-[#fff4ee]/50"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 补充愿望 */}
            <div className="mt-3">
              <input
                type="text"
                maxLength={40}
                disabled={jobBusy}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="想让画面里发生什么？如：在温暖的阳光草地上、大家一起吃西瓜（限40字）"
                className="w-full rounded-xl border border-[#f0e6d4] bg-white px-3 py-2 text-base sm:text-xs outline-none ring-[#ff6b2c]/40 focus:ring-1 text-neutral-700 placeholder:text-neutral-400"
              />
            </div>
          </div>

          <button
            type="button"
            className="btn-disclosure mt-4"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
          >
            <span>更多小设置</span>
            <span
              className={`inline-block text-neutral-400 transition ${showAdvanced ? "rotate-180" : ""}`}
              aria-hidden
            >
              ⌄
            </span>
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

          {/* 模型未就绪时的温馨提示卡（数据加载中时不提前报虚警） */}
          {!modelsLoading && !isBothModelsReady && !jobBusy ? (
            <div className="mb-2 rounded-2xl border border-amber-200/80 bg-amber-50/90 p-3.5 text-center text-xs text-amber-800 shadow-xs">
              <span className="font-semibold">温馨提示：</span>
              {!isChatReady && !isImageReady
                ? "画室今天还没开门，请联系管理员老师检查服务配置哦～"
                : !isChatReady
                ? "听歌构思的小伙伴还没准备好呢，请联系管理员老师开通听歌功能～"
                : "画画的小伙伴还没准备好呢，请联系管理员老师开通画画功能～"}
            </div>
          ) : null}

          {/* 每日免费额度与防白嫖指示 */}
          <div className="flex items-center justify-between text-[11px] text-neutral-400 px-1 mb-1 mt-4">
            <span className="flex items-center gap-1.5 flex-wrap">
              <span>
                今日免费：<strong className="text-neutral-700">{quota?.freeRemainingToday ?? 3}</strong> / {quota?.freeDailyMax ?? 3} 次 (0点重置)
              </span>
              {(quota?.paidRemaining ?? 0) > 0 ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 border border-emerald-200/80">
                  创作包剩余 {quota?.paidRemaining} 次
                </span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() => setShowQuotaModal(true)}
              className="text-[#c2410c] hover:underline font-medium cursor-pointer"
            >
              获取更多创作次数 ▾
            </button>
          </div>

          <button
            type="button"
            disabled={jobBusy || (!lyrics.trim() && isBothModelsReady)}
            onClick={!isBothModelsReady ? handleModelMissingClick : onGenerate}
            className={`w-full flex items-center justify-center gap-2 h-11 rounded-2xl bg-gradient-to-r from-[#ff7d44] via-[#f97336] to-[#f05c1e] text-white font-bold text-sm tracking-wide shadow-md shadow-orange-500/20 hover:opacity-95 active:scale-[0.99] transition-all mt-3 ${
              !isBothModelsReady
                ? "bg-neutral-300 hover:bg-neutral-400 text-neutral-700 shadow-none cursor-pointer"
                : ""
            } ${
              jobBusy || (!lyrics.trim() && isBothModelsReady) ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {jobBusy ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>正在一页一页画…</span>
              </>
            ) : modelsLoading ? (
              <span>画室准备中…</span>
            ) : !isBothModelsReady ? (
              <span>
                {!isChatReady && !isImageReady
                  ? "小画家们正在赶来的路上…（点击查看）"
                  : !isChatReady
                  ? "听歌的小伙伴还没就位哦（点击查看）"
                  : "画画的小伙伴还没就位哦（点击查看）"}
              </span>
            ) : (
              <span>生成歌绘本</span>
            )}
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
                className="btn-secondary mt-2"
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
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold text-neutral-800">绘本小舞台</h2>
                {isSampleMode ? (
                  <span className="rounded-full border border-orange-200/90 bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-[#c2410c]">
                    官方精选展厅
                  </span>
                ) : null}
              </div>

              {/* 右上角常驻双功能小胶囊：官方精选 (12) 与 我的画册 (N) */}
              <div className="flex items-center gap-1.5">
                {/* 1. 官方精选展厅切换 */}
                <button
                  type="button"
                  onClick={() => {
                    if (isSampleMode) {
                      closeSampleGallery();
                    } else {
                      openSampleGallery();
                    }
                  }}
                  className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-semibold shadow-2xs transition cursor-pointer ${
                    isSampleMode
                      ? "border-[#ff6b2c] bg-orange-50 text-[#c2410c] font-bold"
                      : "border-[#f0e6d4] bg-white text-neutral-700 hover:border-orange-300 hover:bg-[#fff7f2]"
                  }`}
                  title="随时查看12套官方世界经典样板"
                >
                  <span aria-hidden>📚</span>
                  <span>{isSampleMode ? "收起展厅" : "官方精选 (12)"}</span>
                </button>

                {/* 2. 我的画册 */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (historyList.length === 0) {
                        setUploadTip("💡 还没有生成记录哦，左侧做一张绘本就会自动为您保存在这里～");
                        return;
                      }
                      setShowHistoryDrawer((v) => !v);
                    }}
                    className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-semibold shadow-2xs transition cursor-pointer ${
                      historyList.length > 0
                        ? "border-[#f0e6d4] bg-white text-neutral-700 hover:border-[#ff6b2c]/50 hover:bg-[#fff7f2]"
                        : "border-[#f0e6d4]/60 bg-white/70 text-neutral-400"
                    }`}
                    title="查看本地保存的全部绘本画作"
                  >
                    <span aria-hidden>🕓</span>
                    <span>画册 {historyList.length > 0 ? `(${historyList.length})` : ""}</span>
                    {historyList.length > 0 ? <span className="text-[10px] text-neutral-400">▾</span> : null}
                  </button>

                  {/* 历史画册抽屉 */}
                  {showHistoryDrawer && historyList.length > 0 ? (
                    <div className="absolute right-0 top-9 z-30 w-72 rounded-2xl border border-[#f0e6d4] bg-white p-3 shadow-xl">
                      <div className="flex items-center justify-between border-b border-[#f0e6d4]/60 pb-2">
                        <span className="text-xs font-bold text-neutral-800">
                          我的创作历史 (点击即复原)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            clearBookHistory();
                            setHistoryList([]);
                            setShowHistoryDrawer(false);
                          }}
                          className="text-[11px] text-neutral-400 hover:text-rose-500 cursor-pointer"
                        >
                          清空
                        </button>
                      </div>
                      <div className="mt-2.5 max-h-60 space-y-1.5 overflow-y-auto pr-1">
                        {historyList.map((hist) => (
                          <div
                            key={hist.id}
                            onClick={() => restoreHistoryBook(hist)}
                            className="flex items-center gap-2.5 rounded-xl border border-[#f0e6d4]/70 p-2 cursor-pointer hover:border-[#ff6b2c]/60 hover:bg-[#fff7f2] transition group"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={hist.imageDataUrl}
                              alt={hist.songTitle}
                              className="h-10 w-14 rounded-lg object-cover border border-neutral-100 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="line-clamp-1 text-xs font-bold text-neutral-800 group-hover:text-[#c2410c]">
                                {hist.songTitle}
                              </p>
                              <p className="text-[10px] text-neutral-400 mt-0.5">
                                点击切回此版本并导出
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {step === "idle" && !imageDataUrl && !error ? (
              <div className="rounded-2xl border border-[#f0e6d4] bg-[#fffdf8] p-5 text-center shadow-xs transition">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-2xl border border-orange-100">
                  🎨
                </div>
                <h3 className="mt-3 text-base font-bold text-neutral-800">
                  期待宝贝的专属绘本诞生～
                </h3>
                <p className="mt-1 text-xs text-neutral-500 max-w-xs mx-auto leading-relaxed">
                  在左侧填入儿歌或上传歌曲，AI 将为宝宝量身构思独一无二的分镜插画
                </p>

                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-[#f0e6d4]" />
                  <span className="text-[11px] font-medium text-neutral-400">或者 · 没时间自己做？</span>
                  <div className="h-px flex-1 bg-[#f0e6d4]" />
                </div>

                <div className="rounded-xl border border-orange-100 bg-white/80 p-3.5 text-center">
                  <p className="text-xs font-bold text-neutral-800 flex items-center justify-center gap-1">
                    <span>📚</span> 官方精选经典绘本（12套世界名曲）
                  </p>
                  <p className="mt-1 text-[11px] text-neutral-500 leading-relaxed">
                    涵盖两只老虎、小星星、拍手歌等高清大图与伴唱码 · 无需等待直接免费打印
                  </p>
                  <button
                    type="button"
                    onClick={openSampleGallery}
                    className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#ff6b2c] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#ef5a1a] transition hover:scale-[1.02] active:scale-95 cursor-pointer"
                  >
                    <span>📖</span>
                    <span>打开精选绘本展厅 · 开箱即打印带走</span>
                    <span aria-hidden>➔</span>
                  </button>
                </div>
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
                {/* 绘本大图：手机端支持左右滑动手势切歌，点击放大预览 */}
                <div
                  className="relative touch-pan-y group cursor-pointer"
                  onClick={() => setPreviewImageModal(imageDataUrl)}
                  title="点击查看全屏高清大图"
                  onTouchStart={(e) => {
                    touchStartXRef.current = e.touches[0]?.clientX ?? null;
                  }}
                  onTouchEnd={(e) => {
                    if (touchStartXRef.current === null) return;
                    const endX = e.changedTouches[0]?.clientX ?? null;
                    if (endX !== null) {
                      const deltaX = endX - touchStartXRef.current;
                      if (deltaX > 45 && isSampleMode) {
                        prevSample();
                      } else if (deltaX < -45 && isSampleMode) {
                        nextSample();
                      }
                    }
                    touchStartXRef.current = null;
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={imageDataUrl}
                    src={imageDataUrl}
                    alt="生成的歌绘本页"
                    className="w-full aspect-[3/2] object-cover rounded-2xl border border-[#f0e6d4] bg-white shadow-sm transition-all duration-300 animate-in fade-in"
                  />
                  {/* 放大看原图悬浮提示 */}
                  <div className="absolute top-2.5 right-2.5 rounded-full bg-white/90 border border-neutral-200/80 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 shadow-2xs backdrop-blur-xs flex items-center gap-1 group-hover:bg-white group-hover:border-[#ff6b2c]/60 group-hover:text-[#c2410c] transition">
                    <ZoomInIcon className="w-3.5 h-3.5" />
                    <span>查看大图</span>
                  </div>
                  {isSampleMode ? (
                    <div className="absolute bottom-2.5 left-2.5 rounded-full bg-black/50 backdrop-blur-xs px-2.5 py-0.5 text-[10px] text-white/90 sm:hidden pointer-events-none">
                      👈 左右滑动切歌 👉
                    </div>
                  ) : null}
                </div>

                {/* 样板模式专属：沉浸式翻书导览栏（置于大画正下方） */}
                {isSampleMode ? (
                  <div className="flex flex-col gap-2 rounded-2xl border border-[#f0e6d4]/90 bg-[#fffdf8] p-2.5 sm:px-3.5 sm:py-2.5 shadow-2xs transition">
                    {/* 上排：清晰曲名、展厅序号、以及原声伴唱播放喇叭 */}
                    <div className="flex items-center justify-between px-1 gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[#ff6b2c] shrink-0">🎵</span>
                        <span className="text-xs font-bold text-neutral-800 truncate max-w-[150px] sm:max-w-xs">
                          {SAMPLE_BOOKS[sampleCarouselIndex]?.title || "官方绘本"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* 原声儿歌伴唱喇叭按钮 */}
                        {SAMPLE_BOOKS[sampleCarouselIndex]?.sampleAudio ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePlayAudio();
                            }}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition shadow-2xs active:scale-95 cursor-pointer ${
                              isPlayingAudio
                                ? "bg-orange-500 text-white shadow-orange-500/25 ring-2 ring-orange-300"
                                : "bg-white border border-[#f0e6d4] text-neutral-700 hover:border-orange-300 hover:bg-[#fff8f3] hover:text-[#c2410c]"
                            }`}
                            title={isPlayingAudio ? "点击暂停原声伴唱" : "点击播放高清原声伴唱"}
                          >
                            <SpeakerIcon className="w-3.5 h-3.5" playing={isPlayingAudio} />
                            <span>{isPlayingAudio ? "播放中" : "听儿歌"}</span>
                          </button>
                        ) : null}

                        <span className="rounded-full bg-orange-100/70 border border-orange-200/60 px-2 py-0.5 text-[10px] font-bold text-[#c2410c]">
                          {sampleCarouselIndex + 1} / {SAMPLE_BOOKS.length} 套
                        </span>
                      </div>
                    </div>

                    {/* 下排：胶囊翻页按钮与导览珍珠 */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#f0e6d4]/50">
                      <button
                        type="button"
                        onClick={prevSample}
                        className="group inline-flex items-center gap-1 rounded-xl border border-[#e5ded4] bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 shadow-2xs hover:border-[#ff6b2c]/60 hover:bg-[#fff8f3] hover:text-[#c2410c] transition cursor-pointer active:scale-95 shrink-0"
                        title="翻看上一首"
                      >
                        <span className="text-[11px] font-bold text-neutral-400 group-hover:text-[#c2410c]">‹</span>
                        <span>上一本</span>
                      </button>

                      {/* 珍珠导览点 */}
                      <div className="flex items-center gap-1 overflow-x-auto max-w-[140px] sm:max-w-none px-1 py-0.5">
                        {SAMPLE_BOOKS.map((b, i) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => {
                              setSampleCarouselIndex(i);
                              applySampleBook(SAMPLE_BOOKS[i]);
                            }}
                            className={`transition-all duration-300 rounded-full cursor-pointer shrink-0 ${
                              sampleCarouselIndex === i
                                ? "h-2 w-4 bg-[#ff6b2c]"
                                : "h-1.5 w-1.5 bg-[#f0e6d4] hover:bg-orange-300"
                            }`}
                            title={b.title}
                            aria-label={`翻到第 ${i + 1} 本：${b.title}`}
                          />
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={nextSample}
                        className="group inline-flex items-center gap-1 rounded-xl border border-[#e5ded4] bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 shadow-2xs hover:border-[#ff6b2c]/60 hover:bg-[#fff8f3] hover:text-[#c2410c] transition cursor-pointer active:scale-95 shrink-0"
                        title="翻看下一首"
                      >
                        <span>下一本</span>
                        <span className="text-[11px] font-bold text-neutral-400 group-hover:text-[#c2410c]">›</span>
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* 载入定制桥梁 */}
                {isSampleMode ? (
                  <div className="flex items-center justify-between rounded-xl border border-dashed border-orange-200/90 bg-[#fffbf7] px-3.5 py-2 text-xs">
                    <span className="text-neutral-600 text-[11px]">
                      喜欢这首歌？可以载入左侧，定制成您家宝宝专属的主角形象～
                    </span>
                    <button
                      type="button"
                      onClick={() => adoptSampleForCustomization(SAMPLE_BOOKS[sampleCarouselIndex])}
                      className="font-bold text-[#c2410c] hover:underline whitespace-nowrap text-xs flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>✍️ 载入定制</span>
                      <span>➔</span>
                    </button>
                  </div>
                ) : null}
                {/* 操作栏：手机端自适应两排网格（3列+3列完整可见、绝不横向溢出），电脑端单排展示 */}
                <div className="grid grid-cols-3 gap-2 pt-2 sm:flex sm:items-center sm:justify-between sm:gap-1.5">
                  {/* 1. 重画 */}
                  <button
                    type="button"
                    disabled={jobBusy || isPrinting || isColoring}
                    onClick={onNewGenerate}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#e5ded4] bg-white px-2 h-9 text-xs font-semibold text-neutral-700 transition hover:border-[#ff6b2c]/60 hover:bg-[#fff7f2] hover:text-[#c2410c] shadow-2xs disabled:opacity-50 whitespace-nowrap active:scale-95 cursor-pointer w-full sm:w-auto"
                    title="保留当前歌词，换个构图重画一张"
                  >
                    <RefreshIcon className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                    <span>重画</span>
                  </button>

                  {/* 2. 存图 */}
                  <button
                    type="button"
                    disabled={isPrinting || isColoring}
                    onClick={onDownload}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#e5ded4] bg-white px-2 h-9 text-xs font-semibold text-neutral-700 transition hover:border-[#ff6b2c]/60 hover:bg-[#fff7f2] hover:text-[#c2410c] shadow-2xs disabled:opacity-50 whitespace-nowrap active:scale-95 cursor-pointer w-full sm:w-auto"
                    title="下载高清绘本图片 (PNG)"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                    <span>存图</span>
                  </button>

                  {/* 3. 涂色卡 */}
                  <button
                    type="button"
                    disabled={isPrinting || isColoring}
                    onClick={() => void onDownloadColoring()}
                    className={`inline-flex items-center justify-center gap-1 rounded-xl border px-2 h-9 text-xs font-semibold shadow-2xs disabled:opacity-50 whitespace-nowrap transition active:scale-95 cursor-pointer w-full sm:w-auto ${
                      coloringSuccess
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700 font-bold"
                        : "border-[#e5ded4] bg-white text-neutral-700 hover:border-[#ff6b2c]/60 hover:bg-[#fff7f2] hover:text-[#c2410c]"
                    }`}
                    title="一键提取黑白线稿并合成 A4 涂色卡，支持蜡笔涂鸦与描红"
                  >
                    {isColoring ? (
                      <>
                        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#ff6b2c] border-t-transparent" />
                        <span className="truncate">{coloringStage}</span>
                      </>
                    ) : coloringSuccess ? (
                      <>
                        <span aria-hidden>✓</span>
                        <span>已导出</span>
                      </>
                    ) : (
                      <>
                        <PencilIcon className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                        <span>涂色卡</span>
                      </>
                    )}
                  </button>

                  {/* 4. 存为 PDF */}
                  <button
                    type="button"
                    disabled={isPrinting || isColoring}
                    onClick={() => void onDownloadPdf()}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#e5ded4] bg-white px-2 h-9 text-xs font-semibold text-neutral-700 transition hover:border-[#ff6b2c]/60 hover:bg-[#fff7f2] hover:text-[#c2410c] shadow-2xs disabled:opacity-50 whitespace-nowrap active:scale-95 cursor-pointer w-full sm:w-auto"
                    title="直接下载标准的 A4 PDF 文件，专为打印贴墙设计"
                  >
                    {isPrinting ? (
                      <>
                        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#ff6b2c] border-t-transparent" />
                        <span>生成中…</span>
                      </>
                    ) : (
                      <>
                        <PdfFileIcon className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                        <span>存为 PDF</span>
                      </>
                    )}
                  </button>

                  {/* 5. 打印 */}
                  <button
                    type="button"
                    disabled={isPrinting || isColoring}
                    onClick={() => void onPrintA4()}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#e5ded4] bg-white px-2 h-9 text-xs font-semibold text-neutral-700 transition hover:border-[#ff6b2c]/60 hover:bg-[#fff7f2] hover:text-[#c2410c] shadow-2xs disabled:opacity-50 whitespace-nowrap active:scale-95 cursor-pointer w-full sm:w-auto"
                    title="调起系统打印机即刻出纸"
                  >
                    <PrintIcon className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                    <span>打印</span>
                  </button>

                  {/* 6. 打赏 */}
                  <button
                    type="button"
                    onClick={() => setShowTip(true)}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#e5ded4] bg-white px-2 h-9 text-xs font-semibold text-neutral-700 transition hover:border-[#ff6b2c]/60 hover:bg-[#fff7f2] hover:text-[#c2410c] shadow-2xs whitespace-nowrap active:scale-95 cursor-pointer w-full sm:w-auto"
                    title="喜欢歌绘可以打赏请作者喝杯奶茶哦～"
                  >
                    <TeaCupIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>请杯奶茶</span>
                  </button>
                </div>

                {/* 分镜构思与台词折叠栏（友好图文排版，告别生硬 JSON） */}
                {plan ? (
                  <details className="rounded-2xl border border-[#f0e6d4] bg-[#fffdf8] px-4 py-3 text-xs text-neutral-600 transition">
                    <summary className="cursor-pointer select-none font-semibold text-neutral-700 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span aria-hidden>🎭</span>
                        <span>画面分镜构思与角色台词</span>
                      </span>
                      <span className="text-[11px] text-neutral-400 font-normal">点击展开/收起</span>
                    </summary>
                    <div className="mt-3 space-y-2.5 pt-2 border-t border-[#f0e6d4]/60">
                      {plan.characterDescription ? (
                        <p className="text-neutral-700 leading-relaxed">
                          <strong className="text-neutral-800">出镜角色：</strong>
                          {plan.characterDescription}
                        </p>
                      ) : null}
                      {Array.isArray(plan.panels) && plan.panels.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {plan.panels.map((p, idx) => (
                            <div key={idx} className="rounded-xl border border-orange-100 bg-white p-2.5 shadow-2xs">
                              <div className="flex items-center justify-between text-[11px] font-bold text-[#c2410c]">
                                <span>分镜 {idx + 1}</span>
                                <span className="font-normal text-neutral-500">{p.labelEn}</span>
                              </div>
                              <p className="mt-1 font-medium text-neutral-800">{p.labelZh}</p>
                              {p.action ? <p className="mt-0.5 text-[11px] text-neutral-500">动作：{p.action}</p> : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </details>
                ) : null}
                
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

      {/* 底部居中文案（预留底部安全边距，避免被右下角浮钮遮挡视线） */}
      <footer className="mt-12 mb-6 w-full text-center px-4 space-y-1">
        <p className="text-xs text-neutral-400 font-medium">歌绘 · 一页启蒙绘本</p>
        <p className="text-xs text-neutral-400">适合睡前、英语角，或打印贴在墙上一起唱。</p>
      </footer>

      {/* 右下角智能抽屉呼吸按钮：平时微呼吸圆钮，悬停丝滑展开文字，离开收缩 */}
      {!showTip ? (
        <button
          type="button"
          onClick={() => setShowTip(true)}
          className="group fixed bottom-5 right-5 z-40 flex h-11 items-center rounded-full border border-orange-200/90 bg-white/95 px-3 shadow-lg shadow-orange-950/10 backdrop-blur-xs transition-all duration-300 ease-out hover:shadow-orange-300/40 hover:border-[#ff6b2c]/60 hover:bg-[#fff8f3] sm:bottom-7 sm:right-7"
          aria-label="请杯奶茶"
          title="喜欢歌绘可以请作者喝杯奶茶哦～"
        >
          {/* 图标与轻柔微呼吸动效（SVG矢量，全平台不乱码） */}
          <span className="transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6 flex items-center" aria-hidden>
            <TeaCupIcon className="w-5 h-5" />
          </span>

          {/* 抽屉文字：默认宽度为0溢出隐藏，悬停时平滑展开 */}
          <span className="max-w-0 overflow-hidden whitespace-nowrap text-xs font-bold text-neutral-700 opacity-0 transition-all duration-300 ease-out group-hover:max-w-xs group-hover:pl-2 group-hover:opacity-100 group-hover:text-[#c2410c]">
            请作者喝杯奶茶
          </span>
        </button>
      ) : null}
      {/* 每日额度满额 / 获取更多创作次数 · 人工发卡弹窗 */}
      {showQuotaModal ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-xs"
            aria-label="关闭弹窗"
            onClick={() => setShowQuotaModal(false)}
          />
          <div
            className="relative z-10 w-full max-w-sm rounded-3xl border border-[#f0e6d4] bg-white p-5 sm:p-6 shadow-2xl text-center max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-label="获取更多绘本创作次数"
          >
            <button
              type="button"
              className="absolute right-3.5 top-3.5 flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 cursor-pointer"
              aria-label="关闭弹窗"
              onClick={() => setShowQuotaModal(false)}
            >
              ✕
            </button>

            <span className="text-3xl" aria-hidden>🌟</span>
            <h3 className="mt-1 text-lg font-bold text-neutral-800">获取更多绘本创作次数</h3>
            <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
              为保障服务器稳定，每个浏览器设备每天赠送 3 次免费生成，次日 0 点重置～
            </p>

            {/* 路径 1：人工微信发卡 */}
            <div className="mt-4 rounded-2xl border border-orange-200/80 bg-orange-50/70 p-3.5 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-800 flex items-center gap-1">
                  <span>⚡</span> 支持者创作包 · 6.6 元
                </span>
                <span className="rounded-full bg-[#ff6b2c] px-2 py-0.5 text-[10px] font-bold text-white">
                  20次 / 90天
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-neutral-600 leading-relaxed">
                扫码添加作者微信（<strong>牵猫散步的鱼</strong>），付款后将为您<strong>人工发送专属一客一码卡密</strong>：
              </p>

              <div className="mt-3 rounded-2xl border border-orange-100/90 bg-white p-2.5 text-center shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/payments/wechat-contact.jpg"
                  alt="作者微信二维码：牵猫散步的鱼"
                  className="mx-auto h-52 w-52 rounded-xl object-contain"
                />
                <p className="mt-2 text-[11px] font-medium text-neutral-600">
                  扫一扫添加微信 · 备注「歌绘创作包」
                </p>
                <p className="mt-0.5 text-[10px] text-neutral-400">
                  人工核对后发送激活卡密，遇到使用问题也可随时联系作者
                </p>
              </div>

              {/* 卡密输入与立即核销 */}
              <div className="mt-3">
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  已拿到卡密？在此输入激活：
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={vipCodeInput}
                    onChange={(e) => setVipCodeInput(e.target.value)}
                    placeholder="粘贴获得的卡密（如：GH1-XXXX-XXXX...）"
                    className="flex-1 rounded-xl border border-[#f0e6d4] bg-white px-2.5 py-2 text-base sm:text-xs outline-none ring-[#ff6b2c]/40 focus:ring-1 text-neutral-700 placeholder:text-neutral-400 font-mono"
                  />
                  <button
                    type="button"
                    disabled={isRedeeming || !vipCodeInput.trim()}
                    onClick={() => void onRedeemVipCode()}
                    className="rounded-xl bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-900 disabled:opacity-50 whitespace-nowrap transition cursor-pointer"
                  >
                    {isRedeeming ? "校验中…" : "立即激活"}
                  </button>
                </div>

                {/* 方案 C：复制多设备一键同步链接 */}
                {vipCodeInput.trim() ? (
                  <div className="mt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={copyMagicSyncLink}
                      className="text-[11px] text-[#ff6b2c] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>🔗</span>
                      <span>复制跨设备免密同步链接</span>
                    </button>
                    {copyFeedback ? (
                      <span className="text-[10px] text-emerald-700 font-medium">
                        {copyFeedback}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {redeemMsg ? (
                <p className={redeemMsg.includes("成功") ? "mt-1.5 text-[11px] font-medium text-emerald-700" : "mt-1.5 text-[11px] font-medium text-rose-600"}>
                  {redeemMsg}
                </p>
              ) : null}

              <p className="mt-2 text-[10px] text-neutral-400 leading-relaxed">
                * 支持<strong>最多 3 台常用设备</strong>共享（手机微信/浏览器/电脑）；多设备共享 20 次付费池，各设备每天仍有 3 次独立免费额度～
              </p>
            </div>

            {/* 路径 2：完全免费畅玩样板 */}
            <div className="mt-3 rounded-2xl border border-neutral-200/80 bg-neutral-50/80 p-3 text-left">
              <span className="text-xs font-bold text-neutral-700 flex items-center gap-1">
                <span>🎁</span> 免费通道 · 畅玩精选样板
              </span>
              <p className="mt-1 text-[11px] text-neutral-500 leading-relaxed">
                页面右上方的 12 套世界经典绘本依然<strong>完全免费、无限制导出</strong>！随时可下载 A4 高清挂画、黑白涂色卡与伴唱码～
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {showTip ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          {/* 半透明毛玻璃遮罩 */}
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-xs transition-opacity"
            aria-label="关闭打赏弹窗"
            onClick={() => setShowTip(false)}
          />

          {/* 亲子质感弹窗卡片 */}
          <div
            className="relative z-10 w-full max-w-xs overflow-hidden rounded-3xl border border-[#f0e6d4] bg-white p-6 shadow-2xl text-center transition-all scale-100"
            role="dialog"
            aria-modal="true"
            aria-label="请作者喝杯奶茶"
          >
            {/* 右上角圆形极简关闭叉叉 */}
            <button
              type="button"
              className="absolute right-3.5 top-3.5 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 transition hover:bg-neutral-200 hover:text-neutral-700 focus:outline-none"
              onClick={() => setShowTip(false)}
              aria-label="关闭"
              title="关闭 (Esc)"
            >
              <span className="text-sm font-bold">✕</span>
            </button>

            {/* 顶部标题与亲切微提示 */}
            <div className="pt-1">
              <span className="inline-flex items-center justify-center p-2 rounded-2xl bg-orange-50 mb-1.5 animate-bounce" aria-hidden>
                <TeaCupIcon className="w-8 h-8" />
              </span>
              <h3 className="font-display text-lg font-bold text-neutral-800">
                请作者喝杯奶茶
              </h3>
              <p className="mt-1 text-xs text-neutral-500">
                喜欢歌绘就好啦 · 微信扫码自愿打赏
              </p>
            </div>

            {/* 中间二维码卡片（精致双层内衬边框） */}
            <div className="mt-4 rounded-2xl border border-orange-100/80 bg-gradient-to-b from-[#fff8f3] to-white p-3 shadow-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/samples/ge-hui-tip-qr-clean.png"
                alt="微信打赏收款码"
                className="mx-auto h-48 w-48 rounded-xl object-contain shadow-xs"
              />
            </div>

            {/* 底部温馨小贴士（干净清爽，不再残留无意义文案） */}
            <p className="mt-3.5 text-[11px] text-neutral-400">
              长按或扫一扫 · 感谢支持歌绘持续进化～
            </p>
          </div>
        </div>
      ) : null}

      {/* 绘本大图高清沉浸式全屏预览灯箱 (Lightbox) */}
      {previewImageModal ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <button
            type="button"
            className="absolute inset-0 w-full h-full cursor-zoom-out"
            aria-label="关闭原图预览"
            onClick={() => setPreviewImageModal(null)}
          />

          <div className="relative z-10 max-h-[94vh] max-w-5xl w-full flex flex-col items-center">
            {/* 右上角关闭按钮 */}
            <button
              type="button"
              onClick={() => setPreviewImageModal(null)}
              className="absolute -top-12 right-0 sm:right-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-xs transition cursor-pointer text-lg"
              title="关闭 (Esc)"
              aria-label="关闭全屏预览"
            >
              ✕
            </button>

            {/* 高清图片 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImageModal}
              alt="全屏高清绘本大图"
              className="max-h-[82vh] w-auto max-w-full rounded-2xl border border-white/20 bg-white object-contain shadow-2xl animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            />

            {/* 底部浮动工具条 */}
            <div className="mt-3 flex items-center gap-3">
              <span className="text-xs text-white/80 font-medium hidden sm:inline">
                高清大图 · 点击空白或右上角关闭
              </span>
              <button
                type="button"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = previewImageModal;
                  a.download = `${(songTitle || "ge-hui").replace(/[^\w一-鿿-]+/g, "_") || "ge-hui"}-preview.png`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#ff6b2c] hover:bg-[#ef5a1a] px-4 py-1.5 text-xs font-bold text-white shadow-md active:scale-95 transition cursor-pointer"
              >
                <span>💾 保存到本地</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}