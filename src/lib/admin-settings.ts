import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { dataRoot, readJsonFile, withFileLock, writeJsonAtomic } from "@/lib/json-store";

export const ADMIN_FIXED_PASSWORD = "3099520";
const ADMIN_COOKIE_NAME = "ge_hui_admin_token";
const TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

export type PricingConfig = {
  price: string;
  originalPrice: string;
  promoTag: string;
};

export type ModelPoolConfig = {
  freeModels: string[];
  proModels: string[];
  defaultFree: string;
  defaultPro: string;
};

export type AdminConfig = {
  pricing?: PricingConfig;
  chatPool?: ModelPoolConfig;
  imagePool?: ModelPoolConfig;
  defaultChatModel?: string;
  defaultImageModel?: string;
  updatedAt?: string;
};

export const DEFAULT_PRICING: PricingConfig = {
  price: "6.6",
  originalPrice: "29.9",
  promoTag: "限时特惠",
};

export const DEFAULT_CHAT_POOL: ModelPoolConfig = {
  freeModels: ["gemini-3.8-flash-high", "gemini-3.1-pro-low", "glm-5.3", "grok-4.6"],
  proModels: ["gpt-6-astra", "gpt-5.6-sol", "gpt-5.5"],
  defaultFree: "gemini-3.8-flash-high",
  defaultPro: "gpt-6-astra",
};

export const DEFAULT_IMAGE_POOL: ModelPoolConfig = {
  freeModels: ["gemini-3.1-flash-image"],
  proModels: ["gpt-image-2.5", "gpt-image-2", "gpt-image-1.5"],
  defaultFree: "gemini-3.1-flash-image",
  defaultPro: "gpt-image-2.5",
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
  const config = await readJsonFile<AdminConfig>(adminConfigFile(), () => ({}));
  return {
    pricing: {
      price: config.pricing?.price || DEFAULT_PRICING.price,
      originalPrice: config.pricing?.originalPrice || DEFAULT_PRICING.originalPrice,
      promoTag: config.pricing?.promoTag || DEFAULT_PRICING.promoTag,
    },
    chatPool: {
      freeModels: config.chatPool?.freeModels?.length ? config.chatPool.freeModels : DEFAULT_CHAT_POOL.freeModels,
      proModels: config.chatPool?.proModels?.length ? config.chatPool.proModels : DEFAULT_CHAT_POOL.proModels,
      defaultFree: config.chatPool?.defaultFree || DEFAULT_CHAT_POOL.defaultFree,
      defaultPro: config.chatPool?.defaultPro || DEFAULT_CHAT_POOL.defaultPro,
    },
    imagePool: {
      freeModels: config.imagePool?.freeModels?.length ? config.imagePool.freeModels : DEFAULT_IMAGE_POOL.freeModels,
      proModels: config.imagePool?.proModels?.length ? config.imagePool.proModels : DEFAULT_IMAGE_POOL.proModels,
      defaultFree: config.imagePool?.defaultFree || DEFAULT_IMAGE_POOL.defaultFree,
      defaultPro: config.imagePool?.defaultPro || DEFAULT_IMAGE_POOL.defaultPro,
    },
    defaultChatModel: config.defaultChatModel || config.chatPool?.defaultFree || DEFAULT_CHAT_POOL.defaultFree,
    defaultImageModel: config.defaultImageModel || config.imagePool?.defaultFree || DEFAULT_IMAGE_POOL.defaultFree,
    updatedAt: config.updatedAt,
  };
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
