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
export type UserPreference = {
  /** 出镜角色: default = 跟随绘本; solo = 只要主角; all = 小伙伴都在 */
  roleScope?: "default" | "solo" | "all";
  /** 画面质感: default = 绘本原画; crayon = 蜡笔童趣风; clay = 立体彩泥/剪纸 */
  artStyle?: "default" | "crayon" | "clay";
  /** 补充愿望 (不超过40字) */
  customPrompt?: string;
};
