import { randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

const INTERNAL_HEADER = "x-ge-hui-internal";
const processToken = randomBytes(32).toString("base64url");

export function internalJsonHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    [INTERNAL_HEADER]: processToken,
  };
}

export function isInternalRequest(req: NextRequest): boolean {
  const supplied = req.headers.get(INTERNAL_HEADER) || "";
  const actual = Buffer.from(processToken);
  const candidate = Buffer.from(supplied);
  return (
    actual.length === candidate.length && timingSafeEqual(actual, candidate)
  );
}
