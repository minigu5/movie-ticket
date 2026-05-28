import type { Metadata } from "next";
import { Noto_Sans_KR, Song_Myung } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  display: "swap",
});

const songMyung = Song_Myung({
  variable: "--font-song-myung",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "영화대교 예매 시스템",
  description: "대구과학고등학교 자율동아리 영화대교 영화 예매",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${notoSansKr.variable} ${songMyung.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
