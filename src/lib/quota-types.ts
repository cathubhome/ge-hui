export type QuotaSource = "free" | "paid";

export type QuotaReservation = {
  id: string;
  source: QuotaSource;
};

export type QuotaStatus = {
  freeRemainingToday: number;
  freeDailyMax: number;
  paidRemaining: number;
  paidExpiresAt?: string;
  canGenerate: boolean;
  cooldownSeconds: number;
  reason?: string;
};
