export function getCpaBaseUrl(): string {
  return (process.env.CPA_BASE_URL || "https://api.3099520.xyz/v1").replace(/\/$/, "");
}

export function getCpaApiKey(): string | undefined {
  const key = process.env.CPA_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  return key || undefined;
}

export function requireCpaApiKey(): string {
  const key = getCpaApiKey();
  if (!key) {
    throw new Error("还没配置服务密钥，请先让管理员配置好哦～");
  }
  return key;
}

export function chatModels(): string[] {
  const primary = process.env.CPA_CHAT_MODEL?.trim() || "gemini-3.8-flash-high";
  const fallback = process.env.CPA_CHAT_FALLBACK_MODEL?.trim() || "glm-5.3";
  return primary === fallback ? [primary] : [primary, fallback];
}

export function transcribeModel(): string {
  return process.env.CPA_TRANSCRIBE_MODEL?.trim() || "gemini-3.8-flash-high";
}

export function imageModel(): string {
  return process.env.CPA_IMAGE_MODEL?.trim() || "gpt-image-2";
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

export async function cpaFetch(
  path: string,
  init: RequestInit = {},
  maxRetries = 2,
): Promise<Response> {
  const key = requireCpaApiKey();
  const base = getCpaBaseUrl();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const headers = new Headers(init.headers || {});
      headers.set("Authorization", `Bearer ${key}`);
      headers.set("User-Agent", BROWSER_UA);
      if (!headers.has("Accept")) headers.set("Accept", "application/json");
      if (typeof FormData !== "undefined" && init.body instanceof FormData) {
        headers.delete("Content-Type");
      }
      return await fetch(url, { ...init, headers });
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isNetworkError =
        msg.includes("fetch failed") ||
        msg.includes("timeout") ||
        msg.includes("ECONNRESET") ||
        msg.includes("ETIMEDOUT");

      if (attempt < maxRetries && isNetworkError) {
        // Retry with backoff: 500ms, 1200ms
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
        continue;
      }
      break;
    }
  }

  const finalMsg = lastError instanceof Error ? lastError.message : String(lastError);
  if (finalMsg.includes("fetch failed")) {
    throw new Error("海外绘图接口连接超时，请检查网络或点击「再试一次」～");
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function cpaChatCompletion(body: Record<string, unknown>, models = chatModels()) {
  let lastError = "";
  for (const model of models) {
    const res = await cpaFetch("/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, model }),
    });
    if (res.ok) {
      const data = await res.json();
      return { data, model };
    }
    const text = await res.text();
    lastError = `${model}: ${res.status} ${text}`;
    // try next model on 4xx/5xx
  }
  throw new Error(`CPA Chat 失败：${lastError}`);
}


export function resolveChatModels(primary?: string, fallback?: string): string[] {
  const p = (primary || "").trim() || chatModels()[0];
  const f = (fallback || "").trim() || chatModels()[1] || "glm-5.3";
  return p === f ? [p] : [p, f];
}
