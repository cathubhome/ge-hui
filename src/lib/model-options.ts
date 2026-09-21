export type ModelOption = { id: string; label: string; hint?: string };

export const CHAT_MODEL_OPTIONS: ModelOption[] = [
  { id: "gemini-3.8-flash-high", label: "Gemini 3.8 Flash High", hint: "默认 · 较快" },
  { id: "glm-5.3", label: "GLM 5.3", hint: "备选" },
  { id: "gemini-3.7-flash-high", label: "Gemini 3.7 Flash High" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "gpt-5.5", label: "GPT 5.5" },
  { id: "gpt-5.6-sol", label: "GPT 5.6 Sol" },
  { id: "grok-4.6", label: "Grok 4.6" },
];

export const TRANSCRIBE_MODEL_OPTIONS: ModelOption[] = [
  { id: "gemini-3.8-flash-high", label: "Gemini 3.8 Flash High", hint: "推荐听写" },
  { id: "gemini-3.7-flash-high", label: "Gemini 3.7 Flash High" },
  { id: "gemini-3-flash", label: "Gemini 3 Flash" },
  { id: "gemini-pro-agent", label: "Gemini Pro Agent" },
];

export const IMAGE_MODEL_OPTIONS: ModelOption[] = [
  { id: "gpt-image-2", label: "GPT Image 2", hint: "默认" },
  { id: "gpt-image-2.5", label: "GPT Image 2.5" },
  { id: "gpt-image-1.5", label: "GPT Image 1.5" },
  { id: "grok-imagine-image", label: "Grok Imagine" },
  { id: "grok-imagine-image-2.0", label: "Grok Imagine 2.0" },
];

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
