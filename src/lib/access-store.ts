import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import path from "node:path";
import {
  dataRoot,
  readJsonFile,
  withFileLock,
  writeJsonAtomic,
} from "@/lib/json-store";
import type { QuotaReservation } from "@/lib/quota-types";

export const SUPPORTER_PACKAGE_CREDITS = 20;
export const SUPPORTER_PACKAGE_VALID_DAYS = 90;
export const MAX_BOUND_DEVICES_PER_CODE = 3;

const STORE_VERSION = 2;
const CODE_PREFIX = "GH1";
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const SETTLED_RESERVATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export type AccessGrant = {
  id: string;
  codeHash: string;
  total: number;
  remaining: number;
  redeemedAt: number;
  expiresAt: number;
};

export type RedemptionRecord = {
  boundDevices: string[];
  grantId: string;
  redeemedAt: number;
};

export type PaidReservationRecord = {
  id: string;
  deviceHash: string;
  grantId: string;
  state: "reserved" | "committed" | "refunded";
  reservedAt: number;
  settledAt?: number;
};

export type AccessStore = {
  version: number;
  grants: Record<string, AccessGrant>;
  redemptions: Record<string, RedemptionRecord>;
  reservations: Record<string, PaidReservationRecord>;
};

export type PaidQuota = {
  remaining: number;
  nearestExpiresAt?: number;
};

export type RedeemResult = {
  addedCredits: number;
  alreadyRedeemed: boolean;
  synced: boolean;
  grantExpiresAt: number;
  boundDevicesCount: number;
  maxBoundDevices: number;
  paidQuota: PaidQuota;
};

export class ActivationCodeError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "ActivationCodeError";
  }
}

function accessFile(): string {
  return path.join(dataRoot(), "access-store.json");
}

function emptyStore(): AccessStore {
  return {
    version: STORE_VERSION,
    grants: {},
    redemptions: {},
    reservations: {},
  };
}

function normalizeStore(raw: unknown): AccessStore {
  const store = emptyStore();
  if (!raw || typeof raw !== "object") return store;
  const legacy = raw as Record<string, unknown>;

  // Migration from version 1 or legacy store
  if (legacy.grants && typeof legacy.grants === "object") {
    store.grants = legacy.grants as Record<string, AccessGrant>;
  } else if (legacy.devices && typeof legacy.devices === "object") {
    const devices = legacy.devices as Record<string, { grants?: AccessGrant[] }>;
    for (const d of Object.values(devices)) {
      if (Array.isArray(d?.grants)) {
        for (const g of d.grants) {
          if (g && g.id) store.grants[g.id] = g;
        }
      }
    }
  }

  if (legacy.redemptions && typeof legacy.redemptions === "object") {
    for (const [codeHash, redRaw] of Object.entries(
      legacy.redemptions as Record<string, unknown>,
    )) {
      if (!redRaw || typeof redRaw !== "object") continue;
      const r = redRaw as {
        deviceHash?: string;
        boundDevices?: string[];
        grantId: string;
        redeemedAt: number;
      };
      let bound = Array.isArray(r.boundDevices)
        ? r.boundDevices.map(String).filter(Boolean)
        : [];
      if (bound.length === 0 && r.deviceHash) {
        bound = [String(r.deviceHash)];
      }
      store.redemptions[codeHash] = {
        boundDevices: Array.from(new Set(bound)),
        grantId: String(r.grantId),
        redeemedAt: Number(r.redeemedAt) || Date.now(),
      };
    }
  }

  if (legacy.reservations && typeof legacy.reservations === "object") {
    store.reservations = legacy.reservations as Record<
      string,
      PaidReservationRecord
    >;
  }

  return store;
}

async function loadStore(): Promise<AccessStore> {
  const raw = await readJsonFile(accessFile(), emptyStore);
  return normalizeStore(raw);
}

