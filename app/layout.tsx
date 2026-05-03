import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR, Geist_Mono, Song_Myung } from "next/font/google";
import { ToastProvider } from "@/hooks/useToast";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const songMyung = Song_Myung({
  variable: "--font-song-myung",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "영화대교 예매 시스템",
  description: "대구과학고등학교 자율동아리 영화대교 정기 상영회 좌석 예매",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ko"
      className={`${notoSansKr.variable} ${geistMono.variable} ${songMyung.variable}`}
    >
      <body className="min-h-screen flex flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
