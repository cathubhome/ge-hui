export function getOpenAIKey(): string | undefined {
  const key = process.env.OPENAI_API_KEY?.trim();
  return key || undefined;
}

export function requireOpenAIKey(): string {
  const key = getOpenAIKey();
  if (!key) {
    throw new Error("缺少 OPENAI_API_KEY。请在 .env.local 中配置后重试。");
  }
  return key;
}
