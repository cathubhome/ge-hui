export type ModelOption = { id: string; label: string; hint?: string };

/** Curated from CPA live /v1/models — keep in sync with Documents/cpa-live-models.json */
export const CHAT_MODEL_OPTIONS: ModelOption[] = [
  { id: "gemini-3.8-flash-high", label: "gemini-3.8-flash-high", hint: "默认 · 快" },
  { id: "glm-5.3", label: "glm-5.3", hint: "备选" },
  { id: "gemini-3.7-flash-high", label: "gemini-3.7-flash-high" },
  { id: "claude-sonnet-4-6", label: "claude-sonnet-4-6" },
  { id: "gpt-5.5", label: "gpt-5.5" },
  { id: "gpt-5.6-sol", label: "gpt-5.6-sol" },
  { id: "grok-4.6", label: "grok-4.6" },
];

export const TRANSCRIBE_MODEL_OPTIONS: ModelOption[] = [
  { id: "gemini-3.8-flash-high", label: "gemini-3.8-flash-high", hint: "推荐 · 已实测可听音频" },
  { id: "gemini-3.7-flash-high", label: "gemini-3.7-flash-high" },
  { id: "gemini-3-flash", label: "gemini-3-flash" },
  { id: "gemini-pro-agent", label: "gemini-pro-agent" },
];

export const IMAGE_MODEL_OPTIONS: ModelOption[] = [
  { id: "gpt-image-2", label: "gpt-image-2", hint: "默认" },
  { id: "gpt-image-2.5", label: "gpt-image-2.5" },
  { id: "gpt-image-1.5", label: "gpt-image-1.5" },
  { id: "grok-imagine-image", label: "grok-imagine-image" },
  { id: "grok-imagine-image-2.0", label: "grok-imagine-image-2.0" },
];

export const FREE_TRANSCRIBE_SITES = [
  {
    name: "SoundTools Speech to Text",
    url: "https://soundtools.io/speech-to-text/",
    note: "浏览器本地 Whisper，免注册，音频不上传",
  },
  {
    name: "Zalt Speech to Text",
    url: "https://zalt.me/tools/speech-to-text",
    note: "浏览器本地 Whisper，免注册",
  },
  {
    name: "Whisper Web",
    url: "https://whisperweb.dev/whisper-transcription",
    note: "浏览器本地，免 API Key；大文件可能有时长限制",
  },
  {
    name: "EarScribe Whisper Online",
    url: "https://earscribe.app/whisper-online",
    note: "浏览器本地，可选 tiny/base/small 等模型",
  },
] as const;
