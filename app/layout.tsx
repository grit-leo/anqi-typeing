import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const title = "安琪打字机｜四界大型打字冒险";
const description = "穿越四大魔法世界与十二个剧情关卡，在单词、短句、竞速和守护者挑战中成长为花语打字大师。";

export const metadata: Metadata = {
  metadataBase: new URL("https://key-quest-cn.gitluochao.chatgpt.site"),
  title,
  description,
  openGraph: { title, description, type: "website", images: [{ url: "/og-v5.jpg", width: 1672, height: 941, alt: "安琪打字机四界键盘冒险" }] },
  twitter: { card: "summary_large_image", title, description, images: ["/og-v5.jpg"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
