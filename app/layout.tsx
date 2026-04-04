import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'TripSync — 갈등 없는 그룹 여행 플래너',
  description: '취향 충돌을 AI가 조율하고 모두가 만족하는 충남 여행 일정을 자동 생성합니다.',
  openGraph: {
    title: 'TripSync — 갈등 없는 그룹 여행',
    description: '8문항 TPTI 검사 → 그룹 갈등 분석 → AI 일정 3가지 자동 생성',
    locale: 'ko_KR',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#09090b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div className="fixed inset-0 pointer-events-none z-[60] opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" aria-hidden="true" />
        {children}
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.min.css" />
        <Script src="https://code.iconify.design/iconify-icon/2.3.0/iconify-icon.min.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
