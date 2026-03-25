import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "LocalFlow — 지역 선거 유동인구 분석",
  description: "기초의원 선거 유세 전략 수립을 위한 유동인구·교통·상권·선거 데이터 종합 분석 플랫폼",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <Script
          src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&autoload=false`}
          strategy="beforeInteractive"
        />
        {children}
      </body>
    </html>
  );
}
