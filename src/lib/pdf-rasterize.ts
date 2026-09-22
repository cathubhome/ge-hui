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
const TARGET_MAX_EDGE = 720;

type CanvasBag = {
  canvas: unknown;
  context: unknown;
};

/** pdfjs Node factory that uses @napi-rs/canvas and avoids width=0 destroy crash. */
class NapiCanvasFactory {
  create(width: number, height: number): CanvasBag {
    const canvas = createCanvas(
      Math.max(1, Math.ceil(width)),
      Math.max(1, Math.ceil(height)),
    );
    return { canvas, context: canvas.getContext("2d") };
  }
  reset(canvasAndContext: CanvasBag, width: number, height: number) {
    const canvas = canvasAndContext.canvas as { width: number; height: number };
    canvas.width = Math.max(1, Math.ceil(width));
    canvas.height = Math.max(1, Math.ceil(height));
  }
  destroy(canvasAndContext: CanvasBag) {
    // Do not set width/height to 0 — @napi-rs/canvas Skia fails on that.
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

type Pdfjs = {
  getDocument: (src: Record<string, unknown>) => {
    promise: Promise<{
      numPages: number;
      getPage: (n: number) => Promise<{
        getViewport: (o: { scale: number }) => { width: number; height: number };
        render: (o: Record<string, unknown>) => { promise: Promise<void> };
      }>;
    }>;
  };
  GlobalWorkerOptions?: { workerSrc: string };
};

function shimCanvasResolve() {
  const require = createRequire(join(process.cwd(), "package.json"));
  const NodeModule = require("module") as {
    _resolveFilename: (
      request: string,
      parent: unknown,
      isMain: boolean,
      options?: unknown,
    ) => string;
  };
  const original = NodeModule._resolveFilename;
  if ((original as { __geHuiShim?: boolean }).__geHuiShim) return;
  NodeModule._resolveFilename = function (
    request: string,
    parent: unknown,
    isMain: boolean,
    options?: unknown,
  ) {
    if (request === "canvas") {
      return original.call(this, "@napi-rs/canvas", parent, isMain, options);
    }
    return original.call(this, request, parent, isMain, options);
  };
  (NodeModule._resolveFilename as { __geHuiShim?: boolean }).__geHuiShim = true;
}

function loadPdfjs(): Pdfjs {
  shimCanvasResolve();
  const require = createRequire(join(process.cwd(), "package.json"));
  const pdfjs = require("pdfjs-dist/legacy/build/pdf.js") as Pdfjs;
  if (pdfjs.GlobalWorkerOptions) {
    // Pin worker to the same pdfjs-dist copy we require (avoid pdf-parse's nested 5.x).
    try {
      pdfjs.GlobalWorkerOptions.workerSrc = require.resolve(
        "pdfjs-dist/legacy/build/pdf.worker.js",
      );
    } catch {
      pdfjs.GlobalWorkerOptions.workerSrc = "";
    }
  }
  return pdfjs;
}

function toPlainUint8Array(data: Uint8Array | ArrayBuffer): Uint8Array {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  // Node Buffer is a Uint8Array subclass; pdfjs rejects Buffer specifically.
  // Always copy into a plain Uint8Array (not a Buffer).
  return Uint8Array.from(data);
}

type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<{
    getViewport: (o: { scale: number }) => { width: number; height: number };
    render: (o: Record<string, unknown>) => { promise: Promise<void> };
  }>;
};

async function renderPdfPage(
  doc: PdfDoc,
  canvasFactory: NapiCanvasFactory,
  pageNumber: number,
  maxEdge: number,
): Promise<RasterPage> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(1.5, maxEdge / Math.max(base.width, base.height, 1));
  const viewport = page.getViewport({ scale: Math.max(scale, 0.5) });
  const canvas = createCanvas(
    Math.ceil(viewport.width),
    Math.ceil(viewport.height),
  );
  const ctx = canvas.getContext("2d");
  await page
    .render({
      canvasContext: ctx,
      viewport,
      canvas,
      canvasFactory,
    })
    .promise;
  const buf = canvas.toBuffer("image/jpeg", 82);
  const dataUrl = "data:image/jpeg;base64," + buf.toString("base64");
  return {
    page: pageNumber,
    dataUrl,
    width: canvas.width,
    height: canvas.height,
  };
}

export type RasterizePdfOpts = {
  maxPages?: number;
  maxEdge?: number;
  pageNumbers?: number[];
};

/**
 * Rasterize selected 1-based pages. If pageNumbers is omitted, uses the first maxPages.
 */
export async function inspectPdfPages(
  pdfBytes: Uint8Array | ArrayBuffer,
  opts?: RasterizePdfOpts,
): Promise<{ totalPages: number; pages: RasterPage[] }> {
  const maxPages = opts?.maxPages ?? MAX_PAGES;
  const maxEdge = opts?.maxEdge ?? TARGET_MAX_EDGE;
  const pdfjs = loadPdfjs();
  const canvasFactory = new NapiCanvasFactory();

  const doc = (await pdfjs.getDocument({
    data: toPlainUint8Array(pdfBytes),
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
    disableWorker: true,
    canvasFactory,
  }).promise) as PdfDoc;

  const totalPages = Number(doc.numPages) || 0;
  if (totalPages < 1) return { totalPages: 0, pages: [] };

  const wanted = opts?.pageNumbers?.length
    ? [...new Set(opts.pageNumbers)]
        .filter((n) => n >= 1 && n <= totalPages)
        .sort((a, b) => a - b)
    : Array.from({ length: Math.min(totalPages, maxPages) }, (_, i) => i + 1);

  const pages: RasterPage[] = [];
  for (const i of wanted) {
    pages.push(await renderPdfPage(doc, canvasFactory, i, maxEdge));
  }
  return { totalPages, pages };
}

export async function readPdfPageCount(
  pdfBytes: Uint8Array | ArrayBuffer,
): Promise<number> {
  const pdfjs = loadPdfjs();
  const canvasFactory = new NapiCanvasFactory();
  const doc = await pdfjs.getDocument({
    data: toPlainUint8Array(pdfBytes),
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
    disableWorker: true,
    canvasFactory,
  }).promise;
  return Number(doc.numPages) || 0;
}
export async function rasterizePdfPages(
  pdfBytes: Uint8Array | ArrayBuffer,
  opts?: RasterizePdfOpts,
): Promise<RasterPage[]> {
  const { pages } = await inspectPdfPages(pdfBytes, opts);
  return pages;
}

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
    return (
      "data:image/png;base64," +
      canvas.toBuffer("image/png").toString("base64")
    );
  } catch {
    return dataUrl;
  }
}