function activationSecret(): string {
  const secret = process.env.ACTIVATION_CODE_SECRET?.trim() || "";
  if (secret.length < 32) {
    throw new Error("ACTIVATION_CODE_SECRET 未配置或长度不足 32 个字符");
  }
  return secret;
}

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function signatureForPayload(payload: string): string {
  const digest = createHmac("sha256", activationSecret())
    .update(`${CODE_PREFIX}${payload}`)
    .digest()
    .subarray(0, 6);
  return encodeBase32(digest).slice(0, 10);
}

function canonicalCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function codeHash(canonical: string): string {
  return createHash("sha256").update(canonical).digest("hex");
}

function parseAndVerifyCode(input: string): { canonical: string; hash: string } {
  const canonical = canonicalCode(input);
  const match = /^GH1([A-Z2-7]{16})([A-Z2-7]{10})$/.exec(canonical);
  if (!match) {
    throw new ActivationCodeError(
      "兑换码格式不正确，请直接复制作者发送的完整卡密",
    );
  }

  const expected = signatureForPayload(match[1]);
  const suppliedBuffer = Buffer.from(match[2], "ascii");
  const expectedBuffer = Buffer.from(expected, "ascii");
  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    throw new ActivationCodeError("兑换码无效，请检查后重试");
  }

  return { canonical, hash: codeHash(canonical) };
}

function formatCode(payload: string, signature: string): string {
  const body = `${payload}${signature}`;
  return `${CODE_PREFIX}-${body.match(/.{1,4}/g)?.join("-") || body}`;
}

function getActiveGrantsForDevice(
  store: AccessStore,
  deviceHash: string,
  now = Date.now(),
): AccessGrant[] {
  const grants: AccessGrant[] = [];
  for (const red of Object.values(store.redemptions)) {
    if (red.boundDevices.includes(deviceHash)) {
      const grant = store.grants[red.grantId];
      if (grant && grant.remaining > 0 && grant.expiresAt > now) {
        grants.push(grant);
      }
    }
  }
  return grants.sort((a, b) => a.expiresAt - b.expiresAt);
}

function paidQuotaForDevice(
  store: AccessStore,
  deviceHash: string,
  now = Date.now(),
): PaidQuota {
  const active = getActiveGrantsForDevice(store, deviceHash, now);
  return {
    remaining: active.reduce((sum, g) => sum + g.remaining, 0),
    nearestExpiresAt: active.length
      ? Math.min(...active.map((g) => g.expiresAt))
      : undefined,
  };
}

function pruneSettledReservations(store: AccessStore, now = Date.now()): void {
  for (const [id, reservation] of Object.entries(store.reservations)) {
    if (
      reservation.state !== "reserved" &&
      reservation.settledAt &&
      now - reservation.settledAt > SETTLED_RESERVATION_RETENTION_MS
    ) {
      delete store.reservations[id];
    }
  }
}

export function generateActivationCodes(count = 1): string[] {
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error("单次生成数量必须在 1 到 100 之间");
  }

  const codes = new Set<string>();
  while (codes.size < count) {
    const payload = encodeBase32(randomBytes(10)).slice(0, 16);
    codes.add(formatCode(payload, signatureForPayload(payload)));
  }
  return [...codes];
}

export async function getPaidQuota(deviceHash: string): Promise<PaidQuota> {
  return paidQuotaForDevice(await loadStore(), deviceHash);
}

