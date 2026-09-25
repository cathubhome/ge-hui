import path from "node:path";
import {
  commitPaidReservation,
  getPaidQuota,
  refundPaidReservation,
  reservePaidGeneration,
} from "@/lib/access-store";
import {
  dataRoot,
  readJsonFile,
  withFileLock,
  writeJsonAtomic,
} from "@/lib/json-store";
import type { QuotaReservation, QuotaStatus } from "@/lib/quota-types";

const FREE_DAILY_MAX = 3;
const GENERATION_COOLDOWN_SECONDS = Number(
  process.env.GENERATION_COOLDOWN_SECONDS || 45,
);
const STORE_VERSION = 2;
const SETTLED_RESERVATION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

type FreeReservationRecord = {
  id: string;
  state: "reserved" | "committed" | "refunded";
  dateKey: string;
  reservedAt: number;
  settledAt?: number;
};

type FreeQuotaRecord = {
  lastRequestTime: number;
  dailyCount: number;
  dateKey: string;
  reservations: Record<string, FreeReservationRecord>;
};

type FreeQuotaStore = {
  version: number;
  records: Record<string, FreeQuotaRecord>;
};

export class QuotaError extends Error {
  constructor(
    message: string,
    public readonly quota: QuotaStatus,
  ) {
    super(message);
    this.name = "QuotaError";
  }
}

const limitsFile = () => path.join(dataRoot(), "rate-limits.json");
let quotaQueue: Promise<void> = Promise.resolve();

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function emptyRecord(today = getTodayKey()): FreeQuotaRecord {
  return {
    lastRequestTime: 0,
    dailyCount: 0,
    dateKey: today,
    reservations: {},
  };
}

function emptyStore(): FreeQuotaStore {
  return { version: STORE_VERSION, records: {} };
}

async function withQuotaQueue<T>(operation: () => Promise<T>): Promise<T> {
  const previous = quotaQueue;
  let release!: () => void;
  quotaQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

function migrateStore(raw: unknown): FreeQuotaStore {
  if (
    raw &&
    typeof raw === "object" &&
    (raw as FreeQuotaStore).version === STORE_VERSION &&
    (raw as FreeQuotaStore).records
  ) {
    return raw as FreeQuotaStore;
  }

  const store = emptyStore();
  if (!raw || typeof raw !== "object") return store;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const legacy = value as Partial<FreeQuotaRecord>;
    store.records[key] = {
      lastRequestTime: Number(legacy.lastRequestTime) || 0,
      dailyCount: Number(legacy.dailyCount) || 0,
      dateKey: String(legacy.dateKey || getTodayKey()),
      reservations: {},
    };
  }
  return store;
}

async function loadStore(): Promise<FreeQuotaStore> {
  const raw = await readJsonFile<unknown>(limitsFile(), emptyStore);
  return migrateStore(raw);
}

function currentDailyCount(record: FreeQuotaRecord, today: string): number {
  return record.dateKey === today ? record.dailyCount : 0;
}

function cooldownSeconds(record: FreeQuotaRecord, now = Date.now()): number {
  if (!record.lastRequestTime) return 0;
  const elapsed = (now - record.lastRequestTime) / 1000;
  return Math.max(0, Math.ceil(GENERATION_COOLDOWN_SECONDS - elapsed));
}

function pruneReservations(record: FreeQuotaRecord, now = Date.now()): void {
  for (const [id, reservation] of Object.entries(record.reservations)) {
    if (
      reservation.state !== "reserved" &&
      reservation.settledAt &&
      now - reservation.settledAt > SETTLED_RESERVATION_RETENTION_MS
    ) {
      delete record.reservations[id];
    }
  }
}

async function getFreeQuota(deviceHash: string): Promise<{
  remaining: number;
  cooldown: number;
}> {
  const store = await loadStore();
  const today = getTodayKey();
  const record = store.records[deviceHash] || emptyRecord(today);
  return {
    remaining: Math.max(
      0,
      FREE_DAILY_MAX - currentDailyCount(record, today),
    ),
    cooldown: cooldownSeconds(record),
  };
}

