import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";

const audioDir = () => path.join(process.cwd(), "data", "audio");

async function ensureAudioDir() {
  await fs.mkdir(audioDir(), { recursive: true });
}

function findFfmpeg(): string | null {
  // 1. Check system PATH
  if (process.env.PATH) {
    const paths = process.env.PATH.split(path.delimiter);
    for (const p of paths) {
      const candidate = path.join(p, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
      if (existsSync(candidate)) return candidate;
    }
  }

  // 2. Windows Python imageio_ffmpeg fallback if available
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

/**
 * Compress an audio buffer into ~32kbps mono AAC/M4A (~200KB - 250KB per song)
 * and save it to data/audio/<id>.m4a.
 * If ffmpeg is not available, falls back to saving raw buffer.
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

  if (!ffmpeg) {
    // Fallback: save raw buffer directly without compression
    const ext = format === "m4a" || format === "aac" ? "m4a" : "mp3";
    const rawPath = path.join(audioDir(), `${audioId}.${ext}`);
    await fs.writeFile(rawPath, inputBuf);
    return { audioId, fileName: `${audioId}.${ext}`, sizeBytes: inputBuf.length };
  }

  const tempIn = path.join(audioDir(), `temp_${audioId}.${format}`);
  const targetName = `${audioId}.m4a`;
  const targetPath = path.join(audioDir(), targetName);

  try {
    await fs.writeFile(tempIn, inputBuf);
    await new Promise<void>((resolve, reject) => {
      // 32kbps mono AAC: crystal clear for children songs and speech, tiny file size
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
    // If transcoding fails, fallback to saving raw buffer
    const rawPath = path.join(audioDir(), `${audioId}.${format}`);
    await fs.writeFile(rawPath, inputBuf);
    return { audioId, fileName: `${audioId}.${format}`, sizeBytes: inputBuf.length };
  } finally {
    await fs.unlink(tempIn).catch(() => undefined);
  }
}

export async function getAudioFile(id: string): Promise<{ filePath: string; contentType: string; size: number } | null> {
  const dir = audioDir();
  for (const ext of ["m4a", "mp3", "aac", "ogg", "wav", "flac"]) {
    const p = path.join(dir, `${id}.${ext}`);
    try {
      const stat = await fs.stat(p);
      const contentType =
        ext === "m4a" || ext === "aac"
          ? "audio/mp4"
          : ext === "mp3"
          ? "audio/mpeg"
          : ext === "ogg"
          ? "audio/ogg"
          : ext === "wav"
          ? "audio/wav"
          : "audio/flac";
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
