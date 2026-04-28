import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "이랜드 유통 매출 대시보드",
  description: "CSO실 매출 데이터 분석 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
