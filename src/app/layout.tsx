import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LocalFlow — 지역 선거 참고 자료",
  description: "기초의원 선거 유세 전략 수립을 위한 유동인구·교통·상권·선거 데이터 종합 분석 플랫폼",
  manifest: "/manifest.json",
  themeColor: "#f5c542",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LocalFlow",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
