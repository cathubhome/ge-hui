import type { Metadata } from "next";
import { Nunito, ZCOOL_KuaiLe } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const display = ZCOOL_KuaiLe({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "歌绘 — 歌曲变童趣绘本",
  description: "上传歌曲音频或 PDF 歌词，生成一页童趣分格绘本图",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${nunito.variable} ${display.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