export async function redeemActivationCode(
  deviceHash: string,
  inputCode: string,
): Promise<RedeemResult> {
  const verified = parseAndVerifyCode(inputCode);
  const filePath = accessFile();

  return withFileLock(filePath, async () => {
    const store = await loadStore();
    const existing = store.redemptions[verified.hash];
    const now = Date.now();

    if (existing) {
      const grant = store.grants[existing.grantId];
      if (!grant) throw new Error("兑换记录不完整，请联系作者处理");

      // Already bound to this exact device
      if (existing.boundDevices.includes(deviceHash)) {
        return {
          addedCredits: 0,
          alreadyRedeemed: true,
          synced: false,
          grantExpiresAt: grant.expiresAt,
          boundDevicesCount: existing.boundDevices.length,
          maxBoundDevices: MAX_BOUND_DEVICES_PER_CODE,
          paidQuota: paidQuotaForDevice(store, deviceHash, now),
        };
      }

      // New device trying to link
      if (existing.boundDevices.length >= MAX_BOUND_DEVICES_PER_CODE) {
        throw new ActivationCodeError(
          `该卡密已达到最大设备绑定上限（最多 ${MAX_BOUND_DEVICES_PER_CODE} 台），如需换设备请联系作者处理`,
          403,
        );
      }

      // Allow multi-device sync
      existing.boundDevices.push(deviceHash);
      pruneSettledReservations(store, now);
      await writeJsonAtomic(filePath, store);

      return {
        addedCredits: grant.remaining,
        alreadyRedeemed: false,
        synced: true,
        grantExpiresAt: grant.expiresAt,
        boundDevicesCount: existing.boundDevices.length,
        maxBoundDevices: MAX_BOUND_DEVICES_PER_CODE,
        paidQuota: paidQuotaForDevice(store, deviceHash, now),
      };
    }

    // Brand new redemption
    const grant: AccessGrant = {
      id: randomUUID(),
      codeHash: verified.hash,
      total: SUPPORTER_PACKAGE_CREDITS,
      remaining: SUPPORTER_PACKAGE_CREDITS,
      redeemedAt: now,
      expiresAt: now + SUPPORTER_PACKAGE_VALID_DAYS * 24 * 60 * 60 * 1000,
    };
    store.grants[grant.id] = grant;
    store.redemptions[verified.hash] = {
      boundDevices: [deviceHash],
      grantId: grant.id,
      redeemedAt: now,
    };
    pruneSettledReservations(store, now);
    await writeJsonAtomic(filePath, store);

    return {
      addedCredits: SUPPORTER_PACKAGE_CREDITS,
      alreadyRedeemed: false,
      synced: false,
      grantExpiresAt: grant.expiresAt,
      boundDevicesCount: 1,
      maxBoundDevices: MAX_BOUND_DEVICES_PER_CODE,
      paidQuota: paidQuotaForDevice(store, deviceHash, now),
    };
  });
}

export async function reservePaidGeneration(
  deviceHash: string,
  reservationId: string,
): Promise<QuotaReservation | null> {
  const filePath = accessFile();
  return withFileLock(filePath, async () => {
    const store = await loadStore();
    const existing = store.reservations[reservationId];
    if (existing) {
      return existing.state === "refunded"
        ? null
        : { id: reservationId, source: "paid" };
    }

    const now = Date.now();
    const grant = getActiveGrantsForDevice(store, deviceHash, now)[0];
    if (!grant) return null;

    grant.remaining -= 1;
    store.reservations[reservationId] = {
      id: reservationId,
      deviceHash,
      grantId: grant.id,
      state: "reserved",
      reservedAt: now,
    };
    pruneSettledReservations(store, now);
    await writeJsonAtomic(filePath, store);
    return { id: reservationId, source: "paid" };
  });
}

export async function commitPaidReservation(
  reservationId: string,
): Promise<boolean> {
  const filePath = accessFile();
  return withFileLock(filePath, async () => {
    const store = await loadStore();
    const reservation = store.reservations[reservationId];
    if (!reservation) return false;
    if (reservation.state === "committed") return true;
    if (reservation.state === "refunded") return false;

    reservation.state = "committed";
    reservation.settledAt = Date.now();
    await writeJsonAtomic(filePath, store);
    return true;
  });
}

export async function refundPaidReservation(
  reservationId: string,
): Promise<boolean> {
  const filePath = accessFile();
  return withFileLock(filePath, async () => {
    const store = await loadStore();
    const reservation = store.reservations[reservationId];
    if (!reservation) return false;
    if (reservation.state === "refunded") return true;
    if (reservation.state === "committed") return false;

    const grant = store.grants[reservation.grantId];
    if (!grant) throw new Error("找不到待退款的创作包批次");
    grant.remaining = Math.min(grant.total, grant.remaining + 1);
    reservation.state = "refunded";
    reservation.settledAt = Date.now();
    await writeJsonAtomic(filePath, store);
    return true;
  });
}
