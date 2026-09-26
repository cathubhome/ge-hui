import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/lib/admin-settings";
import { generateActivationCodes } from "@/lib/access-store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: "未授权的管理员访问" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const count = parseInt(String(body.count || 1), 10);
    if (isNaN(count) || count < 1 || count > 100) {
      return NextResponse.json({ error: "生成数量必须在 1 到 100 之间" }, { status: 400 });
    }

    const codes = generateActivationCodes(count);
    const origin = req.nextUrl.origin;

    const items = codes.map((code) => ({
      code,
      magicLink: `${origin}/?code=${encodeURIComponent(code)}`,
    }));

    return NextResponse.json({
      success: true,
      count: items.length,
      items,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成卡密失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
