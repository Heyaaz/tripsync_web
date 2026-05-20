import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 개발 서버를 3001 포트로 고정 (서버 Spring는 8080)
  // `npm run dev -- -p 3001` 로 실행하거나 package.json 수정으로 처리

  // API 프록시: /api/* → Spring 서버 localhost:8080/api/*
  // 쿠키 기반 세션이므로 credentials 포함 필요
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'}/api/:path*`,
      },
    ];
  },

  // 외부 이미지 도메인 허용
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '**.visitkorea.or.kr' },
      { protocol: 'http', hostname: '**.visitkorea.or.kr' },
      { protocol: 'https', hostname: '*.tistory.com' },
    ],
  },
};

export default nextConfig;
