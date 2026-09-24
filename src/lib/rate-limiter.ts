import { promises as fs } from "node:fs";
import path from "node:path";

export type QuotaStatus = {
  ip: string;
  isVip: boolean;
  usedToday: number;
  maxDaily: number;
  remainingToday: number;
  canGenerate: boolean;
  cooldownSeconds: number;
  reason?: string;
};

type RateLimitRecord = {
  lastRequestTime: number;
  dailyCount: number;
  dateKey: string; // YYYY-MM-DD
  isVip?: boolean;
  vipExpiresAt?: number;
};

const limitsFile = () => {
  const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  return path.join(dir, "rate-limits.json");
};

// In-memory cache for speed, synced with disk
const cache = new Map<string, RateLimitRecord>();
let loaded = false;

async function loadStore() {
  if (loaded) return;
  try {
    const raw = await fs.readFile(limitsFile(), "utf8");
    const json = JSON.parse(raw);
    for (const [k, v] of Object.entries(json)) {
      cache.set(k, v as RateLimitRecord);
    }
  } catch {
    // start clean
  }
  loaded = true;
}

async function persistStore() {
  try {
    const obj: Record<string, RateLimitRecord> = {};
    for (const [k, v] of cache.entries()) {
      obj[k] = v;
    }
    await fs.mkdir(path.dirname(limitsFile()), { recursive: true });
    await fs.writeFile(limitsFile(), JSON.stringify(obj, null, 2), "utf8");
  } catch {}
}

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function extractClientFingerprint(headers: Headers): { ip: string; deviceId: string; limitKey: string } {
  const forwarded = headers.get("x-forwarded-for");
  let ip = "127.0.0.1";
  if (forwarded) {
    ip = forwarded.split(",")[0].trim();
  } else {
    const realIp = headers.get("x-real-ip") || headers.get("cf-connecting-ip");
    if (realIp) ip = realIp.trim();
  }

  const rawDevId = headers.get("x-device-id");
  const deviceId = rawDevId ? rawDevId.trim().slice(0, 40) : "NO_DEV_ID";

  // Prioritize physical device fingerprint over volatile dynamic IP
  const limitKey = deviceId !== "NO_DEV_ID" ? `DEV:${deviceId}` : `IP:${ip}`;

  return { ip, deviceId, limitKey };
}

export function extractClientIp(headers: Headers): string {
  return extractClientFingerprint(headers).limitKey;
}

/** Check user current quota without consuming it */
export async function checkQuota(ip: string, vipToken?: string): Promise<QuotaStatus> {
  await loadStore();
  const today = getTodayKey();
  const record = cache.get(ip) || {
    lastRequestTime: 0,
    dailyCount: 0,
    dateKey: today,
  };

  const isVip = Boolean(
    record.isVip ||
    (record.vipExpiresAt && record.vipExpiresAt > Date.now()) ||
    (vipToken && vipToken.startsWith("VIP_"))
  );

  const dailyCount = record.dateKey === today ? record.dailyCount : 0;
  const maxDaily = isVip ? 999 : 3;
  const remainingToday = Math.max(0, maxDaily - dailyCount);

  const now = Date.now();
  const elapsed = (now - record.lastRequestTime) / 1000;
  const cooldownSeconds = Math.max(0, Math.ceil(45 - elapsed)); // 45s cooldown between consecutive generations

  let canGenerate = true;
  let reason = undefined;

  if (!isVip && remainingToday <= 0) {
    canGenerate = false;
    reason = "今日免费 3 次绘本额度已用完，可扫码赞助获取无限次激活码～";
  } else if (cooldownSeconds > 0 && record.lastRequestTime > 0) {
    canGenerate = false;
    reason = `画师正在休息，请等待 ${cooldownSeconds} 秒后再点生成哦～`;
  }

  return {
    ip,
    isVip,
    usedToday: dailyCount,
    maxDaily,
    remainingToday,
    canGenerate,
    cooldownSeconds,
    reason,
  };
}

/** Consume 1 generation quota upon successful job dispatch */
export async function consumeQuota(ip: string): Promise<void> {
  await loadStore();
  const today = getTodayKey();
  const record = cache.get(ip) || {
    lastRequestTime: 0,
    dailyCount: 0,
    dateKey: today,
  };

  const dailyCount = record.dateKey === today ? record.dailyCount + 1 : 1;
  cache.set(ip, {
    ...record,
    lastRequestTime: Date.now(),
    dailyCount,
    dateKey: today,
  });

  void persistStore();
}

/** Grant VIP status to an IP (e.g. after redeeming Mianbaoduo code) */
export async function grantVipStatus(ip: string, durationDays = 3): Promise<void> {
  await loadStore();
  const today = getTodayKey();
  const record = cache.get(ip) || {
    lastRequestTime: 0,
    dailyCount: 0,
    dateKey: today,
  };

  cache.set(ip, {
    ...record,
    isVip: true,
    vipExpiresAt: Date.now() + durationDays * 24 * 3600 * 1000,
  });

  void persistStore();
}
