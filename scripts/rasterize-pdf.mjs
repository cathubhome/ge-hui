import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { createRequire } from "module";

const pdfPath = process.argv[2];
const outDir = process.argv[3];
const maxPages = Number(process.argv[4] || 8);
if (!pdfPath || !outDir) { console.error("usage"); process.exit(2); }
const require = createRequire(join(process.cwd(), "package.json"));
const { createCanvas } = require("@napi-rs/canvas");
const NodeModule = require("module");
const originalResolve = NodeModule._resolveFilename;
NodeModule._resolveFilename = function (request, parent, isMain, options) {
  if (request === "canvas") return originalResolve.call(this, "@napi-rs/canvas", parent, isMain, options);
  return originalResolve.call(this, request, parent, isMain, options);
};
const pdfjs = require("pdfjs-dist/legacy/build/pdf.js");
if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = "";
class NapiCanvasFactory {
  create(width, height) { const canvas = createCanvas(Math.max(1, Math.ceil(width)), Math.max(1, Math.ceil(height))); return { canvas, context: canvas.getContext("2d") }; }
  reset(c, width, height) { c.canvas.width = Math.max(1, Math.ceil(width)); c.canvas.height = Math.max(1, Math.ceil(height)); }
  destroy(c) { c.canvas = null; c.context = null; }
}
const buf = new Uint8Array(readFileSync(pdfPath));
const canvasFactory = new NapiCanvasFactory();
const doc = await pdfjs.getDocument({ data: buf, useSystemFonts: true, disableFontFace: true, isEvalSupported: false, canvasFactory }).promise;
mkdirSync(outDir, { recursive: true });
const n = Math.min(doc.numPages || 0, maxPages);
const meta = [];
for (let i = 1; i <= n; i++) {
  const page = await doc.getPage(i);
  const base = page.getViewport({ scale: 1 });
  const maxEdge = 960;
  const scale = Math.min(1.5, maxEdge / Math.max(base.width, base.height, 1));
  const viewport = page.getViewport({ scale: Math.max(scale, 0.5) });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport, canvas, canvasFactory }).promise;
  const png = canvas.toBuffer("image/png");
  const file = join(outDir, `page-${i}.png`);
  writeFileSync(file, png);
  meta.push({ page: i, file, width: canvas.width, height: canvas.height, bytes: png.length });
}
writeFileSync(join(outDir, "meta.json"), JSON.stringify(meta, null, 2));
console.log(JSON.stringify({ ok: true, pages: meta.length }));
