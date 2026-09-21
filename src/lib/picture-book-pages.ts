export type PictureBookPageRole =
  | "cover_cast"
  | "character"
  | "lyrics"
  | "story";

export type PictureBookPick = {
  page: number;
  role: PictureBookPageRole;
};

/**
 * Typical picture-book PDF:
 * page 1 = character lineup (often branded),
 * last page = full lyrics,
 * second-to-last = the main group spread to redraw.
 */
export function pickPictureBookPages(numPages: number): PictureBookPick[] {
  const n = Math.max(0, Math.floor(Number(numPages) || 0));
  if (n < 1) return [];
  if (n === 1) return [{ page: 1, role: "lyrics" }];
  if (n === 2) {
    return [
      { page: 1, role: "character" },
      { page: 2, role: "lyrics" },
    ];
  }

  const picks: PictureBookPick[] = [
    { page: 1, role: "cover_cast" },
    { page: n - 1, role: "character" },
    { page: n, role: "lyrics" },
  ];
  const mid = Math.max(2, Math.min(n - 2, Math.ceil(n / 2)));
  if (mid !== 1 && mid !== n - 1 && mid !== n) {
    picks.splice(1, 0, { page: mid, role: "story" });
  }
  return picks;
}

/** N-1 group spread first, optional branded page 1. Never the lyrics page. */
export function pickReferencePages(picks: PictureBookPick[]): PictureBookPick[] {
  const character = picks.find((x) => x.role === "character");
  const cover = picks.find((x) => x.role === "cover_cast");
  const out: PictureBookPick[] = [];
  if (character) out.push(character);
  else if (cover) out.push(cover);
  else {
    const fallback = picks.find((x) => x.role !== "lyrics") || picks[0];
    if (fallback) out.push(fallback);
  }
  if (cover && character && cover.page !== character.page) out.push(cover);
  return out.slice(0, 2);
}

export function roleLabel(role: PictureBookPageRole, page: number, total: number): string {
  switch (role) {
    case "cover_cast":
      return `Page ${page}/${total} COVER/CAST: extra characters only. Ignore brand logos, trademarks, websites, QR codes, publisher marks.`;
    case "character":
      return `Page ${page}/${total} MAIN SPREAD (usually second-to-last): this is the MAIN image. List EVERY cartoon character. Keep the same open-page composition and palette. Ignore logos, URLs, QR codes, page numbers. Not a character sheet of one mascot, not an 8-grid.`;
    case "lyrics":
      return `Page ${page}/${total} LYRICS (usually last page): extract the full lyrics from this page first. Do not use as a drawing reference.`;
    case "story":
      return `Page ${page}/${total} STORY PAGE: art-style / palette reference only.`;
    default:
      return `Page ${page}/${total}`;
  }
}
