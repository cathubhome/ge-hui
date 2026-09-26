import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, getAdminConfig, saveAdminConfig, verifyAdminToken, type AdminConfig } from "@/lib/admin-settings";
import { dataRoot, readJsonFile } from "@/lib/json-store";
import path from "node:path";
import { chatModels, imageModel } from "@/lib/cpa";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: "未授权的管理员访问" }, { status: 401 });
  }

  try {
    const config: AdminConfig = await getAdminConfig().catch(() => ({}));

    // Read statistics
    const accessStoreFile = path.join(dataRoot(), "access-store.json");
    const rateLimitsFile = path.join(dataRoot(), "rate-limits.json");

    const access = await readJsonFile<{ redemptions?: Record<string, unknown> }>(accessStoreFile, () => ({}));
    const limits = await readJsonFile<{ records?: Record<string, { dateKey?: string; dailyCount?: number }> }>(rateLimitsFile, () => ({}));

    const totalRedeemed = Object.keys(access.redemptions || {}).length;

    const today = new Date().toISOString().slice(0, 10);
    let todayActiveDevices = 0;
    let todayTotalGenerations = 0;

    for (const rec of Object.values(limits.records || {})) {
      if (rec?.dateKey === today) {
        todayActiveDevices++;
        todayTotalGenerations += (rec.dailyCount || 0);
      }
    }

    return NextResponse.json({
      success: true,
      config: {
        defaultChatModel: config.defaultChatModel || chatModels()[0],
        defaultImageModel: config.defaultImageModel || imageModel(),
        updatedAt: config.updatedAt,
      },
      stats: {
        totalRedeemedCodes: totalRedeemed,
        todayActiveDevices,
        todayTotalGenerations,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取管理数据失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: "未授权的管理员访问" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const defaultChatModel = body.defaultChatModel ? String(body.defaultChatModel).trim() : undefined;
    const defaultImageModel = body.defaultImageModel ? String(body.defaultImageModel).trim() : undefined;

    const updated = await saveAdminConfig({
      defaultChatModel,
      defaultImageModel,
    });

    return NextResponse.json({
      success: true,
      message: "模型首选项配置已更新生效",
      config: updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存配置失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
