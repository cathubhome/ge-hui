import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";

// Prefer system persistent directory if specified by DATA_DIR, otherwise fallback to process.cwd()/data/audio
const audioDir = () => {
  if (process.env.DATA_DIR) {
    return path.join(process.env.DATA_DIR, "audio");
  }
  return path.join(process.cwd(), "data", "audio");
};

async function ensureAudioDir() {
  await fs.mkdir(audioDir(), { recursive: true });
}

function findFfmpeg(): string | null {
  // 1. Check system PATH (standard Linux /usr/bin/ffmpeg or Windows PATH)
  if (process.env.PATH) {
    const paths = process.env.PATH.split(path.delimiter);
    for (const p of paths) {
      const candidate = path.join(p, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
      if (existsSync(candidate)) return candidate;
    }
  }

  // 2. Common Linux locations
  if (process.platform === "linux") {
    for (const p of ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"]) {
      if (existsSync(p)) return p;
    }
  }

  // 3. Windows Python imageio_ffmpeg fallback if available
  if (process.platform === "win32") {
    const pythonFfmpeg = path.join(
      process.env.USERPROFILE || "C:\\Users\\wangyq158",
      "AppData",
      "Local",
      "Programs",
      "Python",
      "Python312",
      "Lib",
      "site-packages",
      "imageio_ffmpeg",
      "binaries",
      "ffmpeg-win-x86_64-v7.1.exe"
    );
    if (existsSync(pythonFfmpeg)) return pythonFfmpeg;
  }

  return null;
}

export type AudioMeta = {
  id: string;
  songTitle?: string;
  lyrics?: string;
  createdAt: number;
};

export async function saveAudioMeta(id: string, meta: Partial<AudioMeta>): Promise<void> {
  try {
    await ensureAudioDir();
    const metaPath = path.join(audioDir(), `${id}.json`);
    const existing = await getAudioMeta(id).catch(() => null);
    const data: AudioMeta = {
      id,
      songTitle: meta.songTitle || existing?.songTitle,
      lyrics: meta.lyrics || existing?.lyrics,
      createdAt: existing?.createdAt || Date.now(),
    };
    await fs.writeFile(metaPath, JSON.stringify(data, null, 2), "utf8");
  } catch {
    // metadata is best-effort
  }
}

export async function getAudioMeta(id: string): Promise<AudioMeta | null> {
  try {
    const metaPath = path.join(audioDir(), `${id}.json`);
    const raw = await fs.readFile(metaPath, "utf8");
    return JSON.parse(raw) as AudioMeta;
  } catch {
    return null;
  }
}

export function resolveMimeType(ext: string): string {
  const cleanExt = ext.replace(/^\./, "").toLowerCase();
  switch (cleanExt) {
    case "m4a":
      return "audio/mp4";
    case "aac":
      return "audio/aac";
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "ogg":
      return "audio/ogg";
    case "flac":
      return "audio/flac";
    default:
      return "audio/mpeg";
  }
}

/**
 * Compress an audio buffer into ~32kbps mono AAC/M4A (~200KB - 250KB per song)
 * and save it to data/audio/<id>.m4a.
 * If ffmpeg is not available, falls back to saving raw buffer with exact original extension.
 */
export async function compressAndSaveAudio(
  inputBuf: Buffer,
  format = "mp3",
  initialMeta?: { songTitle?: string; lyrics?: string }
): Promise<{ audioId: string; fileName: string; sizeBytes: number }> {
  await ensureAudioDir();
  const audioId = randomUUID();
  const ffmpeg = findFfmpeg();

  if (initialMeta) {
    void saveAudioMeta(audioId, initialMeta);
  }

  const cleanExt = (format || "mp3").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp3";

  if (!ffmpeg) {
    // Fallback: save raw buffer directly with its EXACT extension to prevent iOS decode failure
    const rawPath = path.join(audioDir(), `${audioId}.${cleanExt}`);
    await fs.writeFile(rawPath, inputBuf);
    return { audioId, fileName: `${audioId}.${cleanExt}`, sizeBytes: inputBuf.length };
  }

  const tempIn = path.join(audioDir(), `temp_${audioId}.${cleanExt}`);
  const targetName = `${audioId}.m4a`;
  const targetPath = path.join(audioDir(), targetName);

  try {
    await fs.writeFile(tempIn, inputBuf);
    await new Promise<void>((resolve, reject) => {
      // 32kbps mono AAC in standard M4A container: crystal clear for children songs, fully compatible with iOS Safari
      const proc = spawn(ffmpeg, [
        "-y",
        "-i",
        tempIn,
        "-c:a",
        "aac",
        "-b:a",
        "32k",
        "-ac",
        "1",
        targetPath,
      ]);
      proc.on("error", reject);
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
    });

    const stat = await fs.stat(targetPath);
    return { audioId, fileName: targetName, sizeBytes: stat.size };
  } catch {
    // If transcoding fails, fallback to saving raw buffer with exact original extension
    const rawPath = path.join(audioDir(), `${audioId}.${cleanExt}`);
    await fs.writeFile(rawPath, inputBuf);
    return { audioId, fileName: `${audioId}.${cleanExt}`, sizeBytes: inputBuf.length };
  } finally {
    await fs.unlink(tempIn).catch(() => undefined);
  }
}

export async function getAudioFile(id: string): Promise<{ filePath: string; contentType: string; size: number } | null> {
  const dir = audioDir();
  for (const ext of ["m4a", "aac", "mp3", "ogg", "wav", "flac"]) {
    const p = path.join(dir, `${id}.${ext}`);
    try {
      const stat = await fs.stat(p);
      const contentType = resolveMimeType(ext);
      return { filePath: p, contentType, size: stat.size };
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * 90-day rolling cleanup: delete any audio file untouched for > 90 days.
 */
export async function cleanupOldAudios(maxAgeDays = 90): Promise<number> {
  let cleaned = 0;
  try {
    await ensureAudioDir();
    const dir = audioDir();
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const maxAgeMs = maxAgeDays * 24 * 3600 * 1000;
    const now = Date.now();

    for (const e of entries) {
      if (!e.isFile()) continue;
      const p = path.join(dir, e.name);
      try {
        const stat = await fs.stat(p);
        if (now - stat.mtimeMs > maxAgeMs) {
          await fs.unlink(p);
          cleaned++;
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
  return cleaned;
}