async function reserveFreeGeneration(
  deviceHash: string,
  reservationId: string,
): Promise<QuotaReservation | null> {
  const filePath = limitsFile();
  return withFileLock(filePath, async () => {
    const store = await loadStore();
    const today = getTodayKey();
    const record = store.records[deviceHash] || emptyRecord(today);
    const existing = record.reservations[reservationId];
    if (existing) {
      return existing.state === "refunded"
        ? null
        : { id: reservationId, source: "free" };
    }

    const cooldown = cooldownSeconds(record);
    if (cooldown > 0) {
      throw new Error(`COOLDOWN:${cooldown}`);
    }

    if (record.dateKey !== today) {
      record.dateKey = today;
      record.dailyCount = 0;
    }
    if (record.dailyCount >= FREE_DAILY_MAX) return null;

    const now = Date.now();
    record.dailyCount += 1;
    record.lastRequestTime = now;
    record.reservations[reservationId] = {
      id: reservationId,
      state: "reserved",
      dateKey: today,
      reservedAt: now,
    };
    pruneReservations(record, now);
    store.records[deviceHash] = record;
    await writeJsonAtomic(filePath, store);
    return { id: reservationId, source: "free" };
  });
}

async function markPaidGenerationStarted(deviceHash: string): Promise<void> {
  const filePath = limitsFile();
  await withFileLock(filePath, async () => {
    const store = await loadStore();
    const today = getTodayKey();
    const record = store.records[deviceHash] || emptyRecord(today);
    record.lastRequestTime = Date.now();
    store.records[deviceHash] = record;
    await writeJsonAtomic(filePath, store);
  });
}

async function commitFreeReservation(reservationId: string): Promise<boolean> {
  const filePath = limitsFile();
  return withFileLock(filePath, async () => {
    const store = await loadStore();
    for (const record of Object.values(store.records)) {
      const reservation = record.reservations[reservationId];
      if (!reservation) continue;
      if (reservation.state === "committed") return true;
      if (reservation.state === "refunded") return false;
      reservation.state = "committed";
      reservation.settledAt = Date.now();
      await writeJsonAtomic(filePath, store);
      return true;
    }
    return false;
  });
}

async function refundFreeReservation(reservationId: string): Promise<boolean> {
  const filePath = limitsFile();
  return withFileLock(filePath, async () => {
    const store = await loadStore();
    for (const record of Object.values(store.records)) {
      const reservation = record.reservations[reservationId];
      if (!reservation) continue;
      if (reservation.state === "refunded") return true;
      if (reservation.state === "committed") return false;
      if (record.dateKey === reservation.dateKey) {
        record.dailyCount = Math.max(0, record.dailyCount - 1);
      }
      reservation.state = "refunded";
      reservation.settledAt = Date.now();
      await writeJsonAtomic(filePath, store);
      return true;
    }
    return false;
  });
}

export async function getQuotaStatus(deviceHash: string): Promise<QuotaStatus> {
  const [free, paid] = await Promise.all([
    getFreeQuota(deviceHash),
    getPaidQuota(deviceHash),
  ]);
  const hasQuota = free.remaining > 0 || paid.remaining > 0;
  const reason =
    free.cooldown > 0
      ? `画师正在休息，请等待 ${free.cooldown} 秒后再点生成哦～`
      : !hasQuota
        ? "今日免费 3 次已用完，可购买创作包继续生成～"
        : undefined;

  return {
    freeRemainingToday: free.remaining,
    freeDailyMax: FREE_DAILY_MAX,
    paidRemaining: paid.remaining,
    paidExpiresAt: paid.nearestExpiresAt
      ? new Date(paid.nearestExpiresAt).toISOString()
      : undefined,
    canGenerate: hasQuota && free.cooldown === 0,
    cooldownSeconds: free.cooldown,
    reason,
  };
}

export async function reserveGeneration(
  deviceHash: string,
  reservationId: string,
): Promise<QuotaReservation> {
  return withQuotaQueue(async () => {
    try {
      const freeReservation = await reserveFreeGeneration(
        deviceHash,
        reservationId,
      );
      if (freeReservation) return freeReservation;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.startsWith("COOLDOWN:")) {
        const quota = await getQuotaStatus(deviceHash);
        throw new QuotaError(quota.reason || "请求过于频繁", quota);
      }
      throw error;
    }

    const paidReservation = await reservePaidGeneration(
      deviceHash,
      reservationId,
    );
    if (paidReservation) {
      await markPaidGenerationStarted(deviceHash);
      return paidReservation;
    }

    const quota = await getQuotaStatus(deviceHash);
    throw new QuotaError(quota.reason || "创作额度不足", quota);
  });
}

export async function commitGeneration(reservationId: string): Promise<void> {
  if (await commitFreeReservation(reservationId)) return;
  await commitPaidReservation(reservationId);
}

export async function refundGeneration(reservationId: string): Promise<void> {
  if (await refundFreeReservation(reservationId)) return;
  await refundPaidReservation(reservationId);
}
