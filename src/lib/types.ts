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
};

export type GenerateMode = "canvas" | "openai-image";
