import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const title = "安琪打字机｜比熊的星愿打字冒险";
const description = "跟随安琪比熊探索实景动漫 3D 世界，在自然场景、机关奇遇和无限旅程中练习准确而快乐的打字。";

export const metadata: Metadata = {
  metadataBase: new URL("https://key-quest-cn.gitluochao.chatgpt.site"),
  title,
  description,
  openGraph: { title, description, type: "website", images: [{ url: "/og-bichon-v1.png", width: 1672, height: 941, alt: "安琪比熊在实景动漫樱花谷开启星愿打字冒险" }] },
  twitter: { card: "summary_large_image", title, description, images: ["/og-bichon-v1.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
