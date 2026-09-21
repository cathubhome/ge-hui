# 歌绘（ge-hui）

上传**歌曲音频**或 **PDF 歌词**，生成**一页童趣分格绘本图**。

面向 **2 核 2G Linux**：本机只跑 Next 网页；转写 / 场景规划 / 可选 AI 出图走 **CPA**。

---

## 能力一览

| 能力 | 无 CPA Key | 配置 CPA 后 |
|------|------------|-------------|
| 粘贴歌词生成绘本 | ✅ 本地矢量 | ✅ |
| PDF 抽歌词 | ✅ | ✅ |
| 音频听写 | ❌ | ✅ Gemini 多模态（**不用 Whisper**） |
| 场景规划 | ✅ 本地规则 | ✅ 默认 `gemini-3.8-flash-high`，失败回退 `glm-5.3` |
| AI 位图出图 | ❌ | ✅ `gpt-image-2`（失败回退本地矢量） |
| 本地矢量绘本页 | ✅ 默认 | ✅ |

---

## 前置条件

### 本机 / 服务器
- Node.js 20+
- 建议 2C2G：只跑 `next start`，不要在同机跑 Whisper 大模型

### CPA
```bash
cp .env.example .env.local
# 填入 CPA_API_KEY（与 CC Switch 里 Codex CPA 同源，前缀一般为 sk-cpa-）
```

| 变量 | 默认 | 说明 |
|------|------|------|
| `CPA_BASE_URL` | `https://api.3099520.xyz/v1` | CPA OpenAI 兼容地址 |
| `CPA_API_KEY` | — | 必填才可听写 / CPA 规划 / AI 出图 |
| `CPA_CHAT_MODEL` | `gemini-3.8-flash-high` | 场景规划默认 |
| `CPA_CHAT_FALLBACK_MODEL` | `glm-5.3` | 规划失败时备选 |
| `CPA_TRANSCRIBE_MODEL` | `gemini-3.8-flash-high` | 音频多模态听写 |
| `CPA_IMAGE_MODEL` | `gpt-image-2` | 可选 AI 出图 |
| `DEFAULT_IMAGE_MODE` | `canvas` | `canvas` 或 `cpa-image` |

---

## 快速开始

```bash
cd /path/to/ge-hui
npm install
npm run dev
```

打开 http://localhost:3000

生产：
```bash
npm run build && npm run start
```

---

## 说明
- 音频听写走 Chat Completions 多模态，**不是** `/v1/audio/transcriptions`。
- GPT 系在 CPA 上可能返回 `Audio input is not available`，故转写固定 Gemini。
- 伴奏歌声可能听写不准：结果会进歌词框，请人工改后再出图。
