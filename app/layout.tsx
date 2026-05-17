import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'TripSync — 갈등 없는 그룹 여행 플래너',
  description: '서로 다른 여행 스타일을 여행 MBTI로 분석하고, TripSync가 모두가 만족할 합의 일정을 만들어 드립니다.',
  openGraph: {
    title: 'TripSync — 갈등 없는 그룹 여행',
    description: '여행 MBTI로 여행 성향을 분석하고, 그룹 궁합을 시각화해 AI 합의 일정을 제안합니다.',
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
