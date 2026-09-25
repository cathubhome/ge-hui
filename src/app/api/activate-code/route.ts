import { NextRequest, NextResponse } from "next/server";
import {
  ActivationCodeError,
  redeemActivationCode,
} from "@/lib/access-store";
import { attachDeviceCookie, resolveDeviceIdentity } from "@/lib/device-identity";
import { getQuotaStatus } from "@/lib/rate-limiter";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const identity = resolveDeviceIdentity(req);
  try {
    const body = (await req.json()) as { code?: string };
    const rawCode = String(body.code || "").trim();
    if (!rawCode) {
      const quota = await getQuotaStatus(identity.deviceHash);
      return attachDeviceCookie(
        NextResponse.json({ error: "请输入您的激活兑换码", quota }, { status: 400 }),
        identity,
      );
    }

    const redeem = await redeemActivationCode(identity.deviceHash, rawCode);
    const quota = await getQuotaStatus(identity.deviceHash);
    let message = `激活成功！已为您增加 ${redeem.addedCredits} 次绘本创作额度（90天有效）～`;
    if (redeem.alreadyRedeemed) {
      message = "该兑换码已在本浏览器激活，已为您刷新创作额度～";
    } else if (redeem.synced) {
      message = `跨设备同步成功！已为您接入当前创作包（剩余 ${redeem.paidQuota.remaining} 次，第 ${redeem.boundDevicesCount}/${redeem.maxBoundDevices} 台设备）～`;
    }

    const res = NextResponse.json({
      success: true,
      alreadyRedeemed: redeem.alreadyRedeemed,
      synced: redeem.synced,
      boundDevicesCount: redeem.boundDevicesCount,
      maxBoundDevices: redeem.maxBoundDevices,
      message,
      quota,
    });
    res.headers.set("Cache-Control", "no-store");
    return attachDeviceCookie(res, identity);
  } catch (error) {
    const quota = await getQuotaStatus(identity.deviceHash);
    const message =
      error instanceof ActivationCodeError
        ? error.message
        : "激活失败，请检查兑换码或联系作者处理";
    const status = error instanceof ActivationCodeError ? error.status : 500;
    const res = NextResponse.json({ error: message, quota }, { status });
    res.headers.set("Cache-Control", "no-store");
    return attachDeviceCookie(res, identity);
  }
}
