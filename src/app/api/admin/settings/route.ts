import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, getAdminConfig, saveAdminConfig, verifyAdminToken, type AdminConfig, type PricingConfig, type ModelPoolConfig } from "@/lib/admin-settings";
import { dataRoot, readJsonFile } from "@/lib/json-store";
import path from "node:path";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: "未授权的管理员访问" }, { status: 401 });
  }

  try {
    const config: AdminConfig = await getAdminConfig();

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
      config,
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
    const body = (await req.json().catch(() => ({}))) as {
      pricing?: Partial<PricingConfig>;
      chatPool?: Partial<ModelPoolConfig>;
      imagePool?: Partial<ModelPoolConfig>;
      defaultChatModel?: string;
      defaultImageModel?: string;
    };

    const patch: Partial<AdminConfig> = {};

    if (body.pricing) {
      patch.pricing = {
        price: String(body.pricing.price || "6.6").trim(),
        originalPrice: String(body.pricing.originalPrice || "29.9").trim(),
        promoTag: String(body.pricing.promoTag || "限时特惠").trim(),
      };
    }

    if (body.chatPool) {
      patch.chatPool = {
        freeModels: Array.isArray(body.chatPool.freeModels) ? body.chatPool.freeModels : [],
        proModels: Array.isArray(body.chatPool.proModels) ? body.chatPool.proModels : [],
        defaultFree: String(body.chatPool.defaultFree || "gemini-3.8-flash-high").trim(),
        defaultPro: String(body.chatPool.defaultPro || "gpt-6-astra").trim(),
      };
      patch.defaultChatModel = patch.chatPool.defaultFree;
    } else if (body.defaultChatModel) {
      patch.defaultChatModel = String(body.defaultChatModel).trim();
    }

    if (body.imagePool) {
      patch.imagePool = {
        freeModels: Array.isArray(body.imagePool.freeModels) ? body.imagePool.freeModels : [],
        proModels: Array.isArray(body.imagePool.proModels) ? body.imagePool.proModels : [],
        defaultFree: String(body.imagePool.defaultFree || "gemini-3.1-flash-image").trim(),
        defaultPro: String(body.imagePool.defaultPro || "gpt-image-2.5").trim(),
      };
      patch.defaultImageModel = patch.imagePool.defaultFree;
    } else if (body.defaultImageModel) {
      patch.defaultImageModel = String(body.defaultImageModel).trim();
    }

    const updated = await saveAdminConfig(patch);

    return NextResponse.json({
      success: true,
      message: "控制台配置（定价与多模型池）已更新生效",
      config: updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存配置失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
