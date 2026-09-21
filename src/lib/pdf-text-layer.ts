import { createRequire } from "node:module";
import { join } from "node:path";

type Pdfjs = {
  getDocument: (src: Record<string, unknown>) => {
    promise: Promise<{
      numPages: number;
      getPage: (n: number) => Promise<{
        getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
      }>;
    }>;
  };
  GlobalWorkerOptions?: { workerSrc: string };
};

function loadPdfjs(): Pdfjs {
  const require = createRequire(join(process.cwd(), "package.json"));
  const pdfjs = require("pdfjs-dist/legacy/build/pdf.js") as Pdfjs;
  if (pdfjs.GlobalWorkerOptions) {
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
  return Uint8Array.from(data);
}

/** Extract plain text layer via pdfjs (no pdf-parse / no pdfjs 5). */
export async function extractPdfTextLayer(
  pdfBytes: Uint8Array | ArrayBuffer,
): Promise<{ text: string; pages: number }> {
  const pdfjs = loadPdfjs();
  const doc = await pdfjs.getDocument({
    data: toPlainUint8Array(pdfBytes),
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
    disableWorker: true,
  }).promise;
  const pages = Number(doc.numPages) || 0;
  const chunks: string[] = [];
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = (content.items || [])
      .map((it) => (typeof it.str === "string" ? it.str : ""))
      .join(" ");
    chunks.push(line);
  }
  return { text: chunks.join("\n"), pages };
}
