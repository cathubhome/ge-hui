import { NextResponse } from "next/server";
import {
  CHAT_MODEL_OPTIONS,
  IMAGE_MODEL_OPTIONS,
  FREE_TRANSCRIBE_SITES,
  CUTE_ERRORS,
} from "@/lib/model-options";
import { chatModels, imageModel } from "@/lib/cpa";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    defaults: {
      chat: chatModels()[0],
      image: imageModel(),
    },
    chatModels: CHAT_MODEL_OPTIONS,
    imageModels: IMAGE_MODEL_OPTIONS,
    freeTranscriptionSites: FREE_TRANSCRIBE_SITES.map((s) => ({
      name: s.name,
      url: s.url,
      tip: s.note,
    })),
    cuteErrors: CUTE_ERRORS,
  });
}
