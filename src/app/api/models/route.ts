import { NextResponse } from "next/server";
import {
  CHAT_MODEL_OPTIONS,
  TRANSCRIBE_MODEL_OPTIONS,
  IMAGE_MODEL_OPTIONS,
  FREE_TRANSCRIBE_SITES,
} from "@/lib/model-options";
import { chatModels, imageModel, transcribeModel } from "@/lib/cpa";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    defaults: {
      chat: chatModels()[0],
      chatFallback: chatModels()[1] || chatModels()[0],
      transcribe: transcribeModel(),
      image: imageModel(),
    },
    chat: CHAT_MODEL_OPTIONS,
    transcribe: TRANSCRIBE_MODEL_OPTIONS,
    image: IMAGE_MODEL_OPTIONS,
    freeTranscribeSites: FREE_TRANSCRIBE_SITES,
  });
}
