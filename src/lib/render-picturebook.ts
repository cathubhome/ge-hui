import type { ScenePlan } from "./types";

const CIRCLE_COLORS = ["#FF6B2C", "#FF5FA2", "#6B3FA0", "#1DB8A6", "#FF6B2C", "#FF5FA2", "#6B3FA0", "#1DB8A6"];

/** Server-side PNG renderer using pure Canvas API via node-canvas if available;
 * fallback: return SVG string encoded as data URL for client download.
 * For Next.js we use a client-side canvas helper; this module holds shared layout math + SVG export.
 */
export function buildPictureBookSvg(plan: ScenePlan): string {
  const W = 1200;
  const H = 900;
  const panels = plan.panels.slice(0, 8);
  while (panels.length < 8) {
    panels.push({
      labelEn: `SCENE ${panels.length + 1}`,
      labelZh: `场景 ${panels.length + 1}`,
      action: "开心挥手",
    });
  }

  const startX = 420;
  const startY = 120;
  const gapX = 180;
  const gapY = 280;
  const r = 70;

  const circles = panels
    .map((p, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const cx = startX + col * gapX;
      const cy = startY + row * gapY + 80;
      const fill = CIRCLE_COLORS[i % CIRCLE_COLORS.length];
      const pose = posePath(p.action, cx, cy);
      return `
      <text x="${cx}" y="${cy - r - 28}" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#1a1a1a">${escapeXml(p.labelEn)}</text>
      <text x="${cx}" y="${cy - r - 8}" text-anchor="middle" font-family="Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="14" fill="#444">${escapeXml(p.labelZh)}</text>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" />
      ${pose}
      `;
    })
    .join("\n");

  const lyricLines = escapeXml(plan.lyricExcerpt)
    .split("\n")
    .slice(0, 8)
    .map((line, i) => `<tspan x="48" dy="${i === 0 ? 0 : 22}">${line || " "}</tspan>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="hill1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#B8E0F0"/>
      <stop offset="100%" stop-color="#7EC8E3"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#F7F3E8"/>
  <ellipse cx="200" cy="820" rx="520" ry="160" fill="#A8D5E5" opacity="0.9"/>
  <ellipse cx="700" cy="860" rx="480" ry="140" fill="#F5D76E" opacity="0.85"/>
  <ellipse cx="1050" cy="800" rx="360" ry="150" fill="#7BC8B8" opacity="0.8"/>

  <text x="40" y="56" font-family="Arial Black, Arial, sans-serif" font-size="28" font-weight="900" fill="#1a1a1a">${escapeXml(plan.titleEn)}</text>
  <text x="40" y="88" font-family="Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="20" fill="#333">${escapeXml(plan.titleZh)}</text>

  <rect x="32" y="120" width="340" height="320" rx="18" fill="#fff" stroke="#e5e5e5"/>
  <text x="48" y="152" font-family="Arial Black, Arial, sans-serif" font-size="16" fill="#222">SING &amp; MOVE</text>
  <text x="48" y="190" font-family="Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="15" fill="#333">
    ${lyricLines}
  </text>
  <text x="48" y="410" font-family="Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="14" fill="#666">${escapeXml(plan.instructionZh)}</text>

  ${circles}

  <text x="${W - 24}" y="${H - 20}" text-anchor="end" font-family="Arial, 'PingFang SC', sans-serif" font-size="12" fill="#999">歌绘 · 童趣绘本页</text>
</svg>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Simple stick-figure-ish character poses inside a circle */
function posePath(action: string, cx: number, cy: number): string {
  const skin = "#FF8A4C";
  const shirt = "#3A6EA5";
  const shoe = "#E74C3C";
  const a = action.toLowerCase();

  // body baseline
  const headY = cy - 18;
  let armL = `M ${cx - 22} ${cy + 5} L ${cx - 38} ${cy + 20}`;
  let armR = `M ${cx + 22} ${cy + 5} L ${cx + 38} ${cy + 20}`;

  if (/头|head|头顶/.test(a)) {
    armL = `M ${cx - 18} ${cy + 2} L ${cx - 28} ${headY - 22}`;
    armR = `M ${cx + 18} ${cy + 2} L ${cx + 28} ${headY - 22}`;
  } else if (/肩|shoulder/.test(a)) {
    armL = `M ${cx - 18} ${cy + 2} L ${cx - 42} ${cy - 2}`;
    armR = `M ${cx + 18} ${cy + 2} L ${cx + 42} ${cy - 2}`;
  } else if (/膝|knee/.test(a)) {
    armL = `M ${cx - 18} ${cy + 2} L ${cx - 20} ${cy + 38}`;
    armR = `M ${cx + 18} ${cy + 2} L ${cx + 20} ${cy + 38}`;
  } else if (/趾|toe|脚/.test(a)) {
    armL = `M ${cx - 16} ${cy + 2} L ${cx - 10} ${cy + 48}`;
    armR = `M ${cx + 16} ${cy + 2} L ${cx + 10} ${cy + 48}`;
  } else if (/眼|eye/.test(a)) {
    armL = `M ${cx - 16} ${cy + 2} L ${cx - 12} ${headY}`;
    armR = `M ${cx + 16} ${cy + 2} L ${cx + 12} ${headY}`;
  } else if (/耳|ear/.test(a)) {
    armL = `M ${cx - 16} ${cy + 2} L ${cx - 36} ${headY}`;
    armR = `M ${cx + 16} ${cy + 2} L ${cx + 36} ${headY}`;
  } else if (/嘴|mouth/.test(a)) {
    armL = `M ${cx - 16} ${cy + 2} L ${cx - 8} ${cy - 2}`;
    armR = `M ${cx + 16} ${cy + 2} L ${cx + 8} ${cy - 2}`;
  } else if (/鼻|nose/.test(a)) {
    armL = `M ${cx - 16} ${cy + 2} L ${cx - 2} ${cy - 6}`;
    armR = `M ${cx + 16} ${cy + 2} L ${cx + 2} ${cy - 6}`;
  }

  return `
    <circle cx="${cx}" cy="${headY}" r="16" fill="${skin}"/>
    <circle cx="${cx - 5}" cy="${headY - 2}" r="2.2" fill="#222"/>
    <circle cx="${cx + 5}" cy="${headY - 2}" r="2.2" fill="#222"/>
    <circle cx="${cx}" cy="${headY + 3}" r="2.5" fill="#E74C3C"/>
    <path d="M ${cx - 6} ${headY + 8} Q ${cx} ${headY + 14} ${cx + 6} ${headY + 8}" fill="none" stroke="#222" stroke-width="2" stroke-linecap="round"/>
    <rect x="${cx - 18}" y="${cy - 2}" width="36" height="34" rx="8" fill="${shirt}"/>
    <path d="${armL}" stroke="${skin}" stroke-width="7" stroke-linecap="round" fill="none"/>
    <path d="${armR}" stroke="${skin}" stroke-width="7" stroke-linecap="round" fill="none"/>
    <path d="M ${cx - 10} ${cy + 30} L ${cx - 14} ${cy + 48}" stroke="${skin}" stroke-width="7" stroke-linecap="round"/>
    <path d="M ${cx + 10} ${cy + 30} L ${cx + 14} ${cy + 48}" stroke="${skin}" stroke-width="7" stroke-linecap="round"/>
    <ellipse cx="${cx - 14}" cy="${cy + 52}" rx="9" ry="5" fill="${shoe}"/>
    <ellipse cx="${cx + 14}" cy="${cy + 52}" rx="9" ry="5" fill="${shoe}"/>
  `;
}

export function svgToDataUrl(svg: string): string {
  const encoded = Buffer.from(svg, "utf8").toString("base64");
  return `data:image/svg+xml;base64,${encoded}`;
}
