# 歌绘（ge-hui）🎵

> **一首歌 · 一张画 · 一起唱**  
> 专为 2~6 岁启蒙家庭与幼教机构打造的——**“护眼、去屏幕化”的一页式儿歌启蒙挂图与绘本合页生成工具**。

上传**绘本 PDF**、**歌曲音频**或**粘贴歌词**，一键生成一张适合打印贴墙、让孩子边指边唱的精美横版启蒙歌绘本！

---

## ✨ 核心特色与卖点

- 📄 **一页纸法则（One-Page Spread）**：不做 15 页积灰的故事长册，专注做“一张纸搞定一首儿歌”，专为打印贴墙（A4/A3）、黑板贴或床头伴读设计。
- 🧸 **绘本私域角色锁定**：智能识别 PDF 倒数第二页（N-1）角色定妆与第一页角色合集，精准继承原书画风与孩子心爱的人设，自动剔除原书商业 Logo、条码与广告水印。
- 🖨️ **专业 A4 打印与防切边留白**：
  - **一键原生打印**：一键调起浏览器系统打印或「另存为标准 A4 PDF」；
  - **高清 A4 挂图导出**：内置 2970 × 2100 像素高质量画布，预留 12mm 硬件安全出血区与精致底标，家用打印机无论怎么打都不切字、不切边。
- 🎨 **前置画面定制与心愿调节**：
  - **出镜角色**：`跟随绘本 (默认)` · `只要主角` · `小伙伴都在`；
  - **画面质感**：`绘本原画 (默认)` · `蜡笔童趣风` · `立体彩泥/剪纸`；
  - **补充愿望**：支持填写 40 字以内的个性化心愿（如：大家都要站着、背景在阳光草地上）。
- 🚫 **纯净无成人说教语**：出图提示词与渲染底盘全链路剔除“引导孩子们观察…”等教案式大白条，只保留纯粹的英文原词与童趣场景。
- ⚡ **极致性能与轻量化（面向 2C2G 极简服务器）**：
  - 采用 `uploadId` 引用直传，杜绝重复上传 10MB Base64 导致的网络中断与 `fetch failed`；
  - 视觉模型与分镜构思一步合并，参考图轻量化压缩，全流程耗时缩减近 50%。

---

## 🛠️ 能力一览

| 能力 | 无外部 API Key 时 | 配置 CPA / OpenAI 后 |
|------|:---:|:---:|
| **粘贴歌词生成绘本** | ✅ 本地矢量排版 | ✅ 专属 AI 绘本大图 |
| **PDF 抽词与角色识别** | ✅ 本地文字层提取 | ✅ 多模态全本角色与歌词智能提取 |
| **音频听歌写词** | ❌ | ✅ Gemini 多模态长音频直接听写 |
| **分镜与角色剧本构思** | ✅ 本地生活规则 | ✅ 原书人设与开放跨页场景一步到位 |
| **A4 物理安全边距排版** | ✅ | ✅ |
| **系统一键打印 / 存为 PDF** | ✅ | ✅ |

---

## ⚙️ 快速开始

### 1. 本地环境准备
- Node.js 20+
- 推荐配置：2 核 2G 即可平稳运行，无需昂贵的大显存 GPU。

### 2. 配置环境变量
复制环境配置：
```bash
cp .env.example .env.local
```

编辑 `.env.local` 填入您的中转或原生 API Key：
```env
# 中转服务（OpenAI 兼容接口）
CPA_BASE_URL=https://api.3099520.xyz/v1
CPA_API_KEY=sk-your-key-here

# 多模态解析与构思模型（默认 gemini，备选 glm）
CPA_CHAT_MODEL=gemini-3.8-flash-high
CPA_CHAT_FALLBACK_MODEL=glm-5.3

# 音频听写（Gemini 多模态）
CPA_TRANSCRIBE_MODEL=gemini-3.8-flash-high

# AI 图像生成模型（推荐 gpt-image-2.5 或 gpt-image-2）
CPA_IMAGE_MODEL=gpt-image-2.5
```

### 3. 安装依赖与启动
```bash
npm install
npm run dev
```
打开浏览器访问：`http://localhost:3000`

---

## 🚀 生产部署指南（以 Ubuntu / Debian 为例）

生产构建：
```bash
npm run build
npm run start
```

### 推荐 Systemd 服务配置（`/etc/systemd/system/ge-hui.service`）
```ini
[Unit]
Description=Ge-Hui Picture Book Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ge-hui
ExecStart=/usr/bin/npm run start
Restart=always
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

### 推荐 Nginx 反向代理配置（带超时与大包防护）
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 上传音频/PDF 限制放宽至 25MB
    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # 延长绘图长轮询等待超时
        proxy_connect_timeout 180s;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
    }
}
```

---

## 💡 使用小贴士

1. **为什么不需要成人引导语？**  
   歌绘是给小朋友看和唱的实体海报，纯净童趣的画面比说教式的活动指南更具感染力。
2. **打印建议**：  
   点击「🖨️ A4 打印 / 存为 PDF」后，建议在系统打印机选项中选择 **“横向”**、**“实际大小（100%）”**，画面四周的预留边距将确保完美成画！