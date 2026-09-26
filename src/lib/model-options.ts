export type ModelOption = { id: string; label: string; hint?: string };

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
const CHAT_RANK: Record<string, number> = {
  "gemini-3.8-flash-high": 100,
  "gemini-3.1-pro-low": 90,
  "gpt-5.6-sol": 100,
  "gpt-5.6-terra": 90,
  "glm-5.3": 100,
  "grok-4.6": 100,
};

/** Listening / scene-planning models shown in Advanced settings. */
export const CHAT_ALLOWLIST = Object.keys(CHAT_RANK);

const IMAGE_RANK: Record<string, number> = {
  "gemini-3.1-flash-image": 120, // Google 原生多模态极速绘本出图 · 优先推荐
  "gpt-image-2.5-sunburst": 100,
  "gpt-image-2.5-flare": 98,
  "gpt-image-2.5": 94,
  "gpt-image-2": 88,
  "gpt-image-1.5": 70,
  "grok-imagine-image-quality": 100,
  "grok-imagine-image-2.0": 92,
  "grok-imagine-image": 84,
};

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

  if (kind === "image") {
    if (id === "gemini-3.1-flash-image") {
      label = "Gemini 3.1 Flash Image (极速出画 · 优先推荐)";
      hint = "极速";
    } else if (id.includes("2.5")) {
      label = `${label} (👑 Pro 超清原画)`;
      hint = "👑 Pro";
    }
  }

  return { id, label, hint };
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

/** Curated seed list — only shown when also present in live /models. */
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
