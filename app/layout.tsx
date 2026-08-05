import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const title = "安琪打字机｜比熊自然探索打字游戏";
const description = "跟随比熊安琪走进写实自然场景，通过点击探索、机关任务与无限旅程，练习准确而专注的打字。";

export const metadata: Metadata = {
  metadataBase: new URL("https://key-quest-cn.gitluochao.chatgpt.site"),
  title,
  description,
  openGraph: { title, description, type: "website", images: [{ url: "/worlds/bichon-garden-real-v1.webp", width: 1672, height: 941, alt: "一只真实的奶油白比熊站在雨后自然花园石径上" }] },
  twitter: { card: "summary_large_image", title, description, images: ["/worlds/bichon-garden-real-v1.webp"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
