export type ModelOption = {
  id: string;
  label: string;
  shortLabel?: string;
  hint?: string;
  isPro?: boolean;
};

export type ModelFamily = "gemini" | "gpt" | "glm" | "grok" | "other";

/** Family display order requested by product. */
export const FAMILY_ORDER: ModelFamily[] = ["gemini", "gpt", "glm", "grok"];

export function detectFamily(id: string): ModelFamily {
  const s = id.toLowerCase();
  if (s.includes("gemini")) return "gemini";
  if (s.startsWith("gpt") || s.includes("gpt-")) return "gpt";
  if (s.includes("glm")) return "glm";
  if (s.includes("grok")) return "grok";
  return "other";
}

/** Higher = better / prefer earlier within a family. Unknown ids get 0. */
export const CHAT_RANK: Record<string, number> = {
  "gemini-3.8-flash-high": 100,
  "gemini-3.1-pro-low": 90,
  "gpt-6-astra": 110,
  "gpt-5.6-sol": 105,
  "gpt-5.6-terra": 95,
  "gpt-5.5": 85,
  "glm-5.3": 100,
  "grok-4.6": 100,
};

export const PRO_CHAT_MODELS = [
  "gpt-6-astra",
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.5",
];

export const CHAT_ALLOWLIST = Object.keys(CHAT_RANK);

export const IMAGE_RANK: Record<string, number> = {
  "gemini-3.1-flash-image": 120,
  "gpt-image-2.5-sunburst": 115,
  "gpt-image-2.5-flare": 110,
  "gpt-image-2.5": 105,
  "gpt-image-2": 95,
  "gpt-image-1.5": 80,
  "grok-imagine-image-quality": 90,
  "grok-imagine-image-2.0": 85,
  "grok-imagine-image": 75,
};

export const PRO_IMAGE_MODELS = [
  "gpt-image-2.5-sunburst",
  "gpt-image-2.5-flare",
  "gpt-image-2.5",
  "gpt-image-2",
  "gpt-image-1.5",
  "grok-imagine-image-quality",
];

/**
 * 将技术模型代号映射为儿童绘本通俗艺术分档与画师标签
 */
const CHAT_FRIENDLY_LABELS: Record<string, { label: string; hint?: string }> = {
  "gemini-3.8-flash-high": { label: "🌱 欢快童话编排 (极速构思 · 推荐)", hint: "推荐" },
  "gemini-3.1-pro-low": { label: "🌿 温润生活小剧本 (生动细腻)", hint: "温润" },
  "glm-5.3": { label: "📚 启蒙韵律童谣 (通俗易懂)", hint: "启蒙" },
  "grok-4.6": { label: "🎠 趣味故事工坊 (机灵幽默)", hint: "趣味" },
  "gpt-6-astra": { label: "👑 顶级名家分镜大师 (Pro 专享 · 殿堂级)", hint: "👑 殿堂" },
  "gpt-5.6-sol": { label: "👑 国际双语名作构思 (Pro 专享 · 旗舰)", hint: "👑 旗舰" },
  "gpt-5.6-terra": { label: "👑 深度自然启蒙剧作 (Pro 专享)", hint: "👑 Pro" },
  "gpt-5.5": { label: "👑 经典绘本戏剧工坊 (Pro 专享)", hint: "👑 Pro" },
};

const IMAGE_FRIENDLY_LABELS: Record<string, { label: string; hint?: string }> = {
  "gemini-3.1-flash-image": { label: "🎨 启蒙标清画师 (极速出画 · 优先推荐)", hint: "极速推荐" },
  "gpt-image-2.5": { label: "👑 4K 印刷级超清原画师 (Pro 专享 · 殿堂级)", hint: "👑 殿堂原画" },
  "gpt-image-2": { label: "👑 经典童画温润原画师 (Pro 专享)", hint: "👑 Pro" },
  "gpt-image-1.5": { label: "👑 轻盈绘本水彩画师 (Pro 专享)", hint: "👑 Pro" },
  "gpt-image-2.5-sunburst": { label: "👑 阳光复古绘本原画师 (Pro 专享)", hint: "👑 阳光复古" },
  "gpt-image-2.5-flare": { label: "👑 梦幻光影绘本画师 (Pro 专享)", hint: "👑 梦幻光影" },
  "grok-imagine-image-quality": { label: "👑 萌趣高质感插画师 (Pro 专享)", hint: "👑 Pro" },
  "grok-imagine-image-2.0": { label: "🎨 奇趣卡通造形画师", hint: "卡通" },
};

export function isChatCapable(id: string): boolean {
  return CHAT_ALLOWLIST.includes(id);
}

export function isImageCapable(id: string): boolean {
  const s = id.toLowerCase();
  if (s.includes("video")) return false;
  if (s.includes("gemini") && s.includes("image")) return true;
  if (s.includes("gpt-image")) return true;
  if (s.includes("grok-imagine-image")) return true;
  return false;
}

export function toOption(id: string, kind: "chat" | "image"): ModelOption {
  const isPro = kind === "chat" ? PRO_CHAT_MODELS.includes(id) : PRO_IMAGE_MODELS.includes(id);
  const friendlyMap = kind === "chat" ? CHAT_FRIENDLY_LABELS : IMAGE_FRIENDLY_LABELS;
  const match = friendlyMap[id];

  if (match) {
    return {
      id,
      label: match.label,
      hint: match.hint,
      isPro,
    };
  }

  // Fallback for unknown dynamic models
  const rank = kind === "chat" ? CHAT_RANK[id] : IMAGE_RANK[id];
  const hint = rank && rank >= 90 ? "推荐" : isPro ? "👑 Pro" : undefined;
  const rawTitle = id.split("/").pop()!.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const label = isPro ? `${rawTitle} (👑 Pro 专享)` : rawTitle;

  return { id, label, hint, isPro };
}

export function sortModelIds(ids: string[], kind: "chat" | "image"): string[] {
  const rankMap = kind === "chat" ? CHAT_RANK : IMAGE_RANK;
  const familyIndex = (f: ModelFamily) => {
    const i = FAMILY_ORDER.indexOf(f);
    return i === -1 ? 99 : i;
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

/** Curated seed list */
export const CHAT_MODEL_CANDIDATES = CHAT_ALLOWLIST;
export const IMAGE_MODEL_CANDIDATES = Object.keys(IMAGE_RANK);

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
