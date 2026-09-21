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
};

export type GenerateMode = "canvas" | "openai-image" | "ai";

export type PdfExtractMode = "text" | "vision";
