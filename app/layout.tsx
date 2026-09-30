import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const title = "安琪打字机｜3D 指法探险";
const description = "和比熊棉棉一起探索 6 座 3D 区域、完成 32 段打字旅程。从十指定位、英文故事到中文拼音，配合无提示复测与隔日巩固，先打准，再打快。";

export const metadata: Metadata = {
  metadataBase: new URL("https://key-quest-cn.gitluochao.chatgpt.site"),
  title,
  description,
  icons: { icon: "/favicon.svg" },
  openGraph: { title, description, type: "website" },
  twitter: { card: "summary", title, description },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
