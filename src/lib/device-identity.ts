import { createHash, randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

const DEVICE_COOKIE = "ge_hui_device";
const DEVICE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{40,64}$/;

export type DeviceIdentity = {
  deviceId: string;
  deviceHash: string;
  shouldSetCookie: boolean;
};

export function resolveDeviceIdentity(req: NextRequest): DeviceIdentity {
  const stored = req.cookies.get(DEVICE_COOKIE)?.value || "";
  const shouldSetCookie = !DEVICE_ID_PATTERN.test(stored);
  const deviceId = shouldSetCookie
    ? randomBytes(32).toString("base64url")
    : stored;

  return {
    deviceId,
    deviceHash: createHash("sha256").update(deviceId).digest("hex"),
    shouldSetCookie,
  };
}

export function attachDeviceCookie<T extends NextResponse>(
  response: T,
  identity: DeviceIdentity,
): T {
  if (identity.shouldSetCookie) {
    response.cookies.set({
      name: DEVICE_COOKIE,
      value: identity.deviceId,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DEVICE_MAX_AGE_SECONDS,
      priority: "high",
    });
  }
  return response;
}
