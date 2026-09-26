"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { ModelOption } from "@/lib/model-options";
import type { PricingConfig, ModelPoolConfig, AdminConfig } from "@/lib/admin-settings";

type GeneratedCodeItem = {
  code: string;
  magicLink: string;
};

type AdminStats = {
  totalRedeemedCodes: number;
  todayActiveDevices: number;
  todayTotalGenerations: number;
};

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Dashboard state
  const [generateCount, setGenerateCount] = useState<number>(1);
  const [isGeneratingCodes, setIsGeneratingCodes] = useState(false);
  const [generatedList, setGeneratedList] = useState<GeneratedCodeItem[]>([]);
  const [codeFeedback, setCodeFeedback] = useState("");

  // Pricing settings state
  const [pricing, setPricing] = useState<PricingConfig>({
    price: "6.6",
    originalPrice: "29.9",
    promoTag: "限时特惠",
  });
  const [isSavingPricing, setIsSavingPricing] = useState(false);
  const [pricingFeedback, setPricingFeedback] = useState("");

  // Model settings state
  const [chatModels, setChatModels] = useState<ModelOption[]>([]);
  const [imageModels, setImageModels] = useState<ModelOption[]>([]);
  const [chatPool, setChatPool] = useState<ModelPoolConfig>({
    freeModels: ["gemini-3.8-flash-high", "gemini-3.1-pro-low", "glm-5.3", "grok-4.6"],
    proModels: ["gpt-6-astra", "gpt-5.6-sol", "gpt-5.5"],
    defaultFree: "gemini-3.8-flash-high",
    defaultPro: "gpt-6-astra",
  });
  const [imagePool, setImagePool] = useState<ModelPoolConfig>({
    freeModels: ["gemini-3.1-flash-image"],
    proModels: ["gpt-image-2.5", "gpt-image-2", "gpt-image-1.5"],
    defaultFree: "gemini-3.1-flash-image",
    defaultPro: "gpt-image-2.5",
  });

  const [isSavingModels, setIsSavingModels] = useState(false);
  const [modelsFeedback, setModelsFeedback] = useState("");

  // Stats
  const [stats, setStats] = useState<AdminStats | null>(null);

  // 1. Check auth status on mount
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/auth");
      const data = await res.json();
      setIsAuthenticated(Boolean(data.authenticated));
      if (data.authenticated) {
        void loadDashboardData();
      }
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  // Load models & stats after authenticated
  async function loadDashboardData() {
    try {
      const [modelsRes, settingsRes] = await Promise.all([
        fetch("/api/models"),
        fetch("/api/admin/settings"),
      ]);

      if (modelsRes.ok) {
        const mData = await modelsRes.json();
        setChatModels(mData.chatModels || []);
        setImageModels(mData.imageModels || []);
      }

      if (settingsRes.ok) {
        const sData = (await settingsRes.json()) as { config?: AdminConfig; stats?: AdminStats };
        if (sData.config) {
          if (sData.config.pricing) setPricing(sData.config.pricing);
          if (sData.config.chatPool) setChatPool(sData.config.chatPool);
          if (sData.config.imagePool) setImagePool(sData.config.imagePool);
        }
        if (sData.stats) {
          setStats(sData.stats);
        }
      }
    } catch (e) {
      console.error("加载数据失败", e);
    }
  }

  // Handle Login
  async function handleLogin(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!passwordInput.trim() || isLoggingIn) return;
    setIsLoggingIn(true);
    setLoginError("");

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "密码错误");
      }
      setIsAuthenticated(true);
      setPasswordInput("");
      void loadDashboardData();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setIsLoggingIn(false);
    }
  }

  // Handle Logout
  async function handleLogout() {
    try {
      await fetch("/api/admin/auth", { method: "DELETE" });
    } finally {
      setIsAuthenticated(false);
      setGeneratedList([]);
    }
  }

  // Generate Codes
  async function handleGenerateCodes(countToGen = generateCount) {
    if (isGeneratingCodes || countToGen < 1) return;
    setIsGeneratingCodes(true);
    setCodeFeedback("");

    try {
      const res = await fetch("/api/admin/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: countToGen }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成失败");

      setGeneratedList(data.items || []);
      setCodeFeedback(`✓ 成功生成 ${data.count} 枚一客一码防伪卡密！`);
    } catch (err) {
      setCodeFeedback(err instanceof Error ? err.message : "生成卡密出错");
    } finally {
      setIsGeneratingCodes(false);
    }
  }

  // Save Pricing Settings
  async function handleSavePricing() {
    if (isSavingPricing) return;
    setIsSavingPricing(true);
    setPricingFeedback("");

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pricing }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存价格失败");
      setPricingFeedback("✓ 定价策略已更新，全站弹窗与卡片已即时同步！");
      setTimeout(() => setPricingFeedback(""), 3500);
    } catch (err) {
      setPricingFeedback(err instanceof Error ? err.message : "保存失败");
    } finally {
      setIsSavingPricing(false);
    }
  }

  // Save Model Pools Settings
  async function handleSaveModels() {
    if (isSavingModels) return;
    setIsSavingModels(true);
    setModelsFeedback("");

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatPool,
          imagePool,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存模型池配置失败");
      setModelsFeedback("✓ 多模型池调度策略已保存，全站即时生效！");
      setTimeout(() => setModelsFeedback(""), 3500);
    } catch (err) {
      setModelsFeedback(err instanceof Error ? err.message : "保存失败");
    } finally {
      setIsSavingModels(false);
    }
  }

  // Copy helper
  function copyText(text: string, label: string) {
    if (typeof window === "undefined") return;
    void navigator.clipboard.writeText(text).then(() => {
      setCodeFeedback(`✓ 已复制${label}到剪贴板！`);
      setTimeout(() => setCodeFeedback(""), 2500);
    });
  }

  // Copy all generated codes
  function copyAllCodes() {
    if (generatedList.length === 0) return;
    const all = generatedList.map((item, idx) => `${idx + 1}. 卡密: ${item.code}\n   直达链接: ${item.magicLink}`).join("\n\n");
    copyText(all, "全部卡密及链接");
  }

  // Helper toggle for pools
  function toggleModelInPool(
    poolType: "chat" | "image",
    tier: "free" | "pro",
    modelId: string
  ) {
    if (poolType === "chat") {
      setChatPool((prev) => {
        const key = tier === "free" ? "freeModels" : "proModels";
        const currentList = prev[key] || [];
        const exists = currentList.includes(modelId);
        const nextList = exists
          ? currentList.filter((id) => id !== modelId)
          : [...currentList, modelId];
        return { ...prev, [key]: nextList };
      });
    } else {
      setImagePool((prev) => {
        const key = tier === "free" ? "freeModels" : "proModels";
        const currentList = prev[key] || [];
        const exists = currentList.includes(modelId);
        const nextList = exists
          ? currentList.filter((id) => id !== modelId)
          : [...currentList, modelId];
        return { ...prev, [key]: nextList };
      });
    }
  }

  // Loading state
  if (isAuthenticated === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f3e8] p-4 text-neutral-600">
        <div className="flex items-center gap-2">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#ff6b2c] border-t-transparent" />
          <span className="text-sm font-medium">正在校验安全通行证…</span>
        </div>
      </main>
    );
  }

  // Login Screen (Password Protected & Desensitized)
  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f3e8] p-4 font-sans text-neutral-800">
        <div className="w-full max-w-sm rounded-3xl border-2 border-[#f0e6d4] bg-white p-6 shadow-xl text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-2xl border border-orange-100 shadow-xs mb-3">
            🔐
          </div>
          <h1 className="font-display text-2xl font-bold text-neutral-900">
            歌绘 · 管理控制台
          </h1>
          <p className="mt-1 text-xs text-neutral-500">
            请输入管理员通行密码以进入系统
          </p>

          <form onSubmit={handleLogin} className="mt-5 space-y-3">
            <input
              type="password"
              autoFocus
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="请输入管理员密码"
              className="w-full rounded-xl border border-[#f0e6d4] bg-[#fffdf8] px-3 py-2.5 text-center text-base tracking-widest outline-none ring-[#ff6b2c]/40 focus:ring-2 font-mono"
            />
            {loginError ? (
              <p className="text-xs font-semibold text-rose-600 animate-in fade-in">
                {loginError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={isLoggingIn || !passwordInput.trim()}
              className="w-full rounded-xl bg-[#ff6b2c] py-2.5 text-sm font-bold text-white shadow-xs hover:bg-[#ef5a1a] transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isLoggingIn ? "验证通行中…" : "进入管理面板"}
            </button>
          </form>

          <div className="mt-6 border-t border-[#f0e6d4]/60 pt-3">
            <Link
              href="/"
              className="text-xs text-neutral-400 hover:text-[#ff6b2c] transition"
            >
              ← 返回歌绘主页
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Authenticated Dashboard
  return (
    <main className="min-h-screen bg-[#f7f3e8] p-4 sm:p-8 font-sans text-neutral-800">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Top Navbar */}
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[#f0e6d4] bg-white p-4 sm:px-6 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-xl border border-orange-100 shadow-2xs">
              ⚡
            </span>
            <div>
              <h1 className="font-display text-xl font-bold text-neutral-900 flex items-center gap-2">
                <span>歌绘管理中心</span>
                <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold border border-emerald-200">
                  安全已授权
                </span>
              </h1>
              <p className="text-xs text-neutral-400">
                卡密发行 · 动态定价策略 · 多模型池灵活调度
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              target="_blank"
              className="rounded-xl border border-[#f0e6d4] bg-[#fffdf8] px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:border-orange-300 transition"
            >
              打开网站 ↗
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
            >
              安全退出
            </button>
          </div>
        </header>

        {/* Stats Row */}
        {stats ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-[#f0e6d4] bg-white p-4 shadow-2xs">
              <p className="text-xs text-neutral-400 font-medium">已激活支持者卡密总数</p>
              <p className="mt-1 text-2xl font-bold text-[#c2410c]">{stats.totalRedeemedCodes} <span className="text-xs text-neutral-400 font-normal">张</span></p>
            </div>
            <div className="rounded-2xl border border-[#f0e6d4] bg-white p-4 shadow-2xs">
              <p className="text-xs text-neutral-400 font-medium">今日活跃设备数</p>
              <p className="mt-1 text-2xl font-bold text-neutral-800">{stats.todayActiveDevices} <span className="text-xs text-neutral-400 font-normal">台</span></p>
            </div>
            <div className="rounded-2xl border border-[#f0e6d4] bg-white p-4 shadow-2xs">
              <p className="text-xs text-neutral-400 font-medium">今日总绘本生成次数</p>
              <p className="mt-1 text-2xl font-bold text-[#1db8a6]">{stats.todayTotalGenerations} <span className="text-xs text-neutral-400 font-normal">次</span></p>
            </div>
          </div>
        ) : null}

        {/* Section 1: Pricing & Limited-Time Promotion Config */}
        <section className="rounded-3xl border border-[#f0e6d4] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#f0e6d4]/60 pb-3">
            <div>
              <h2 className="font-display text-lg font-bold text-neutral-900 flex items-center gap-1.5">
                <span>🏷️</span>
                <span>创作包定价与限时特惠配置</span>
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                在此设置前台弹窗与卡片展示的售价、划线原价及促销角标（全站即时自动同步）
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                限时特惠售价（元）：
              </label>
              <input
                type="text"
                value={pricing.price}
                onChange={(e) => setPricing((p) => ({ ...p, price: e.target.value }))}
                placeholder="例如 6.6 或 9.9"
                className="w-full rounded-xl border border-[#f0e6d4] bg-[#fffdf8] px-3 py-2 text-sm font-bold text-[#c2410c] outline-none ring-[#ff6b2c]/40 focus:ring-1"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                展示划线原价（元）：
              </label>
              <input
                type="text"
                value={pricing.originalPrice}
                onChange={(e) => setPricing((p) => ({ ...p, originalPrice: e.target.value }))}
                placeholder="例如 29.9"
                className="w-full rounded-xl border border-[#f0e6d4] bg-[#fffdf8] px-3 py-2 text-sm text-neutral-500 line-through outline-none ring-[#ff6b2c]/40 focus:ring-1"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                活动促销标签：
              </label>
              <input
                type="text"
                value={pricing.promoTag}
                onChange={(e) => setPricing((p) => ({ ...p, promoTag: e.target.value }))}
                placeholder="例如 限时特惠 / 开学季特惠"
                className="w-full rounded-xl border border-[#f0e6d4] bg-[#fffdf8] px-3 py-2 text-sm text-neutral-800 outline-none ring-[#ff6b2c]/40 focus:ring-1"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-neutral-400">
              * 修改后点击右侧保存，前台用户打开弹窗和升级条将直接呈现新价格
            </span>
            <button
              type="button"
              onClick={handleSavePricing}
              disabled={isSavingPricing}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#ff6b2c] hover:bg-[#ef5a1a] px-4 py-1.5 text-xs font-bold text-white shadow-2xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSavingPricing ? "正在保存…" : "💾 保存价格策略"}
            </button>
          </div>

          {pricingFeedback ? (
            <p className={pricingFeedback.includes("✓") ? "text-xs font-semibold text-emerald-700 animate-in fade-in" : "text-xs font-semibold text-rose-600"}>
              {pricingFeedback}
            </p>
          ) : null}
        </section>

        {/* Section 2: Activation Codes Issuance Workbench */}
        <section className="rounded-3xl border border-[#f0e6d4] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f0e6d4]/60 pb-3">
            <div>
              <h2 className="font-display text-lg font-bold text-neutral-900 flex items-center gap-1.5">
                <span>🎫</span>
                <span>支持者创作包 · 卡密一键发行</span>
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                一客一码防伪签名，每码含 20 次生成额度（90天有效），支持最多 3 台设备无缝同步
              </p>
            </div>

            {/* Quick Batch Pill buttons */}
            <div className="flex items-center gap-1.5">
              {[1, 3, 5, 10, 20].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    setGenerateCount(num);
                    void handleGenerateCodes(num);
                  }}
                  disabled={isGeneratingCodes}
                  className="rounded-xl border border-[#f0e6d4] bg-[#fffdf8] px-2.5 py-1 text-xs font-bold text-neutral-700 hover:border-[#ff6b2c] hover:bg-orange-50 hover:text-[#c2410c] transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  +{num}张
                </button>
              ))}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-neutral-700">自定义生成数量：</label>
              <input
                type="number"
                min={1}
                max={50}
                value={generateCount}
                onChange={(e) => setGenerateCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                className="w-20 rounded-xl border border-[#f0e6d4] bg-[#fffdf8] px-2.5 py-1.5 text-center text-sm font-bold text-neutral-800 outline-none ring-[#ff6b2c]/40 focus:ring-1"
              />
              <span className="text-xs text-neutral-400">张</span>
            </div>

            <button
              type="button"
              onClick={() => void handleGenerateCodes()}
              disabled={isGeneratingCodes}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#ff6b2c] hover:bg-[#ef5a1a] px-4 py-2 text-xs font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isGeneratingCodes ? (
                <>
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>正在签名生成…</span>
                </>
              ) : (
                <>
                  <span>⚡ 立即批量生成</span>
                </>
              )}
            </button>

            {generatedList.length > 0 ? (
              <button
                type="button"
                onClick={copyAllCodes}
                className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition active:scale-95 cursor-pointer ml-auto"
              >
                <span>📑 复制全部卡密与链接</span>
              </button>
            ) : null}
          </div>

          {codeFeedback ? (
            <p className={codeFeedback.includes("✓") ? "text-xs font-semibold text-emerald-700 animate-in fade-in" : "text-xs font-semibold text-rose-600"}>
              {codeFeedback}
            </p>
          ) : null}

          {/* Generated Result Table */}
          {generatedList.length > 0 ? (
            <div className="rounded-2xl border border-orange-100 bg-[#fffbf7] p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-neutral-700 px-1">
                <span>最新生成的卡密（共 {generatedList.length} 张）：</span>
                <span className="text-[11px] text-neutral-400 font-normal">点击右侧按钮直接复制发送给微信客户</span>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {generatedList.map((item, idx) => (
                  <div
                    key={item.code}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-[#f0e6d4] bg-white p-2.5 text-xs shadow-2xs hover:border-[#ff6b2c]/50 transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-[10px] font-bold text-[#c2410c] shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-mono font-bold text-neutral-900 tracking-wider select-all text-sm">
                        {item.code}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => copyText(item.code, "卡密代码")}
                        className="rounded-lg border border-[#e5ded4] bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 hover:border-[#ff6b2c] hover:text-[#c2410c] hover:bg-[#fff7f2] transition active:scale-95 cursor-pointer"
                      >
                        📋 复制卡密
                      </button>
                      <button
                        type="button"
                        onClick={() => copyText(item.magicLink, "一键直达激活链接")}
                        className="rounded-lg bg-[#ff6b2c] hover:bg-[#ef5a1a] px-2.5 py-1 text-[11px] font-bold text-white transition active:scale-95 cursor-pointer shadow-2xs"
                      >
                        🔗 复制直达免密链接
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* Section 3: Multi-Model Pools Scheduling & Pro Privileges Config */}
        <section className="rounded-3xl border border-[#f0e6d4] bg-white p-5 sm:p-6 shadow-xs space-y-5">
          <div className="border-b border-[#f0e6d4]/60 pb-3">
            <h2 className="font-display text-lg font-bold text-neutral-900 flex items-center gap-1.5">
              <span>🤖</span>
              <span>多模型池调度中心 · 免费池与 Pro 专享池灵活配置</span>
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              在此自由勾选免费通道与 Pro 专享通道包含的多个模型，并指定各通道的默认首选
            </p>
          </div>

          {/* 1. Chat/Planning Pool */}
          <div className="rounded-2xl border border-[#f0e6d4] bg-[#fffdf8] p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-[#f0e6d4]/50 pb-2">
              <span className="text-xs font-bold text-neutral-800 flex items-center gap-1">
                <span>📝</span> 【谁来听歌想画面】多模型池配置
              </span>
              <span className="text-[10px] text-neutral-400">负责歌词理解与分镜头构思</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Free Chat Pool */}
              <div className="space-y-2 border border-neutral-200/70 rounded-xl bg-white p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800">🌱 免费通道模型池（多选）：</span>
                  <span className="text-[10px] text-neutral-400">已选 {chatPool.freeModels.length} 个</span>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {chatModels.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 text-xs text-neutral-700 cursor-pointer hover:bg-neutral-50 p-1 rounded-lg">
                      <input
                        type="checkbox"
                        checked={chatPool.freeModels.includes(m.id)}
                        onChange={() => toggleModelInPool("chat", "free", m.id)}
                        className="rounded text-[#ff6b2c] focus:ring-[#ff6b2c]"
                      />
                      <span className="truncate">{m.label}</span>
                    </label>
                  ))}
                </div>
                <div className="pt-2 border-t border-neutral-100 flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-neutral-600 shrink-0">默认首选：</span>
                  <select
                    value={chatPool.defaultFree}
                    onChange={(e) => setChatPool((p) => ({ ...p, defaultFree: e.target.value }))}
                    className="w-full rounded-lg border border-[#f0e6d4] bg-white px-2 py-1 text-xs"
                  >
                    {chatPool.freeModels.map((id) => (
                      <option key={id} value={id}>
                        {chatModels.find((m) => m.id === id)?.label || id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pro Chat Pool */}
              <div className="space-y-2 border border-orange-200/70 rounded-xl bg-white p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#c2410c]">👑 Pro 专享模型池（多选）：</span>
                  <span className="text-[10px] text-neutral-400">已选 {chatPool.proModels.length} 个</span>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {chatModels.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 text-xs text-neutral-700 cursor-pointer hover:bg-orange-50/50 p-1 rounded-lg">
                      <input
                        type="checkbox"
                        checked={chatPool.proModels.includes(m.id)}
                        onChange={() => toggleModelInPool("chat", "pro", m.id)}
                        className="rounded text-[#ff6b2c] focus:ring-[#ff6b2c]"
                      />
                      <span className="truncate">{m.label}</span>
                    </label>
                  ))}
                </div>
                <div className="pt-2 border-t border-neutral-100 flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-neutral-600 shrink-0">默认首选：</span>
                  <select
                    value={chatPool.defaultPro}
                    onChange={(e) => setChatPool((p) => ({ ...p, defaultPro: e.target.value }))}
                    className="w-full rounded-lg border border-[#f0e6d4] bg-white px-2 py-1 text-xs"
                  >
                    {chatPool.proModels.map((id) => (
                      <option key={id} value={id}>
                        {chatModels.find((m) => m.id === id)?.label || id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Image Pool */}
          <div className="rounded-2xl border border-[#f0e6d4] bg-[#fffdf8] p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-[#f0e6d4]/50 pb-2">
              <span className="text-xs font-bold text-neutral-800 flex items-center gap-1">
                <span>🎨</span> 【谁来画画】画师模型池配置
              </span>
              <span className="text-[10px] text-neutral-400">负责儿童绘本插画与原画生成</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Free Image Pool */}
              <div className="space-y-2 border border-neutral-200/70 rounded-xl bg-white p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800">🌱 免费画师池（多选）：</span>
                  <span className="text-[10px] text-neutral-400">已选 {imagePool.freeModels.length} 个</span>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {imageModels.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 text-xs text-neutral-700 cursor-pointer hover:bg-neutral-50 p-1 rounded-lg">
                      <input
                        type="checkbox"
                        checked={imagePool.freeModels.includes(m.id)}
                        onChange={() => toggleModelInPool("image", "free", m.id)}
                        className="rounded text-[#ff6b2c] focus:ring-[#ff6b2c]"
                      />
                      <span className="truncate">{m.label}</span>
                    </label>
                  ))}
                </div>
                <div className="pt-2 border-t border-neutral-100 flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-neutral-600 shrink-0">默认首选：</span>
                  <select
                    value={imagePool.defaultFree}
                    onChange={(e) => setImagePool((p) => ({ ...p, defaultFree: e.target.value }))}
                    className="w-full rounded-lg border border-[#f0e6d4] bg-white px-2 py-1 text-xs"
                  >
                    {imagePool.freeModels.map((id) => (
                      <option key={id} value={id}>
                        {imageModels.find((m) => m.id === id)?.label || id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pro Image Pool */}
              <div className="space-y-2 border border-orange-200/70 rounded-xl bg-white p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#c2410c]">👑 Pro 专享画师池（多选）：</span>
                  <span className="text-[10px] text-neutral-400">已选 {imagePool.proModels.length} 个</span>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {imageModels.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 text-xs text-neutral-700 cursor-pointer hover:bg-orange-50/50 p-1 rounded-lg">
                      <input
                        type="checkbox"
                        checked={imagePool.proModels.includes(m.id)}
                        onChange={() => toggleModelInPool("image", "pro", m.id)}
                        className="rounded text-[#ff6b2c] focus:ring-[#ff6b2c]"
                      />
                      <span className="truncate">{m.label}</span>
                    </label>
                  ))}
                </div>
                <div className="pt-2 border-t border-neutral-100 flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-neutral-600 shrink-0">默认首选：</span>
                  <select
                    value={imagePool.defaultPro}
                    onChange={(e) => setImagePool((p) => ({ ...p, defaultPro: e.target.value }))}
                    className="w-full rounded-lg border border-[#f0e6d4] bg-white px-2 py-1 text-xs"
                  >
                    {imagePool.proModels.map((id) => (
                      <option key={id} value={id}>
                        {imageModels.find((m) => m.id === id)?.label || id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <span className="text-xs text-neutral-400">
              * 保存后无需重启服务，所有新发起的绘本生成任务将立即采用此配置
            </span>
            <button
              type="button"
              onClick={handleSaveModels}
              disabled={isSavingModels}
              className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-900 hover:bg-black px-5 py-2 text-xs font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSavingModels ? "正在保存…" : "💾 保存多模型池调度配置"}
            </button>
          </div>

          {modelsFeedback ? (
            <p className={modelsFeedback.includes("✓") ? "text-xs font-semibold text-emerald-700 animate-in fade-in" : "text-xs font-semibold text-rose-600"}>
              {modelsFeedback}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
