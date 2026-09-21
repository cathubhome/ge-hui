# 歌绘（ge-hui）

上传**歌曲音频**或 **PDF 歌词**，生成**一页童趣分格绘本图**。

产品定位：儿童教育向「听歌 / 读词 → 一页可下载绘本」。视觉参考：扁平矢量、圆形分格、同一角色多姿态、中英双语标注。

---

## 功能

| 能力 | 无 API Key | 配置 OpenAI 后 |
|------|------------|----------------|
| 粘贴歌词生成绘本 | ✅ 本地矢量渲染 | ✅ 也可用 Chat 规划场景 |
| PDF 抽歌词 | ✅ | ✅ |
| 音频转写歌词 | ❌ | ✅ Whisper |
| AI 位图出图 | ❌ | ✅ Images API |
| 下载绘本页 | ✅ SVG | ✅ |

---

## 前置条件

### 1. 本机环境

- Node.js 20+（本机已验证可用）
- npm 9+
- Windows / macOS / Linux 均可

### 2. 大模型 / API（按需）

在项目根目录复制环境变量：

```bash
copy .env.example .env.local
```

编辑 `.env.local`：

```env
OPENAI_API_KEY=sk-xxxxxxxx
```

| 用途 | 默认模型 | 环境变量 |
|------|----------|----------|
| 场景规划（歌词→8 格动作） | `gpt-4o-mini` | `OPENAI_CHAT_MODEL` |
| 音频转写 | `whisper-1` | `OPENAI_TRANSCRIBE_MODEL` |
| AI 出图 | `gpt-image-1` | `OPENAI_IMAGE_MODEL` |

说明：

- **最小可演示路径不需要任何大模型**：粘贴歌词 → 选择「本地矢量绘本页」→ 生成即可。
- 音频上传转写、以及页面上的「OpenAI 图像模型」出图，才需要 `OPENAI_API_KEY`。
- 也可用兼容 OpenAI 协议的中转；把请求打到官方 `https://api.openai.com` 的实现在 `src/app/api/*`，如需改 base URL 可自行扩展。

### 3. 不需要的东西（v1）

- 无需数据库、登录、支付
- 无需 Origin / GitHub（本仓库是本地 git 即可）

---

## 快速开始

```bash
cd D:\wangyq158\workspace\ge-hui
npm install
npm run dev
```

浏览器打开：http://localhost:3000

推荐自测路径：

1. 页面已预填 *Head, Shoulders, Knees and Toes* 歌词  
2. 出图方式选 **本地矢量绘本页**  
3. 点 **生成一页绘本** → 右侧预览 → **下载绘本页**

离线自测脚本（不启动服务）：

```bash
node scripts/selftest.mjs
```

会写出：

- `public/samples/head-shoulders-selftest.svg`（最终样图）
- `public/samples/head-shoulders-plan.json`

---

## 项目结构

```
src/app/page.tsx                 # 上传 / 粘贴 / 生成 UI
src/app/api/extract-pdf          # PDF 抽词
src/app/api/transcribe           # Whisper 转写
src/app/api/plan-scene           # 场景规划（本地规则 or Chat）
src/app/api/generate-image       # 本地 SVG 或 OpenAI Images
src/lib/plan-scene-local.ts      # 无 Key 场景规划
src/lib/render-picturebook.ts    # 童趣分格 SVG 渲染
public/style-reference.jpg       # 风格参考
public/samples/                  # 自测样图
```

---

## 产品决策（v1）

1. **一页成稿**：不做多页翻页书，先打通「输入 → 一页可下载」。  
2. **双引擎出图**：本地 SVG 保证可演示、可自测；OpenAI 图像作为增强。  
3. **风格锁定**：参考儿童教育分格页（圆形画框 + 同一角色多姿态 + 双语标签）。  
4. **版权**：页脚免责声明；正式商用请替换角色设计与素材授权。

---

## 常见问题

**Q: 没有 OpenAI Key 能玩吗？**  
能。用粘贴歌词 + 本地矢量模式。

**Q: 音频上传报错？**  
检查 `.env.local` 是否配置了有效的 `OPENAI_API_KEY`，并确认账号开通了 Audio API。

**Q: AI 出图和参考图不一致？**  
图像模型对「分格+文字」不够稳。v1 推荐以本地矢量页为默认产品形态；AI 出图适合氛围稿。后续可改为「AI 只画角色、前端排版」。

---

## License

仅供学习与内部演示。歌曲与歌词版权归原权利方所有。
