"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Props = {
  params: Promise<{ id: string }>;
};

export default function MobilePlayerPage({ params }: Props) {
  const { id } = use(params);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [title, setTitle] = useState("启蒙儿歌伴读");
  const [lyrics, setLyrics] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Attempt to load associated job metadata, or fallback to audio metadata JSON
  useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      try {
        // 1. First try reading from jobs (if id is a jobId or server is still warm)
        const jobRes = await fetch(`/api/jobs/${id}`);
        if (jobRes.ok) {
          const data = await jobRes.json();
          if (!cancelled && data.job?.result) {
            const r = data.job.result;
            if (r.songTitle) setTitle(r.songTitle);
            if (r.lyrics) setLyrics(r.lyrics);
            if (r.imageDataUrl) setCoverUrl(r.imageDataUrl);
            return;
          }
        }
      } catch {
        // next
      }

      // 2. Fallback: read directly from persistent audio metadata
      try {
        const audioMetaRes = await fetch(`/api/audio/${id}?meta=1`);
        if (audioMetaRes.ok) {
          const data = await audioMetaRes.json();
          if (!cancelled && data.meta) {
            if (data.meta.songTitle) setTitle(data.meta.songTitle);
            if (data.meta.lyrics) setLyrics(data.meta.lyrics);
          }
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadMeta();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      el.play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          setError("请轻触中间播放按钮开始听歌～");
        });
    }
  }

  function formatTime(s: number): string {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-between bg-gradient-to-b from-[#fff8f3] via-[#fffdf8] to-[#f4f8f7] px-5 py-6 font-sans text-neutral-800">
      <audio
        ref={audioRef}
        src={`/api/audio/${id}`}
        preload="auto"
        loop
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => setIsPlaying(false)}
        onError={() => setError("这首绘本暂未上传伴奏音频，快打开原曲一起给宝贝唱吧～")}
      />

      {/* Top Header */}
      <header className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200/80 bg-orange-50 px-3 py-1 text-xs font-semibold text-[#c2410c]">
          <span aria-hidden>🎵</span>
          <span>歌绘 · 纸上点读伴唱</span>
        </span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-neutral-900">
          {title}
        </h1>
        <p className="mt-1 text-xs text-neutral-500">
          贴在墙面每天看 · 手机放桌上跟着唱 🎶
        </p>
      </header>

      {/* Center Showcase: Animated Vinyl / Cover Card */}
      <main className="my-auto flex flex-col items-center py-4">
        <div
          onClick={togglePlay}
          className={`group relative flex h-48 w-48 cursor-pointer items-center justify-center rounded-3xl border-4 border-white bg-gradient-to-tr from-[#ffe4c8] to-[#c8f0e8] p-3 shadow-xl transition active:scale-95 sm:h-56 sm:w-56 ${
            isPlaying ? "ring-4 ring-[#ff6b2c]/30" : ""
          }`}
        >
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt="绘本画面"
              className="h-full w-full rounded-2xl object-cover shadow-inner"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-center">
              <span className={`text-6xl transition duration-500 ${isPlaying ? "scale-110 animate-pulse" : ""}`}>
                🧸
              </span>
              <span className="mt-2 text-xs font-semibold text-neutral-600">
                {isPlaying ? "正在伴唱中…" : "轻触立即放歌"}
              </span>
            </div>
          )}

          {/* Floating play state overlay badge */}
          <div className="absolute -bottom-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#ff6b2c] text-white shadow-md">
            <span>{isPlaying ? "⏸" : "▶"}</span>
          </div>
        </div>

        {/* Audio Progress Bar */}
        <div className="mt-7 w-full max-w-xs space-y-1.5 px-2">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => {
              const val = Number(e.target.value);
              setCurrentTime(val);
              if (audioRef.current) audioRef.current.currentTime = val;
            }}
            className="h-2.5 w-full cursor-pointer appearance-none rounded-full bg-orange-100 accent-[#ff6b2c] transition"
          />
          <div className="flex justify-between text-[11px] font-medium text-neutral-400">
            <span>{formatTime(currentTime)}</span>
            <span>{duration ? formatTime(duration) : "--:--"}</span>
          </div>
        </div>

        {/* Big Touch-friendly Play Controls */}
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={togglePlay}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ff6b2c] text-xl text-white shadow-lg shadow-orange-300/50 transition hover:bg-[#ef5a1a] active:scale-95"
            aria-label={isPlaying ? "暂停" : "播放"}
          >
            <span>{isPlaying ? "⏸" : "▶"}</span>
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-2 text-center text-xs text-amber-800">
            {error}
          </div>
        ) : null}

        {/* Follow-along Lyrics Card */}
        {lyrics ? (
          <div className="mt-5 w-full max-w-sm rounded-2xl border border-[#f0e6d4] bg-white/95 p-4 shadow-xs backdrop-blur-xs">
            <p className="text-center text-xs font-bold text-neutral-400">
              —— 伴唱歌词 ——
            </p>
            <div className="mt-2.5 max-h-36 overflow-y-auto whitespace-pre-wrap text-center text-sm font-medium leading-relaxed text-neutral-700">
              {lyrics}
            </div>
          </div>
        ) : null}
      </main>

      {/* Footer Viral / Call to Action */}
      <footer className="space-y-3 pt-2 text-center">
        <Link
          href="/"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-[#f0e6d4] bg-white py-3 text-xs font-bold text-neutral-700 shadow-sm transition hover:border-[#ff6b2c]/40 hover:bg-[#fff4ee]"
        >
          <span>🎨</span>
          <span>我也要制作专属启蒙歌绘海报</span>
        </Link>
        <p className="text-[11px] text-neutral-400">
          歌绘 · 一首歌 一张画 一起唱 · 陪伴低幼健康成长
        </p>
      </footer>
    </div>
  );
}
