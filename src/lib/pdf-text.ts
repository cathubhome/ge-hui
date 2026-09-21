/** Shared light PDF text helpers (no vision / no Gemini). */

export function usableLyricsText(raw: string): string {
  return raw
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, " ")
    .replace(/\f/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Count letters / CJK that look like real lyric content. */
export function contentSignal(text: string): number {
  const m = text.match(/[A-Za-z\u4e00-\u9fff]/g);
  return m ? m.length : 0;
}

/** Minimum signal to treat PDF as having a usable text layer. */
export const TEXT_LAYER_MIN_SIGNAL = 24;
