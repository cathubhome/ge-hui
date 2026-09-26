import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  TOKEN_MAX_AGE_SECONDS,
  signAdminToken,
  verifyAdminPassword,
  verifyAdminToken,
} from "@/lib/admin-settings";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const authenticated = verifyAdminToken(token);
  return NextResponse.json({ authenticated });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const password = String(body.password || "").trim();

    if (!verifyAdminPassword(password)) {
      return NextResponse.json({ error: "管理员密码错误" }, { status: 401 });
    }

    const token = signAdminToken();
    const res = NextResponse.json({ success: true, message: "登录成功" });
    res.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: TOKEN_MAX_AGE_SECONDS,
      priority: "high",
    });
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : "登录失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true, message: "已退出登录" });
  res.cookies.delete(ADMIN_COOKIE_NAME);
  return res;
}
