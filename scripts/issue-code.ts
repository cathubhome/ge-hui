import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadEnvFile(file: string): void {
  const full = path.join(process.cwd(), file);
  if (!existsSync(full)) return;
  const content = readFileSync(full, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

import { generateActivationCodes } from "@/lib/access-store";

function printUsage(): void {
  console.log(`
使用方式:
  npm run access:issue -- [--count <数量>]

示例:
  npm run access:issue
  npm run access:issue -- --count 5
`);
}

function parseCount(args: string[]): number {
  const index = args.findIndex((arg) => arg === "--count" || arg === "-c");
  if (index === -1) return 1;
  const raw = args[index + 1];
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new Error(`无效的数量参数: ${raw}，请输入 1 到 100 之间的整数`);
  }
  return parsed;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    return;
  }

  const count = parseCount(args);
  const codes = generateActivationCodes(count);

  console.log("========================================");
  console.log("🌟 歌绘创作包 · 一客一码激活卡密生成");
  console.log(`生成数量: ${codes.length}`);
  console.log("权益规格: 每码增加 20 次绘本生成，自兑换起 90 天有效");
  console.log("========================================");
  for (const [idx, code] of codes.entries()) {
    console.log(`${String(idx + 1).padStart(2, "0")}. ${code}`);
  }
  console.log("========================================");
  console.log("提示: 请直接将卡密发送给用户；卡密未被线上存储，首次兑换后自动与设备绑定。");
}

main().catch((error) => {
  console.error("生成失败:", error instanceof Error ? error.message : error);
  process.exit(1);
});
