/**
 * Professional A4 Landscape Print & PDF Compositor
 * Standard A4 Landscape: 297mm x 210mm (aspect ratio 1.4142).
 * Resolution: 2970 x 2100 px (~254 DPI, crystal clear for home & school printers).
 */

const A4_WIDTH = 2970;
const A4_HEIGHT = 2100;
const MARGIN_X = 120; // 12mm safe quiet zone against printer hardware margins
const MARGIN_TOP = 100;
const MARGIN_BOTTOM = 150;
import QRCode from "qrcode";

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片载入失败，无法生成打印版"));
    img.src = url;
  });
}

export async function renderA4Canvas(
  imageDataUrl: string,
  songTitle?: string,
  listenUrl?: string,
): Promise<HTMLCanvasElement> {
  const img = await loadImageElement(imageDataUrl);

  const canvas = document.createElement("canvas");
  canvas.width = A4_WIDTH;
  canvas.height = A4_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法初始化打印画布");

  // Pure clean white sheet background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, A4_WIDTH, A4_HEIGHT);

  // Available content area
  const availW = A4_WIDTH - MARGIN_X * 2;
  const availH = A4_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;

  // Scale image to fit within available area keeping aspect ratio
  const scale = Math.min(availW / img.width, availH / img.height);
  const drawW = Math.round(img.width * scale);
  const drawH = Math.round(img.height * scale);
  const drawX = Math.round(MARGIN_X + (availW - drawW) / 2);
  const drawY = Math.round(MARGIN_TOP + (availH - drawH) / 2);

  // Draw main picture book image
  ctx.drawImage(img, drawX, drawY, drawW, drawH);

  // Subtle clean border around the artwork (0.5mm)
  ctx.strokeStyle = "#E5E1D8";
  ctx.lineWidth = 4;
  ctx.strokeRect(drawX, drawY, drawW, drawH);

  // Print safety footer
  const footerY = A4_HEIGHT - 55;
  ctx.fillStyle = "#8C867D";
  ctx.font = "bold 32px sans-serif";
  const titleText = `${(songTitle || "歌绘").trim()} · 启蒙伴读挂画`;
  ctx.fillText(titleText, MARGIN_X + 10, footerY);

  if (listenUrl) {
    try {
      const qrDataUrl = await QRCode.toDataURL(listenUrl, {
        margin: 1,
        width: 140,
        color: { dark: "#1A1A1A", light: "#FFFFFF" },
      });
      const qrImg = await loadImageElement(qrDataUrl);
      const qrSize = 110;
      const qrX = A4_WIDTH - MARGIN_X - qrSize;
      const qrY = A4_HEIGHT - MARGIN_BOTTOM + 20;

      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
      ctx.strokeStyle = "#E5E1D8";
      ctx.lineWidth = 2;
      ctx.strokeRect(qrX, qrY, qrSize, qrSize);

      ctx.textAlign = "right";
      ctx.fillStyle = "#3F3F46";
      ctx.font = "bold 26px sans-serif";
      ctx.fillText("📱 微信扫码即听伴唱", qrX - 18, qrY + 45);

      ctx.fillStyle = "#8C867D";
      ctx.font = "normal 22px sans-serif";
      ctx.fillText("手机放桌上，每天边指边唱 🎵", qrX - 18, qrY + 85);
    } catch {
      ctx.textAlign = "right";
      ctx.font = "normal 28px sans-serif";
      ctx.fillText(
        "A4 打印挂图 · 贴在床头或门后，每天边指边唱 🎵",
        A4_WIDTH - MARGIN_X - 10,
        footerY,
      );
    }
  } else {
    ctx.textAlign = "right";
    ctx.font = "normal 28px sans-serif";
    ctx.fillText(
      "A4 打印挂图 · 贴在床头或门后，每天边指边唱 🎵",
      A4_WIDTH - MARGIN_X - 10,
      footerY,
    );
  }

  return canvas;
}

export async function buildA4PrintDataUrl(
  imageDataUrl: string,
  songTitle?: string,
  listenUrl?: string,
): Promise<string> {
  const canvas = await renderA4Canvas(imageDataUrl, songTitle, listenUrl);
  return canvas.toDataURL("image/png", 0.95);
}

export async function downloadA4PrintImage(
  imageDataUrl: string,
  songTitle?: string,
  listenUrl?: string,
): Promise<void> {
  const a4DataUrl = await buildA4PrintDataUrl(imageDataUrl, songTitle, listenUrl);
  const safeTitle = (songTitle || "歌绘")
    .replace(/[^\w\u4e00-\u9fff-]+/g, "_")
    .slice(0, 30);
  const link = document.createElement("a");
  link.download = `${safeTitle || "ge-hui"}-A4挂画.png`;
  link.href = a4DataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Pure client-side minimal valid PDF 1.4 generator.
 * Encapsulates the high-res canvas JPEG directly into standard A4 landscape PDF.
 * Instant, zero-library, zero-server download.
 */
function buildMinimalA4Pdf(jpegBytes: Uint8Array, imgW: number, imgH: number): Blob {
  const A4_PT_W = 841.89; // 297mm in pt (72pt/inch)
  const A4_PT_H = 595.28; // 210mm in pt
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

  // BlobPart only accepts ArrayBuffer-backed views in the DOM typings. Copying
  // all segments into one owned buffer also guarantees byte order in the PDF.
  const chunks = [header, b1, b2, b3, b4H, jpegBytes, b4F, b5, bXref];
  const pdfBytes = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    pdfBytes.set(chunk, offset);
    offset += chunk.length;
  }

  return new Blob([pdfBytes.buffer], { type: "application/pdf" });
}

export async function downloadA4Pdf(
  imageDataUrl: string,
  songTitle?: string,
  listenUrl?: string,
): Promise<void> {
  const canvas = await renderA4Canvas(imageDataUrl, songTitle, listenUrl);
  const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const base64 = jpegDataUrl.replace(/^data:image\/jpeg;base64,/, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const blob = buildMinimalA4Pdf(bytes, canvas.width, canvas.height);
  const safeTitle = (songTitle || "歌绘")
    .replace(/[^\w\u4e00-\u9fff-]+/g, "_")
    .slice(0, 30);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = `${safeTitle || "ge-hui"}-A4挂画.pdf`;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function triggerNativePrintA4(
  imageDataUrl: string,
  songTitle?: string,
  listenUrl?: string,
): Promise<void> {
  const a4DataUrl = await buildA4PrintDataUrl(imageDataUrl, songTitle, listenUrl);

  // Inject hidden iframe for seamless native browser print dialog
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    throw new Error("无法打开打印窗口");
  }

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${songTitle || "歌绘"} - A4 打印</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 0;
        }
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
        }
        img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          page-break-inside: avoid;
        }
      </style>
    </head>
    <body>
      <img src="${a4DataUrl}" alt="A4打印挂画" />
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.focus();
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `);
  doc.close();

  // Clean up iframe after print dialog completes
  setTimeout(() => {
    if (iframe.parentNode) {
      document.body.removeChild(iframe);
    }
  }, 120000);
}
