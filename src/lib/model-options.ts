export type ModelOption = {
  id: string;
  label: string;
  shortLabel?: string;
  hint?: string;
  isPro?: boolean;
  provider?: "google" | "openai";
};

export type ModelFamily = "gemini" | "gpt";

/** Family display order: Gemini and GPT exclusively */
export const FAMILY_ORDER: ModelFamily[] = ["gemini", "gpt"];

export function detectFamily(id: string): ModelFamily | "other" {
  const s = id.toLowerCase();
  if (s.includes("gemini") || s.includes("imagen")) return "gemini";
  if (s.startsWith("gpt") || s.includes("gpt-") || s.includes("dall")) return "gpt";
  return "other";
}

/** Higher = better / prefer earlier within a family */
export const CHAT_RANK: Record<string, number> = {
  "gemini-3.8-flash-high": 120,
  "gemini-3.7-flash-high": 110,
  "gemini-3.6-flash-high": 100,
  "gemini-3.1-pro-low": 90,
  "gemini-3.1-flash-lite": 80,
  "gemini-3-flash": 70,
  "gpt-6-astra": 130, // 👑 Pro 专享
  "gpt-5.6-sol": 120, // 👑 Pro 专享
  "gpt-5.6-terra": 110, // 👑 Pro 专享
  "gpt-5.5": 100, // 👑 Pro 专享
};

export const PRO_CHAT_MODELS = [
  "gpt-6-astra",
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.5",
];

export const CHAT_ALLOWLIST = Object.keys(CHAT_RANK);

export const IMAGE_RANK: Record<string, number> = {
  "gemini-3.1-flash-image": 130,
  "imagen-3.0-generate-002": 120,
  "imagen-3.0-fast-generate-001": 110,
  "gpt-image-2.5-sunburst": 125, // 👑 Pro 专享
  "gpt-image-2.5-flare": 120, // 👑 Pro 专享
  "gpt-image-2.5": 115, // 👑 Pro 专享
  "gpt-image-2": 100, // 👑 Pro 专享
  "gpt-image-1.5": 85, // 👑 Pro 专享
  "dall-e-3": 95, // 👑 Pro 专享
};

export const PRO_IMAGE_MODELS = [
  "gpt-image-2.5-sunburst",
  "gpt-image-2.5-flare",
  "gpt-image-2.5",
  "gpt-image-2",
  "gpt-image-1.5",
  "dall-e-3",
];

export const IMAGE_ALLOWLIST = Object.keys(IMAGE_RANK);

/**
 * 将底层技术模型映射为儿童绘本通俗体验分档与画师标签
 */
const CHAT_FRIENDLY_LABELS: Record<string, { label: string; hint?: string; provider: "google" | "openai" }> = {
  "gemini-3.8-flash-high": { label: "🌱 欢快童话编排 (极速构思 · 推荐)", hint: "推荐", provider: "google" },
  "gemini-3.7-flash-high": { label: "🌿 深度情节编排 (生动长线)", hint: "深度", provider: "google" },
  "gemini-3.6-flash-high": { label: "📚 经典童谣构思 (节奏明快)", hint: "经典", provider: "google" },
  "gemini-3.1-pro-low": { label: "🍃 温润生活小剧本 (细腻亲情)", hint: "细腻", provider: "google" },
  "gemini-3.1-flash-lite": { label: "⚡ 超轻灵感捕捉 (微秒响应)", hint: "轻量", provider: "google" },
  "gemini-3-flash": { label: "✨ 敏捷童趣分镜 (快速出稿)", hint: "敏捷", provider: "google" },
  "gpt-6-astra": { label: "👑 顶级名家分镜大师 (Pro 专享 · 殿堂级)", hint: "👑 殿堂", provider: "openai" },
  "gpt-5.6-sol": { label: "👑 国际双语名作构思 (Pro 专享 · 旗舰)", hint: "👑 旗舰", provider: "openai" },
  "gpt-5.6-terra": { label: "👑 深度自然启蒙剧作 (Pro 专享)", hint: "👑 Pro", provider: "openai" },
  "gpt-5.5": { label: "👑 经典绘本戏剧工坊 (Pro 专享)", hint: "👑 Pro", provider: "openai" },
};

