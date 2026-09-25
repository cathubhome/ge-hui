import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const queues = new Map<string, Promise<void>>();

export function dataRoot(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), "data");
}

export async function withFileLock<T>(
  filePath: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = queues.get(filePath) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => gate);
  queues.set(filePath, queued);

  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (queues.get(filePath) === queued) queues.delete(filePath);
  }
}

export async function readJsonFile<T>(
  filePath: string,
  fallback: () => T,
): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback();
    throw error;
  }
}

export async function writeJsonAtomic(
  filePath: string,
  value: unknown,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await fs.open(tempPath, "wx", 0o600);

  try {
    await handle.writeFile(JSON.stringify(value, null, 2), "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }

  try {
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.unlink(tempPath).catch(() => undefined);
    throw error;
  }
}
