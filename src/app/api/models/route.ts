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
import { getAdminConfig, type AdminConfig } from "@/lib/admin-settings";

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
  const live = await fetchLiveModelIds();
  const adminConfig: AdminConfig = await getAdminConfig().catch(() => ({}));

  // 并集机制：保证系统实测支持的高阶 GPT 和出图画师全部稳定呈现，同时收纳网关探测到的最新模型
  const liveChat = live ? [...live].filter(isChatCapable) : [];
  const allChatIds = Array.from(new Set([...CHAT_MODEL_CANDIDATES, ...liveChat]));
  const chatIds = sortModelIds(allChatIds, "chat");

  const liveImage = live ? [...live].filter(isImageCapable) : [];
  const allImageIds = Array.from(new Set([...IMAGE_MODEL_CANDIDATES, ...liveImage]));
  const imageIds = sortModelIds(allImageIds, "image");

  // 管理员后台配置 > 环境变量配置 > 默认排位首位
  const preferredChat = adminConfig.defaultChatModel || chatModels()[0];
  const preferredImage = adminConfig.defaultImageModel || imageModel();

  return NextResponse.json({
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
    liveFiltered: Boolean(live),
  });
}
