import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { dataRoot, readJsonFile, withFileLock, writeJsonAtomic } from "@/lib/json-store";

export const ADMIN_FIXED_PASSWORD = "3099520";
const ADMIN_COOKIE_NAME = "ge_hui_admin_token";
const TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

export type AdminConfig = {
  defaultChatModel?: string;
  defaultImageModel?: string;
  updatedAt?: string;
};

function adminConfigFile(): string {
  return path.join(dataRoot(), "admin-settings.json");
}

function getHmacSecret(): string {
  return process.env.ACTIVATION_CODE_SECRET?.trim() || "0123456789abcdef0123456789abcdef";
}

export function signAdminToken(): string {
  const timestamp = Date.now().toString();
  const salt = randomBytes(8).toString("hex");
  const payload = `${timestamp}:${salt}`;
  const signature = createHmac("sha256", getHmacSecret())
    .update(`ADMIN:${payload}`)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyAdminToken(token?: string | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;

  const expected = createHmac("sha256", getHmacSecret())
    .update(`ADMIN:${payload}`)
    .digest("base64url");

  const sigBuffer = Buffer.from(signature, "ascii");
  const expBuffer = Buffer.from(expected, "ascii");

  if (sigBuffer.length !== expBuffer.length || !timingSafeEqual(sigBuffer, expBuffer)) {
    return false;
  }

  const [timestampStr] = payload.split(":");
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp) || Date.now() - timestamp > TOKEN_MAX_AGE_SECONDS * 1000) {
    return false; // expired
  }

  return true;
}

export function verifyAdminPassword(password?: string | null): boolean {
  if (!password) return false;
  const bufA = Buffer.from(password.trim());
  const bufB = Buffer.from(ADMIN_FIXED_PASSWORD);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export async function getAdminConfig(): Promise<AdminConfig> {
  return readJsonFile<AdminConfig>(adminConfigFile(), () => ({}));
}

export async function saveAdminConfig(patch: Partial<AdminConfig>): Promise<AdminConfig> {
  const file = adminConfigFile();
  return withFileLock(file, async () => {
    const current = await readJsonFile<AdminConfig>(file, () => ({}));
    const next: AdminConfig = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await writeJsonAtomic(file, next);
    return next;
  });
}

export { ADMIN_COOKIE_NAME, TOKEN_MAX_AGE_SECONDS };
