import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const title = "安琪打字机｜花语岛 3D 打字探险";
const description = "和比熊棉棉一起，用指尖唤醒一座 3D 小岛。为 10 岁左右的孩子设计，16 段循序渐进的旅程、清晰指法提示和专属易错键温习，让打字学习慢慢开花。";

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
