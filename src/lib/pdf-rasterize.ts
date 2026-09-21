import { createRequire } from "node:module";
import { join } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";

export type RasterPage = {
  page: number;
  dataUrl: string;
  width: number;
  height: number;
};

const MAX_PAGES = 8;
const TARGET_MAX_EDGE = 960;

type Pdfjs = {
  getDocument: (src: {
    data: Uint8Array;
    useSystemFonts?: boolean;
    disableFontFace?: boolean;
    isEvalSupported?: boolean;
  }) => {
    promise: Promise<{
      numPages: number;
      getPage: (n: number) => Promise<{
        getViewport: (o: { scale: number }) => { width: number; height: number };
        render: (o: {
          canvasContext: unknown;
          viewport: { width: number; height: number };
        }) => { promise: Promise<void> };
      }>;
    }>;
  };
  GlobalWorkerOptions?: { workerSrc: string };
};

function loadPdfjs(): Pdfjs {
  // Resolve from project root so this works under Next CJS/ESM compiles.
  const require = createRequire(join(process.cwd(), "package.json"));
  const pdfjs = require("pdfjs-dist/legacy/build/pdf.js") as Pdfjs;
  if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = "";
  }
  return pdfjs;
}

/**
 * Rasterize the first N PDF pages to PNG data URLs for multimodal vision.
 * Pins: pdfjs-dist@3.11.174 + @napi-rs/canvas@0.1.53 (Node-verified).
 */
export async function rasterizePdfPages(
  pdfBytes: Uint8Array,
  opts?: { maxPages?: number; maxEdge?: number },
): Promise<RasterPage[]> {
  const maxPages = opts?.maxPages ?? MAX_PAGES;
  const maxEdge = opts?.maxEdge ?? TARGET_MAX_EDGE;
  const pdfjs = loadPdfjs();

  const doc = await pdfjs.getDocument({
    data: pdfBytes,
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
  }).promise;

  const pageCount = Math.min(Number(doc.numPages) || 0, maxPages);
  if (pageCount < 1) return [];

  const pages: RasterPage[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(
      1.5,
      maxEdge / Math.max(base.width, base.height, 1),
    );
    const viewport = page.getViewport({ scale: Math.max(scale, 0.5) });
    const canvas = createCanvas(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height),
    );
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;
    const buf = canvas.toBuffer("image/png");
    let dataUrl = `data:image/png;base64,${buf.toString("base64")}`;
    dataUrl = await downscaleDataUrl(dataUrl, maxEdge);
    pages.push({
      page: i,
      dataUrl,
      width: canvas.width,
      height: canvas.height,
    });
  }
  return pages;
}

/** Shrink a PNG data URL for cheaper vision tokens. */
export async function downscaleDataUrl(
  dataUrl: string,
  maxEdge = 768,
): Promise<string> {
  const m = /^data:image\/(\w+);base64,(.+)$/.exec(dataUrl);
  if (!m) return dataUrl;
  try {
    const img = await loadImage(Buffer.from(m[2], "base64"));
    const edge = Math.max(img.width, img.height);
    if (edge <= maxEdge && dataUrl.startsWith("data:image/png")) return dataUrl;
    const scale = edge > maxEdge ? maxEdge / edge : 1;
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = createCanvas(w, h);
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    return `data:image/png;base64,${canvas.toBuffer("image/png").toString("base64")}`;
  } catch {
    return dataUrl;
  }
}
