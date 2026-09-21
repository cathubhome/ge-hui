import type { ScenePlan, ScenePanel } from "./types";

const COLORFUL_FALLBACK_ACTIONS = [
  "开心挥手",
  "轻轻跳跃",
  "指向远方",
  "捂嘴微笑",
  "张开双臂",
  "蹲下摸摸",
  "转个小圈",
  "比心加油",
];

function cleanLines(lyrics: string): string[] {
  return lyrics
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\d\.\-\*]+\s*/, "").trim())
    .filter((l) => l.length > 0 && !/^\[.*\]$/.test(l));
}

function pickTitle(lines: string[]): { titleEn: string; titleZh: string } {
  const first = lines[0] || "My Song";
  const looksChinese = /[\u4e00-\u9fff]/.test(first);
  if (looksChinese) {
    return { titleEn: "Song Picture Book", titleZh: first.slice(0, 24) };
  }
  return { titleEn: first.slice(0, 48).toUpperCase(), titleZh: "歌曲绘本" };
}

function panelsFromLines(lines: string[]): ScenePanel[] {
  const bodyParts: Array<{ en: string; zh: string; action: string }> = [
    { en: "HEAD", zh: "头", action: "双手放在头顶" },
    { en: "SHOULDERS", zh: "肩膀", action: "双手放到肩膀" },
    { en: "KNEES", zh: "膝盖", action: "弯腰摸膝盖" },
    { en: "TOES", zh: "脚趾", action: "低头摸脚趾" },
    { en: "EYES", zh: "眼睛", action: "指向眼睛" },
    { en: "EARS", zh: "耳朵", action: "指向耳朵" },
    { en: "MOUTH", zh: "嘴巴", action: "双手放在嘴边" },
    { en: "NOSE", zh: "鼻子", action: "指向鼻子" },
  ];

  const joined = lines.join(" ").toLowerCase();
  const isBodySong =
    /head|shoulder|knee|toe|眼|耳|嘴|鼻|头|肩膀|膝盖|脚趾/.test(joined);

  if (isBodySong) {
    return bodyParts.map((p) => ({
      labelEn: p.en,
      labelZh: p.zh,
      action: p.action,
    }));
  }

  const picks = lines.slice(0, 8);
  while (picks.length < 8) {
    picks.push(lines[picks.length % Math.max(lines.length, 1)] || "啦啦啦");
  }

  return picks.map((line, i) => {
    const short = line.slice(0, 10);
    const looksChinese = /[\u4e00-\u9fff]/.test(short);
    return {
      labelEn: looksChinese ? `SCENE ${i + 1}` : short.toUpperCase() || `SCENE ${i + 1}`,
      labelZh: looksChinese ? short : `场景 ${i + 1}`,
      action: COLORFUL_FALLBACK_ACTIONS[i % COLORFUL_FALLBACK_ACTIONS.length],
    };
  });
}

/** Offline / no-key scene planner — good enough for demo & self-test. */
export function planSceneLocal(lyrics: string): ScenePlan {
  const lines = cleanLines(lyrics);
  const { titleEn, titleZh } = pickTitle(lines);
  const panels = panelsFromLines(lines);
  const excerpt = lines.slice(0, 6).join("\n") || lyrics.slice(0, 200);

  return {
    titleEn,
    titleZh,
    lyricExcerpt: excerpt,
    instructionZh: "边唱边指一指，摸一摸！",
    panels,
  };
}
