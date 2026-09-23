/**
 * Automatically clean and extract a readable song/book title from a filename.
 * Strips extensions, track number prefixes (e.g. "1-", "50."), brackets (e.g. "（阅读版）"),
 * underscores and stray dashes.
 */
export function cleanTitleFromFileName(filename: string): string {
  if (!filename) return "";
  let name = filename.replace(/\.[a-zA-Z0-9]+$/, "");
  name = name.replace(/^[\d\s.\-_]+/, "");
  name = name.replace(
    /[\(（\[【][^\)）\]】]*(阅读|朗读|听写|官方|音频|版|完整|纯音|伴奏|无损|320k|128k|official|lyrics|audio|video)[^\)）\]】]*[\)）\]】]/gi,
    "",
  );
  name = name.replace(/_+/g, " ");
  name = name.replace(/([^\s])-([^\s])/g, (_m, a, b) => a + " - " + b);
  name = name.replace(/^[\s\-–—]+|[\s\-–—]+$/g, "").trim();
  return name;
}