const IMAGE_FRIENDLY_LABELS: Record<string, { label: string; hint?: string; provider: "google" | "openai" }> = {
  "gemini-3.1-flash-image": { label: "🎨 启蒙标清画师 (极速出画 · 优先推荐)", hint: "极速推荐", provider: "google" },
  "imagen-3.0-generate-002": { label: "🎨 Imagen 3 旗舰绘本画师 (高保真写实)", hint: "推荐", provider: "google" },
  "imagen-3.0-fast-generate-001": { label: "🎨 Imagen 3 极速卡通画师 (秒出图)", hint: "极速", provider: "google" },
  "gpt-image-2.5": { label: "👑 4K 印刷级超清原画师 (Pro 专享 · 殿堂级)", hint: "👑 殿堂原画", provider: "openai" },
  "gpt-image-2": { label: "👑 经典童画温润原画师 (Pro 专享)", hint: "👑 经典", provider: "openai" },
  "gpt-image-1.5": { label: "👑 轻盈绘本水彩画师 (Pro 专享)", hint: "👑 水彩", provider: "openai" },
  "gpt-image-2.5-sunburst": { label: "👑 阳光复古绘本原画师 (Pro 专享)", hint: "👑 暖光复古", provider: "openai" },
  "gpt-image-2.5-flare": { label: "👑 梦幻光影绘本画师 (Pro 专享)", hint: "👑 梦幻光影", provider: "openai" },
  "dall-e-3": { label: "👑 OpenAI DALL-E 3 经典插画师 (Pro 专享)", hint: "👑 Pro", provider: "openai" },
};

export function isChatCapable(id: string): boolean {
  const family = detectFamily(id);
  if (family !== "gemini" && family !== "gpt") return false;
  return CHAT_ALLOWLIST.includes(id);
}

export function isImageCapable(id: string): boolean {
  const family = detectFamily(id);
  if (family !== "gemini" && family !== "gpt") return false;
  return IMAGE_ALLOWLIST.includes(id);
}

export function toOption(id: string, kind: "chat" | "image"): ModelOption {
  const isPro = kind === "chat" ? PRO_CHAT_MODELS.includes(id) : PRO_IMAGE_MODELS.includes(id);
  const friendlyMap = kind === "chat" ? CHAT_FRIENDLY_LABELS : IMAGE_FRIENDLY_LABELS;
  const match = friendlyMap[id];
  const provider = match?.provider || (id.toLowerCase().includes("gemini") || id.toLowerCase().includes("imagen") ? "google" : "openai");

  if (match) {
    return {
      id,
      label: match.label,
      hint: match.hint,
      isPro,
      provider,
    };
  }

  // Fallback
  const rank = kind === "chat" ? CHAT_RANK[id] : IMAGE_RANK[id];
  const hint = rank && rank >= 90 ? "推荐" : isPro ? "👑 Pro" : undefined;
  const rawTitle = id.split("/").pop()!.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const label = isPro ? `${rawTitle} (👑 Pro 专享)` : rawTitle;

  return { id, label, hint, isPro, provider };
}

export function sortModelIds(ids: string[], kind: "chat" | "image"): string[] {
  const rankMap = kind === "chat" ? CHAT_RANK : IMAGE_RANK;
  const familyIndex = (f: string) => {
    if (f === "gemini") return 0;
    if (f === "gpt") return 1;
    return 99;
  };
  return [...ids].sort((a, b) => {
    const fa = detectFamily(a);
    const fb = detectFamily(b);
    if (fa !== fb) return familyIndex(fa) - familyIndex(fb);
    const ra = rankMap[a] ?? 0;
    const rb = rankMap[b] ?? 0;
    if (ra !== rb) return rb - ra;
    return a.localeCompare(b);
  });
}

export function pickDefault(ids: string[], preferred?: string): string {
  if (preferred && ids.includes(preferred)) return preferred;
  return ids[0] || "";
}

/** 仅保留 Gemini & GPT 的完整种子库 */
export const CHAT_MODEL_CANDIDATES = CHAT_ALLOWLIST;
export const IMAGE_MODEL_CANDIDATES = IMAGE_ALLOWLIST;

export const FREE_TRANSCRIBE_SITES = [
  {
    name: "SoundTools 语音转文字",
    url: "https://soundtools.io/speech-to-text/",
    note: "打开网页就能转，一般不用注册",
  },
  {
    name: "Zalt 语音转文字",
    url: "https://zalt.me/tools/speech-to-text",
    note: "浏览器里转换，适合先转好再粘贴回来",
  },
  {
    name: "Whisper Web",
    url: "https://whisperweb.dev/whisper-transcription",
    note: "免费在线转写工具",
  },
  {
    name: "EarScribe",
    url: "https://earscribe.app/whisper-online",
    note: "免费在线转写，可自选模型大小",
  },
] as const;

export const CUTE_ERRORS = [
  "哎呀，画笔打了个小瞌睡，再点一次「生成绘本」试试～",
  "小画家刚才走神了，我们再试一次好不好？",
  "绘本还在路上堵车啦，稍后再生成一次吧～",
  "这次没画成功，深呼吸，再试一次就好！",
] as const;
