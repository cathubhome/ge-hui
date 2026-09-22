import { cpaFetch, getCpaApiKey, chatModels } from "@/lib/cpa";
import { inspectPdfPages, readPdfPageCount } from "@/lib/pdf-rasterize";
import { contentSignal } from "@/lib/pdf-text";
import {
  pickPictureBookPages,
  pickReferencePages,
  roleLabel,
  type PictureBookPick,
} from "@/lib/picture-book-pages";

import type { ScenePlan } from "@/lib/types";

export type VisionExtract = {
  text: string;
  characterDescription: string;
  styleNotes?: string;
  titleHint?: string;
  sceneLayout?: string;
  cast?: string[];
  referenceImageDataUrls: string[];
  plan?: ScenePlan;
};

type LabeledPage = PictureBookPick & {
  dataUrl: string;
  totalPages: number;
};

function parseVisionJson(
  raw: string,
): Omit<VisionExtract, "referenceImageDataUrls"> | null {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    const obj = JSON.parse(cleaned) as Record<string, unknown>;
    const text = String(obj.text || obj.lyrics || obj.story || "").trim();
    const characterDescription = String(
      obj.characterDescription || obj.character || obj.mainCharacter || "",
    ).trim();
    if (!text || contentSignal(text) < 12) return null;
    const cast = Array.isArray(obj.cast)
      ? obj.cast.map((c) => String(c).trim()).filter(Boolean).slice(0, 12)
      : [];
    const titleEn = String(obj.titleEn || obj.titleHint || obj.title || "").trim();
    const titleZh = String(obj.titleZh || "").trim() || "歌曲绘本";
    const excerpt = String(obj.lyricExcerpt || text.split(/\r?\n/).slice(0, 6).join("\n") || text.slice(0, 240)).trim();
    const rawPanels = Array.isArray(obj.panels) ? obj.panels : [];
    const panels = rawPanels.slice(0, 4).map((p: any, i: number) => ({
      labelEn: String(p?.labelEn || `SCENE ${i + 1}`),
      labelZh: String(p?.labelZh || `场景 ${i + 1}`),
      action: String(p?.action || "生动表演"),
    }));

    const plan: ScenePlan = {
      titleEn: titleEn || "Song Picture Book",
      titleZh,
      lyricExcerpt: excerpt,
      instructionZh: "",
      panels: panels.length ? panels : [{ labelEn: "MAIN", labelZh: "主画面", action: "生动展现歌词场景" }],
      characterDescription:
        characterDescription ||
        (cast.length ? cast.join("; ") : undefined),
      layout: "spread",
      cast: cast.length ? cast : undefined,
      sceneLayout: String(obj.sceneLayout || obj.layout || "").trim() || undefined,
    };

    return {
      text,
      characterDescription:
        characterDescription ||
        (cast.length
          ? cast.join("; ")
          : "cartoon animals from a children's picture book, gathered on one open spread"),
      styleNotes: String(obj.styleNotes || obj.style || "").trim() || undefined,
      titleHint: titleEn || undefined,
      sceneLayout: String(obj.sceneLayout || obj.layout || "").trim() || undefined,
      cast: cast.length ? cast : undefined,
      plan,
    };
  } catch {
    return null;
  }
}

