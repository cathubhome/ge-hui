import { NextResponse } from "next/server";
import {
  FREE_TRANSCRIBE_SITES,
  CUTE_ERRORS,
  CHAT_MODEL_CANDIDATES,
  IMAGE_MODEL_CANDIDATES,
  isChatCapable,
  isImageCapable,
  sortModelIds,
  toOption,
  pickDefault,
} from "@/lib/model-options";
import {
  cpaFetch,
  getCpaApiKey,
  chatModels,
  imageModel,
} from "@/lib/cpa";
import { getAdminConfig, DEFAULT_CHAT_POOL, DEFAULT_IMAGE_POOL, type AdminConfig } from "@/lib/admin-settings";

export const runtime = "nodejs";

async function fetchLiveModelIds(): Promise<Set<string> | null> {
  if (!getCpaApiKey()) return null;
  try {
    const res = await cpaFetch("/models", { method: "GET" });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: Array<{ id?: string }> };
    const ids = new Set<string>();
    for (const row of data.data || []) {
      if (row?.id) ids.add(row.id);
    }
    return ids.size ? ids : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const adminConfig: AdminConfig = await getAdminConfig().catch(() => ({}));

  // 前台呈现模型列表 100% 严格受管理员后台勾选的模型池（免费池 + Pro专享池）动态驱动
  const configuredChatModels = [
    ...(adminConfig.chatPool?.freeModels?.length ? adminConfig.chatPool.freeModels : DEFAULT_CHAT_POOL.freeModels),
    ...(adminConfig.chatPool?.proModels?.length ? adminConfig.chatPool.proModels : DEFAULT_CHAT_POOL.proModels),
  ];
  const chatIds = sortModelIds(Array.from(new Set(configuredChatModels)).filter(isChatCapable), "chat");

  const configuredImageModels = [
    ...(adminConfig.imagePool?.freeModels?.length ? adminConfig.imagePool.freeModels : DEFAULT_IMAGE_POOL.freeModels),
    ...(adminConfig.imagePool?.proModels?.length ? adminConfig.imagePool.proModels : DEFAULT_IMAGE_POOL.proModels),
  ];
  const imageIds = sortModelIds(Array.from(new Set(configuredImageModels)).filter(isImageCapable), "image");

  // 管理员后台默认首选配置 > 环境变量配置 > 默认排位首位
  const preferredChat = adminConfig.chatPool?.defaultFree || adminConfig.defaultChatModel || chatModels()[0];
  const preferredImage = adminConfig.imagePool?.defaultFree || adminConfig.defaultImageModel || imageModel();

  const response = NextResponse.json({
    pricing: adminConfig.pricing,
    defaults: {
      chat: pickDefault(chatIds, preferredChat),
      image: pickDefault(imageIds, preferredImage),
    },
    chatModels: chatIds.map((id) => toOption(id, "chat")),
    imageModels: imageIds.map((id) => toOption(id, "image")),
    freeTranscriptionSites: FREE_TRANSCRIBE_SITES.map((s) => ({
      name: s.name,
      url: s.url,
      tip: s.note,
    })),
    cuteErrors: CUTE_ERRORS,
  });

  // 强制禁用缓存，确保管理员在后台点击保存后，前台用户刷新毫秒级即时同步
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  return response;
}
