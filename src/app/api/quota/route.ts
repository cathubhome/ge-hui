import { NextRequest, NextResponse } from "next/server";
import { attachDeviceCookie, resolveDeviceIdentity } from "@/lib/device-identity";
import { getQuotaStatus } from "@/lib/rate-limiter";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const identity = resolveDeviceIdentity(req);
  const quota = await getQuotaStatus(identity.deviceHash);
  const res = NextResponse.json({ quota });
  res.headers.set("Cache-Control", "no-store");
  return attachDeviceCookie(res, identity);
}