async function visionExtractFromPages(
  pages: LabeledPage[],
  chatModel?: string,
): Promise<Omit<VisionExtract, "referenceImageDataUrls">> {
  if (!getCpaApiKey()) {
    throw new Error(
      "这份 PDF 是图文绘本，需要看图读词。请先在服务器配置密钥，或把歌词粘贴到下面～",
    );
  }

  const model =
    String(chatModel || "").trim() ||
    chatModels().find((id) => id.toLowerCase().includes("gemini")) ||
    chatModels()[0] ||
    "gemini-3.8-flash-high";

  const total = pages[0]?.totalPages || pages.length;
  const prompt = `你是儿童英语启蒙绘本助手。用户上传的是卡通绘本 PDF，不是纯文本歌词。

页角色：
- LYRICS（通常最后一页）是整首歌词：text 必须优先从这一页提取，保留原文语言和分行，去掉页码/出版社。
- MAIN SPREAD（通常倒数第二页）是主图：可能是角色合页或游戏对白页。characterDescription 必须列出这一页上的每一个卡通角色（外形、颜色、服装/斑纹），不要只写一个主角。sceneLayout 描述谁在画面哪一侧、背景颜色、有没有对话框。
- COVER/CAST（通常第一页）可能是人物合集，常有品牌 logo：只用来认角色和服装配色，忽略商标、网址、二维码、出版社字。
- STORY 页只参考画风。不要把封面 logo 写进角色描述。禁止把绘本理解成八宫格练习纸。

输出 JSON 对象，不要 markdown。字段：
1) text：歌词全文（优先最后一页）
2) titleEn：英文歌名（若封面或歌词可见）
3) titleZh：歌名中文翻译（如"穿上鞋子"）
4) lyricExcerpt：最核心的 4-6 行英文歌词摘要（用于绘本卡片展示）
5) characterDescription：英文，列出参考图上出现的每一个卡通角色（外观、服装颜色、特征）
6) cast：字符串数组，每个角色一条
7) sceneLayout：英文，描述倒数第二页的构图（开放跨页，不是格子）
8) styleNotes：原书画风与配色（如 flat vector, simple shapes）
9) panels：数组（2-4项，每项含 labelEn, labelZh, action 描述角色生动动作）`;

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [{ type: "text", text: prompt }];

  for (const p of pages) {
    content.push({
      type: "text",
      text: roleLabel(p.role, p.page, p.totalPages || total),
    });
    content.push({ type: "image_url", image_url: { url: p.dataUrl } });
  }

  const res = await cpaFetch("/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    await res.text().catch(() => "");
    throw new Error("看图读词时服务有点忙，请稍后再试，或直接粘贴歌词～");
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = String(data.choices?.[0]?.message?.content || "").trim();
  const parsed = parseVisionJson(raw);
  if (!parsed) {
    throw new Error(
      "看见图了，但没读清最后一页的歌词。请把歌词粘贴到下面，我们也能画～",
    );
  }
  if (parsed.styleNotes) {
    parsed.characterDescription = `${parsed.characterDescription}. Art style: ${parsed.styleNotes}`;
  }
  return parsed;
}

/** Heavy vision path — only call from job runner after Generate. */
export async function visionExtractPdf(
  pdfBytes: Uint8Array | Buffer,
  chatModel?: string,
): Promise<VisionExtract> {
  const bytes =
    pdfBytes instanceof ArrayBuffer
      ? new Uint8Array(pdfBytes)
      : Uint8Array.from(pdfBytes);

  const totalPages = await readPdfPageCount(bytes);
  if (totalPages < 1) {
    throw new Error("这份 PDF 没有可读页面。请把歌词粘贴到下面试试～");
  }

  const picks = pickPictureBookPages(totalPages);
  const { pages } = await inspectPdfPages(bytes, {
    pageNumbers: picks.map((p) => p.page),
    maxEdge: 960,
  });
  if (!pages.length) {
    throw new Error("这份 PDF 没有可读页面。请把歌词粘贴到下面试试～");
  }

  const byPage = new Map(pages.map((p) => [p.page, p]));
  const labeled: LabeledPage[] = picks
    .map((pick) => {
      const raster = byPage.get(pick.page);
      if (!raster) return null;
      return { ...pick, dataUrl: raster.dataUrl, totalPages };
    })
    .filter((p): p is LabeledPage => Boolean(p));

  const vision = await visionExtractFromPages(labeled, chatModel);
  const refPicks = pickReferencePages(picks);
  const referenceImageDataUrls = refPicks
    .map((pick) => byPage.get(pick.page)?.dataUrl)
    .filter((u): u is string => Boolean(u))
    .slice(0, 2);

  return { ...vision, referenceImageDataUrls };
}
