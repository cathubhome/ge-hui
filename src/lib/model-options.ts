export type ModelOption = { id: string; label: string; hint?: string; isPro?: boolean };

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

function prettyLabel(id: string): string {
  return id
    .split("/")
    .pop()!
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Higher = better / prefer earlier within a family. Unknown ids get 0. */
export const CHAT_RANK: Record<string, number> = {
  "gemini-3.8-flash-high": 100,
  "gemini-3.1-pro-low": 90,
  "gpt-6-astra": 110, // 👑 Pro 专享 · OpenAI 顶尖对话分镜构思大模型
  "gpt-5.6-sol": 105, // 👑 Pro 专享 · OpenAI 旗舰大模型
  "gpt-5.6-terra": 95, // 👑 Pro 专享
  "gpt-5.5": 85, // 👑 Pro 专享
  "glm-5.3": 100,
  "grok-4.6": 100,
};

export const PRO_CHAT_MODELS = [
  "gpt-6-astra",
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.5",
];

/** Listening / scene-planning models shown in Advanced settings. */
export const CHAT_ALLOWLIST = Object.keys(CHAT_RANK);

export const IMAGE_RANK: Record<string, number> = {
  "gemini-3.1-flash-image": 120, // Google 原生多模态极速绘本出图 · 默认推荐
  "gpt-image-2.5-sunburst": 115, // 👑 Pro 专享 · 殿堂级原画
  "gpt-image-2.5-flare": 110, // 👑 Pro 专享 · 细腻原画
  "gpt-image-2.5": 105, // 👑 Pro 专享 · 经典超清原画
  "gpt-image-2": 95, // 👑 Pro 专享 · 经典原画
  "gpt-image-1.5": 80, // 👑 Pro 专享 · 轻量原画
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

export function isChatCapable(id: string): boolean {
  return CHAT_ALLOWLIST.includes(id);
}

export function isImageCapable(id: string): boolean {
  const s = id.toLowerCase();
  if (s.includes("video")) return false;
  // Gemini 3.1 Flash Image 支持多模态 Chat 生图
  if (s.includes("gemini") && s.includes("image")) return true;
  if (s.includes("gpt-image")) return true;
  if (s.includes("grok-imagine-image")) return true;
  return false;
}

export function toOption(id: string, kind: "chat" | "image"): ModelOption {
  const rank = kind === "chat" ? CHAT_RANK[id] : IMAGE_RANK[id];
  let hint = rank && rank >= 90 ? "推荐" : undefined;
  let label = prettyLabel(id);
  const isPro = kind === "chat" ? PRO_CHAT_MODELS.includes(id) : PRO_IMAGE_MODELS.includes(id);

  if (kind === "image") {
    if (id === "gemini-3.1-flash-image") {
      label = "Gemini 3.1 Flash Image (极速光影 · 优先推荐)";
      hint = "极速";
    } else if (id === "gpt-image-2.5") {
      label = "GPT Image 2.5 (👑 Pro 专享 · 殿堂级原画)";
      hint = "👑 Pro 殿堂";
    } else if (id === "gpt-image-2") {
      label = "GPT Image 2 (👑 Pro 专享 · 经典原画)";
      hint = "👑 Pro 经典";
    } else if (isPro) {
      label = `${label} (👑 Pro 专享)`;
      hint = "👑 Pro";
    }
  } else if (kind === "chat") {
    if (id === "gpt-6-astra") {
      label = "GPT-6 Astra (👑 Pro 专享 · 顶尖构思)";
      hint = "👑 Pro 顶尖";
    } else if (id === "gpt-5.6-sol") {
      label = "GPT-5.6 Sol (👑 Pro 专享 · 旗舰)";
      hint = "👑 Pro 旗舰";
    } else if (isPro) {
      label = `${label} (👑 Pro 专享)`;
      hint = "👑 Pro";
    }
  }

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
