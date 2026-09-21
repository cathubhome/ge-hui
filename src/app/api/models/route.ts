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

  let chatIds: string[];
  let imageIds: string[];

  if (live) {
    // Live catalog is source of truth: only show currently available models.
    chatIds = sortModelIds([...live].filter(isChatCapable), "chat");
    imageIds = sortModelIds([...live].filter(isImageCapable), "image");
  } else {
    // Offline fallback: curated candidates only (may briefly include stale ids).
    chatIds = sortModelIds(
      CHAT_MODEL_CANDIDATES.filter(isChatCapable),
      "chat",
    );
    imageIds = sortModelIds(
      IMAGE_MODEL_CANDIDATES.filter(isImageCapable),
      "image",
    );
  }

  const preferredChat = chatModels()[0];
  const preferredImage = imageModel();

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
