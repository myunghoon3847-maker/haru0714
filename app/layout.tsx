import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  const description = "히라가나·가타카나, 기초 단어 1,000개, 생활회화 100문장을 매일 가볍게 학습하세요.";
  return {
    metadataBase: base,
    title: "하루니혼 Lite | 매일 10분 일본어",
    description,
    applicationName: "하루니혼 Lite",
    manifest: "/manifest.webmanifest",
    icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
    appleWebApp: { capable: true, statusBarStyle: "default", title: "하루니혼" },
    formatDetection: { telephone: false },
    openGraph: { title: "하루니혼 Lite", description: "매일 가볍게, 일본어 한 걸음", type: "website", locale: "ko_KR", images: [{ url: "/og.png", width: 1664, height: 936, alt: "하루니혼 Lite" }] },
    twitter: { card: "summary_large_image", title: "하루니혼 Lite", description, images: ["/og.png"] },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#3b67f6",
  colorScheme: "light dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={geist.variable}>{children}</body>
    </html>
  );
}
