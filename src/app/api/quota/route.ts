import { NextRequest, NextResponse } from "next/server";
import { checkQuota, extractClientIp } from "@/lib/rate-limiter";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const ip = extractClientIp(req.headers);
  const authHeader = req.headers.get("authorization") || "";
  const vipToken = authHeader.replace(/^Bearer\s+/i, "").trim() || undefined;

  const quota = await checkQuota(ip, vipToken);
  return NextResponse.json({ quota });
}
