import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { extractClientIp, grantVipStatus } from "@/lib/rate-limiter";

export const runtime = "nodejs";

const redeemedFile = () => {
  const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  return path.join(dir, "redeemed-codes.json");
};

type RedeemRecord = {
  code: string;
  ip: string;
  redeemedAt: number;
};

// Built-in seed batch of Mianbaoduo activation codes (format: GH-XXXX-XXXX)
// You can also add codes in MIANBAODUO_CODES env variable separated by commas
const DEFAULT_CODES = [
  "GH-8A9X-2026",
  "GH-3K7M-5512",
  "GH-9P2W-8831",
  "GH-4F6T-7729",
  "GH-5L1N-3344",
  "GH-7R8Q-9966",
  "GH-2V3Z-1188",
  "GH-6H4B-6622",
  "GH-VIP-8888", // Testing master code
];

function getValidCodePool(): Set<string> {
  const envCodes = process.env.MIANBAODUO_CODES ? process.env.MIANBAODUO_CODES.split(",").map((c) => c.trim()) : [];
  return new Set([...DEFAULT_CODES, ...envCodes]);
}

async function loadRedeemed(): Promise<Map<string, RedeemRecord>> {
  try {
    const raw = await fs.readFile(redeemedFile(), "utf8");
    const json = JSON.parse(raw);
    const map = new Map<string, RedeemRecord>();
    for (const item of json) {
      map.set(item.code, item);
    }
    return map;
  } catch {
    return new Map();
  }
}

async function saveRedeemed(records: RedeemRecord[]) {
  try {
    await fs.mkdir(path.dirname(redeemedFile()), { recursive: true });
    await fs.writeFile(redeemedFile(), JSON.stringify(records, null, 2), "utf8");
  } catch {}
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawCode = String(body.code || "").trim().toUpperCase();
    const ip = extractClientIp(req.headers);

    if (!rawCode) {
      return NextResponse.json({ error: "请输入您的激活兑换码" }, { status: 400 });
    }

    const pool = getValidCodePool();
    if (!pool.has(rawCode)) {
      return NextResponse.json({ error: "无效的激活码，请确认是否输入正确（可在面包多订单查看）" }, { status: 400 });
    }

    const redeemedMap = await loadRedeemed();
    if (redeemedMap.has(rawCode)) {
      const rec = redeemedMap.get(rawCode)!;
      // Allow re-activation if requested by the SAME IP
      if (rec.ip !== ip) {
        return NextResponse.json(
          { error: "该激活码已被其他设备使用过，一码仅限绑定一台设备哦～" },
          { status: 403 }
        );
      }
    } else {
      // Record new redemption
      const rec: RedeemRecord = {
        code: rawCode,
        ip,
        redeemedAt: Date.now(),
      };
      redeemedMap.set(rawCode, rec);
      await saveRedeemed(Array.from(redeemedMap.values()));
    }

    // Grant 7-day VIP access to this IP
    await grantVipStatus(ip, 7);

    return NextResponse.json({
      success: true,
      message: "激活成功！已为您解锁 7 天无限次绘本创作特权～",
      vipToken: `VIP_${Date.now()}_${rawCode}`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "激活失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
