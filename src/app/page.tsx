"use client";

import { useCallback, useMemo, useState } from "react";
import type { ScenePlan } from "@/lib/types";

type Step = "input" | "working" | "done" | "error";

const SAMPLE_LYRICS = `Head, shoulders, knees and toes, knees and toes
Head, shoulders, knees and toes, knees and toes
And eyes and ears and mouth and nose
Head, shoulders, knees and toes, knees and toes

头，肩膀，膝盖，脚趾
眼睛，耳朵，嘴巴，鼻子`;

export default function HomePage() {
  const [lyrics, setLyrics] = useState(SAMPLE_LYRICS);
  const [step, setStep] = useState<Step>("input");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<ScenePlan | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [mode, setMode] = useState<"canvas" | "openai-image">("canvas");
  const [planSource, setPlanSource] = useState("");

  const canGenerate = useMemo(() => lyrics.trim().length > 0, [lyrics]);

  const onFile = useCallback(async (file: File) => {
    setError("");
    setStep("working");
    try {
      const isPdf =
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const isAudio = /audio|mpeg|wav|mp4|m4a|flac|ogg/.test(file.type) ||
        /\.(mp3|wav|m4a|flac|ogg)$/i.test(file.name);

      if (isPdf) {
        setStatus("正在从 PDF 抽取歌词…");
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/extract-pdf", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "PDF 解析失败");
        setLyrics(data.text);
        setStatus("PDF 歌词已提取，可点击生成绘本");
        setStep("input");
        return;
      }

      if (isAudio) {
        setStatus("正在转写音频（需要 OpenAI Whisper）…");
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/transcribe", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "音频转写失败");
        setLyrics(data.text);
        setStatus("音频转写完成，可点击生成绘本");
        setStep("input");
        return;
      }

      throw new Error("请上传 PDF 或常见音频（mp3 / wav / m4a / flac）");
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传处理失败");
      setStep("error");
    }
  }, []);

  const generate = useCallback(async () => {
    setError("");
    setStep("working");
    setImageDataUrl("");
    setPlan(null);
    try {
      setStatus("正在规划童趣分格场景…");
      const planRes = await fetch("/api/plan-scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics }),
      });
      const planData = await planRes.json();
      if (!planRes.ok) throw new Error(planData.error || "场景规划失败");
      setPlan(planData.plan);
      setPlanSource(planData.source);

      setStatus(
        mode === "openai-image"
          ? "正在调用大模型出图…"
          : "正在渲染童趣绘本页（本地矢量）…",
      );
      const imgRes = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planData.plan, mode }),
      });
      const imgData = await imgRes.json();
      if (!imgRes.ok) throw new Error(imgData.error || "出图失败");
      setImageDataUrl(imgData.imageDataUrl);
      setStatus("完成");
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
      setStep("error");
    }
  }, [lyrics, mode]);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-4 py-10 md:px-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-wide text-[#ff6b2c]">GE-HUI</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight md:text-4xl">歌绘</h1>
          <p className="mt-2 max-w-2xl text-base text-neutral-700">
            上传歌曲音频或 PDF 歌词，生成一页童趣分格绘本图。默认本地矢量渲染即可演示；配置
            OpenAI 后可启用 Whisper 转写与 AI 出图。
          </p>
        </div>
        <a
          href="/style-reference.jpg"
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-[#1db8a6] underline-offset-4 hover:underline"
        >
          查看风格参考图
        </a>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-black/5 bg-white/80 p-5 shadow-sm backdrop-blur">
          <h2 className="text-lg font-bold">1. 输入歌词</h2>
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) void onFile(f);
            }}
            className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-300 bg-[#faf7f0] px-4 py-8 text-center transition hover:border-[#ff6b2c]"
          >
            <input
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.flac,application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
            <span className="text-sm font-medium">拖拽或点击上传音频 / PDF</span>
            <span className="mt-1 text-xs text-neutral-500">
              音频转写需要 OPENAI_API_KEY；PDF 与粘贴歌词可离线演示
            </span>
          </label>

          <label className="mt-4 block text-sm font-medium text-neutral-700">
            或直接粘贴歌词
            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              rows={12}
              className="mt-2 w-full resize-y rounded-2xl border border-neutral-200 bg-white p-3 text-sm leading-relaxed outline-none ring-[#ff6b2c] focus:ring-2"
            />
          </label>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-sm">
              <span className="font-medium">出图方式</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as "canvas" | "openai-image")}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
              >
                <option value="canvas">本地矢量绘本页（推荐演示）</option>
                <option value="openai-image">OpenAI 图像模型</option>
              </select>
            </label>
            <button
              type="button"
              disabled={!canGenerate || step === "working"}
              onClick={() => void generate()}
              className="rounded-2xl bg-[#ff6b2c] px-5 py-2.5 text-sm font-bold text-white shadow disabled:cursor-not-allowed disabled:opacity-50"
            >
              {step === "working" ? "生成中…" : "生成一页绘本"}
            </button>
          </div>

          {status && (
            <p className="mt-3 text-sm text-neutral-600">状态：{status}</p>
          )}
          {error && (
            <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        <div className="rounded-3xl border border-black/5 bg-white/80 p-5 shadow-sm backdrop-blur">
          <h2 className="text-lg font-bold">2. 绘本结果</h2>
          {!imageDataUrl && (
            <div className="mt-4 flex min-h-[420px] items-center justify-center rounded-2xl bg-[#faf7f0] text-sm text-neutral-500">
              生成后的童趣绘本页会显示在这里
            </div>
          )}
          {imageDataUrl && (
            <div className="mt-4 space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageDataUrl}
                alt="生成的歌绘本页"
                className="w-full rounded-2xl border border-neutral-100 bg-white shadow-sm"
              />
              <div className="flex flex-wrap gap-3">
                <a
                  href={imageDataUrl}
                  download="ge-hui-picturebook.svg"
                  className="rounded-xl bg-[#1db8a6] px-4 py-2 text-sm font-bold text-white"
                >
                  下载绘本页
                </a>
                {planSource && (
                  <span className="self-center text-xs text-neutral-500">
                    场景规划：{planSource === "openai" ? "OpenAI Chat" : "本地规则"}
                  </span>
                )}
              </div>
            </div>
          )}

          {plan && (
            <details className="mt-4 rounded-2xl bg-[#faf7f0] p-3 text-sm">
              <summary className="cursor-pointer font-semibold">场景规划 JSON</summary>
              <pre className="mt-2 overflow-auto text-xs leading-relaxed">
                {JSON.stringify(plan, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </section>

      <footer className="pb-8 text-xs leading-relaxed text-neutral-500">
        仅供学习与产品演示。请确保你对上传的音频/歌词拥有相应权利。参考风格为儿童教育绘本分格页，正式商用请自行替换角色与素材授权。
      </footer>
    </main>
  );
}
