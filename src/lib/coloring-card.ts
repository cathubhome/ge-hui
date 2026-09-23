/**
 * Coloring Card PDF Generator
 * Generates a black-and-white A4 landscape coloring page with:
 * - Main line-art image (centered, 75% of page height)
 * - Lyric tracing line at bottom (gray dashed text for kids to trace)
 * - Song title + branding bottom-left
 * - Listen QR code bottom-right (if available)
 */

import QRCode from "qrcode";

const A4_W = 2970;
const A4_H = 2100;
const MARGIN_X = 120;
const MARGIN_TOP = 80;
const MARGIN_BOTTOM = 130;

export async function canvasEdgeDetect(imageDataUrl: string): Promise<string> {
  const img = await loadImage(imageDataUrl);
  const w = img.width;
  const h = img.height;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  const srcData = ctx.getImageData(0, 0, w, h);
  const src = srcData.data;

  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = src[i * 4];
    const g = src[i * 4 + 1];
    const b = src[i * 4 + 2];
    gray[i] = r * 0.299 + g * 0.587 + b * 0.114;
  }

  const blurred = gaussianBlur(gray, w, h);
  const edges = sobelEdge(blurred, w, h);
  const threshold = computeOtsuThreshold(edges, w, h);

  const outData = ctx.createImageData(w, h);
  const out = outData.data;
  for (let i = 0; i < w * h; i++) {
    const isEdge = edges[i] > threshold * 0.55;
    const val = isEdge ? 0 : 255;
    out[i * 4] = val;
    out[i * 4 + 1] = val;
    out[i * 4 + 2] = val;
    out[i * 4 + 3] = 255;
  }
  ctx.putImageData(outData, 0, 0);
  dilateBlack(ctx, w, h, 1);

  return canvas.toDataURL("image/png");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

function gaussianBlur(gray: Float32Array, w: number, h: number): Float32Array {
  const kernel = [1, 4, 6, 4, 1];
  const kSum = 16;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -2; k <= 2; k++) {
        const sx = Math.min(Math.max(x + k, 0), w - 1);
        sum += gray[y * w + sx] * kernel[k + 2];
      }
      tmp[y * w + x] = sum / kSum;
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -2; k <= 2; k++) {
        const sy = Math.min(Math.max(y + k, 0), h - 1);
        sum += tmp[sy * w + x] * kernel[k + 2];
      }
      out[y * w + x] = sum / kSum;
    }
  }
  return out;
}

function sobelEdge(gray: Float32Array, w: number, h: number): Float32Array {
  const edges = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const tl = gray[(y - 1) * w + x - 1];
      const tc = gray[(y - 1) * w + x];
      const tr = gray[(y - 1) * w + x + 1];
      const ml = gray[y * w + x - 1];
      const mr = gray[y * w + x + 1];
      const bl = gray[(y + 1) * w + x - 1];
      const bc = gray[(y + 1) * w + x];
      const br = gray[(y + 1) * w + x + 1];

      const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
      edges[y * w + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return edges;
}

function computeOtsuThreshold(data: Float32Array, w: number, h: number): number {
  const hist = new Float64Array(256);
  let maxVal = 0;
  for (let i = 0; i < w * h; i++) {
    if (data[i] > maxVal) maxVal = data[i];
  }
  if (maxVal === 0) return 128;
  for (let i = 0; i < w * h; i++) {
    const bin = Math.min(255, Math.floor((data[i] / maxVal) * 255));
    hist[bin]++;
  }
  const total = w * h;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];

  let sumB = 0, wB = 0, wF: number;
  let maxVariance = 0, threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const variance = wB * wF * (mB - mF) * (mB - mF);
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }
  return (threshold / 255) * maxVal;
}

function dilateBlack(ctx: CanvasRenderingContext2D, w: number, h: number, radius: number) {
  const srcData = ctx.getImageData(0, 0, w, h);
  const src = srcData.data;
  const outData = ctx.createImageData(w, h);
  const out = outData.data;

  for (let i = 0; i < w * h * 4; i += 4) {
    out[i] = 255; out[i + 1] = 255; out[i + 2] = 255; out[i + 3] = 255;
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (src[idx] < 128) {
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              const ni = (ny * w + nx) * 4;
              out[ni] = 0; out[ni + 1] = 0; out[ni + 2] = 0;
            }
          }
        }
      }
    }
  }
  ctx.putImageData(outData, 0, 0);
}

