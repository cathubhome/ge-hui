import type { ScenePlan } from "@/lib/types";

export type HistoryBookItem = {
  id: string;
  songTitle: string;
  lyrics: string;
  imageDataUrl: string;
  plan?: ScenePlan | null;
  audioId?: string | null;
  createdAt: number;
};

const STORAGE_KEY = "ge-hui-history-books-v1";
const MAX_HISTORY = 8;

export function loadBookHistory(): HistoryBookItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryBookItem[];
  } catch {
    return [];
  }
}

export function saveBookHistoryItem(item: Omit<HistoryBookItem, "createdAt">): HistoryBookItem[] {
  if (typeof window === "undefined") return [];
  try {
    const existing = loadBookHistory();
    // Dedup by identical imageDataUrl or id
    const filtered = existing.filter((b) => b.id !== item.id && b.imageDataUrl !== item.imageDataUrl);
    const newItem: HistoryBookItem = {
      ...item,
      createdAt: Date.now(),
    };
    const nextList = [newItem, ...filtered].slice(0, MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
    return nextList;
  } catch {
    // If quota exceeded (large base64), trim to 3 items
    try {
      const existing = loadBookHistory();
      const trimmed = [
        { ...item, createdAt: Date.now() },
        ...existing.slice(0, 2),
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      return trimmed;
    } catch {
      return [];
    }
  }
}

export function clearBookHistory(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
