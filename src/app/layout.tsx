import type { Metadata } from "next";
import "./globals.css";

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
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
