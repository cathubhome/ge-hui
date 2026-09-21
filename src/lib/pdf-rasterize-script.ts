import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type RasterPage = {
  page: number;
  dataUrl: string;
  width: number;
  height: number;
};

export async function rasterizeViaScript(
  pdfBytes: Uint8Array,
): Promise<RasterPage[]> {
  const dir = await mkdtemp(join(tmpdir(), "ge-hui-pdf-"));
  const pdfPath = join(dir, "input.pdf");
  await writeFile(pdfPath, Buffer.from(pdfBytes));
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [join(process.cwd(), "scripts", "rasterize-pdf.mjs"), pdfPath, dir, "8"],
        { cwd: process.cwd(), env: process.env },
      );
      let err = "";
      child.stderr.on("data", (c) => {
        err += String(c);
      });
      let out = "";
      child.stdout.on("data", (c) => {
        out += String(c);
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error((err || out).trim() || `rasterize exit ${code}`));
      });
    });
    const metaRaw = await readFile(join(dir, "meta.json"), "utf8");
    const meta = JSON.parse(metaRaw) as Array<{
      page: number;
      file: string;
      width: number;
      height: number;
    }>;
    const pages: RasterPage[] = [];
    for (const m of meta) {
      const png = await readFile(m.file);
      pages.push({
        page: m.page,
        dataUrl: "data:image/png;base64," + png.toString("base64"),
        width: m.width,
        height: m.height,
      });
    }
    return pages;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