export async function downloadColoringPdf(
  coloringDataUrl: string,
  songTitle?: string,
  lyricExcerpt?: string,
  listenUrl?: string,
): Promise<void> {
  const img = await loadImage(coloringDataUrl);

  const canvas = document.createElement("canvas");
  canvas.width = A4_W;
  canvas.height = A4_H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, A4_W, A4_H);

  const imgAreaW = A4_W - MARGIN_X * 2;
  const imgAreaH = A4_H - MARGIN_TOP - MARGIN_BOTTOM - 180;
  const scale = Math.min(imgAreaW / img.width, imgAreaH / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const drawX = MARGIN_X + (imgAreaW - drawW) / 2;
  const drawY = MARGIN_TOP + (imgAreaH - drawH) / 2;

  ctx.drawImage(img, drawX, drawY, drawW, drawH);

  if (lyricExcerpt) {
    const lyricY = A4_H - MARGIN_BOTTOM - 120;
    const lines = lyricExcerpt.split("\n").filter(Boolean).slice(0, 2);
    ctx.font = "500 52px 'KaiTi', 'Noto Sans SC', sans-serif";
    ctx.fillStyle = "#cccccc";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = "#dddddd";
    ctx.lineWidth = 1.5;
    lines.forEach((line: string, i: number) => {
      const y = lyricY + i * 65;
      ctx.fillText(line.slice(0, 60), A4_W / 2, y);
      const textW = ctx.measureText(line.slice(0, 60)).width;
      ctx.beginPath();
      ctx.moveTo(A4_W / 2 - textW / 2, y + 55);
      ctx.lineTo(A4_W / 2 + textW / 2, y + 55);
      ctx.stroke();
    });
    ctx.setLineDash([]);
  }

  const footerY = A4_H - MARGIN_BOTTOM + 10;
  ctx.font = "600 32px 'Noto Sans SC', sans-serif";
  ctx.fillStyle = "#999999";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const titleLabel = songTitle ? `${songTitle} · 涂色卡` : "歌绘 · 涂色卡";
  ctx.fillText(titleLabel, MARGIN_X, footerY);
  ctx.font = "400 24px 'Noto Sans SC', sans-serif";
  ctx.fillStyle = "#bbbbbb";
  ctx.fillText("歌绘 ge-hui · 一首歌一张画一起唱", MARGIN_X, footerY + 42);

  if (listenUrl) {
    try {
      const qrDataUrl = await QRCode.toDataURL(listenUrl, {
        width: 140,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });
      const qrImg = await loadImage(qrDataUrl);
      const qrX = A4_W - MARGIN_X - 140;
      const qrY = footerY - 20;
      ctx.drawImage(qrImg, qrX, qrY, 140, 140);
      ctx.font = "400 20px 'Noto Sans SC', sans-serif";
      ctx.fillStyle = "#aaaaaa";
      ctx.textAlign = "center";
      ctx.fillText("扫码听伴唱", qrX + 70, qrY + 148);
    } catch {}
  }

  const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.95);
  const base64 = jpegDataUrl.replace(/^data:image\/jpeg;base64,/, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const blob = buildMinimalPdf(bytes, canvas.width, canvas.height);
  const safeTitle = (songTitle || "歌绘")
    .replace(/[^\w\u4e00-\u9fff-]+/g, "_")
    .slice(0, 30);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = `${safeTitle || "ge-hui"}-涂色卡.pdf`;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function buildMinimalPdf(jpegBytes: Uint8Array, imgW: number, imgH: number): Blob {
  const A4_PT_W = 841.89;
  const A4_PT_H = 595.28;
  const encoder = new TextEncoder();
  const contentStream = `q\n${A4_PT_W} 0 0 ${A4_PT_H} 0 0 cm\n/Im1 Do\nQ\n`;
  const contentBytes = encoder.encode(contentStream);

  const obj1 = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const obj2 = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
  const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_PT_W} ${A4_PT_H}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`;
  const obj4Header = `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`;
  const obj4Footer = "\nendstream\nendobj\n";
  const obj5 = `5 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n${contentStream}endstream\nendobj\n`;

  const header = encoder.encode("%PDF-1.4\n");
  const b1 = encoder.encode(obj1);
  const b2 = encoder.encode(obj2);
  const b3 = encoder.encode(obj3);
  const b4H = encoder.encode(obj4Header);
  const b4F = encoder.encode(obj4Footer);
  const b5 = encoder.encode(obj5);

  const o1 = header.length;
  const o2 = o1 + b1.length;
  const o3 = o2 + b2.length;
  const o4 = o3 + b3.length;
  const o5 = o4 + b4H.length + jpegBytes.length + b4F.length;
  const startXref = o5 + b5.length;

  const pad10 = (n: number) => String(n).padStart(10, "0");
  const xref = `xref\n0 6\n0000000000 65535 f \n${pad10(o1)} 00000 n \n${pad10(o2)} 00000 n \n${pad10(o3)} 00000 n \n${pad10(o4)} 00000 n \n${pad10(o5)} 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
  const bXref = encoder.encode(xref);

  const chunks = [header, b1, b2, b3, b4H, jpegBytes, b4F, b5, bXref];
  const pdfBytes = new Uint8Array(chunks.reduce((t: number, c: Uint8Array) => t + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    pdfBytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new Blob([pdfBytes.buffer], { type: "application/pdf" });
}
