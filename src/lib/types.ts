export type ScenePanel = {
  labelEn: string;
  labelZh: string;
  action: string;
};

export type ScenePlan = {
  titleEn: string;
  titleZh: string;
  lyricExcerpt: string;
  instructionZh: string;
  panels: ScenePanel[];
  /** English description of the PDF/source character for consistent AI drawing. */
  characterDescription?: string;
  /** spread = picture-book merge; grid = worksheet-style panels */
  layout?: "spread" | "grid";
  /** All cartoon characters to keep from the source book. */
  cast?: string[];
  /** Composition of the N-1 / main reference spread. */
  sceneLayout?: string;
};

export type GenerateMode = "canvas" | "openai-image" | "ai";

export type PdfExtractMode = "text" | "vision";
