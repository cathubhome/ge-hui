import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Dynamic import compiled? We reimplement minimal call via tsx alternative:
// Instead duplicate local planner + svg in plain JS for self-test independence.

function planSceneLocal(lyrics) {
  const lines = lyrics
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\d.\-*]+\s*/, "").trim())
    .filter(Boolean);
  const bodyParts = [
    { labelEn: "HEAD", labelZh: "头", action: "双手放在头顶" },
    { labelEn: "SHOULDERS", labelZh: "肩膀", action: "双手放到肩膀" },
    { labelEn: "KNEES", labelZh: "膝盖", action: "弯腰摸膝盖" },
    { labelEn: "TOES", labelZh: "脚趾", action: "低头摸脚趾" },
    { labelEn: "EYES", labelZh: "眼睛", action: "指向眼睛" },
    { labelEn: "EARS", labelZh: "耳朵", action: "指向耳朵" },
    { labelEn: "MOUTH", labelZh: "嘴巴", action: "双手放在嘴边" },
    { labelEn: "NOSE", labelZh: "鼻子", action: "指向鼻子" },
  ];
  return {
    titleEn: "HEAD, SHOULDERS, KNEES & TOES",
    titleZh: "头 · 肩膀 · 膝盖 · 脚趾",
    lyricExcerpt: lines.slice(0, 6).join("\n"),
    instructionZh: "边唱边指一指，摸一摸！",
    panels: bodyParts,
  };
}

const CIRCLE_COLORS = ["#FF6B2C", "#FF5FA2", "#6B3FA0", "#1DB8A6", "#FF6B2C", "#FF5FA2", "#6B3FA0", "#1DB8A6"];

function escapeXml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildSvg(plan) {
  const W = 1200, H = 900;
  const startX = 420, startY = 120, gapX = 180, gapY = 280, r = 70;
  const circles = plan.panels.map((p, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const cx = startX + col * gapX;
    const cy = startY + row * gapY + 80;
    const fill = CIRCLE_COLORS[i % CIRCLE_COLORS.length];
    const headY = cy - 18;
    return `
      <text x="${cx}" y="${cy - r - 28}" text-anchor="middle" font-family="Arial" font-size="18" font-weight="700">${escapeXml(p.labelEn)}</text>
      <text x="${cx}" y="${cy - r - 8}" text-anchor="middle" font-family="Microsoft YaHei, Arial" font-size="14">${escapeXml(p.labelZh)}</text>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" />
      <circle cx="${cx}" cy="${headY}" r="16" fill="#FF8A4C"/>
      <circle cx="${cx - 5}" cy="${headY - 2}" r="2.2" fill="#222"/>
      <circle cx="${cx + 5}" cy="${headY - 2}" r="2.2" fill="#222"/>
      <circle cx="${cx}" cy="${headY + 3}" r="2.5" fill="#E74C3C"/>
      <rect x="${cx - 18}" y="${cy - 2}" width="36" height="34" rx="8" fill="#3A6EA5"/>
      <ellipse cx="${cx - 14}" cy="${cy + 52}" rx="9" ry="5" fill="#E74C3C"/>
      <ellipse cx="${cx + 14}" cy="${cy + 52}" rx="9" ry="5" fill="#E74C3C"/>
    `;
  }).join("\n");

  const lyric = escapeXml(plan.lyricExcerpt).split("\n").slice(0, 8)
    .map((line, i) => `<tspan x="48" dy="${i === 0 ? 0 : 22}">${line || " "}</tspan>`).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#F7F3E8"/>
  <ellipse cx="200" cy="820" rx="520" ry="160" fill="#A8D5E5"/>
  <ellipse cx="700" cy="860" rx="480" ry="140" fill="#F5D76E"/>
  <ellipse cx="1050" cy="800" rx="360" ry="150" fill="#7BC8B8"/>
  <text x="40" y="56" font-family="Arial Black, Arial" font-size="28" font-weight="900">${escapeXml(plan.titleEn)}</text>
  <text x="40" y="88" font-family="Microsoft YaHei, Arial" font-size="20">${escapeXml(plan.titleZh)}</text>
  <rect x="32" y="120" width="340" height="320" rx="18" fill="#fff" stroke="#e5e5e5"/>
  <text x="48" y="152" font-family="Arial Black" font-size="16">SING &amp; MOVE</text>
  <text x="48" y="190" font-family="Microsoft YaHei, Arial" font-size="15">${lyric}</text>
  <text x="48" y="410" font-family="Microsoft YaHei, Arial" font-size="14">${escapeXml(plan.instructionZh)}</text>
  ${circles}
  <text x="${W - 24}" y="${H - 20}" text-anchor="end" font-size="12" fill="#999">歌绘 · 自测样图</text>
</svg>`;
}

const lyrics = `Head, shoulders, knees and toes
And eyes and ears and mouth and nose
头，肩膀，膝盖，脚趾
眼睛，耳朵，嘴巴，鼻子`;

const plan = planSceneLocal(lyrics);
const outDir = join(root, "public", "samples");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "head-shoulders-selftest.svg");
writeFileSync(outPath, buildSvg(plan), "utf8");
writeFileSync(join(outDir, "head-shoulders-plan.json"), JSON.stringify(plan, null, 2), "utf8");
console.log("OK wrote", outPath);
