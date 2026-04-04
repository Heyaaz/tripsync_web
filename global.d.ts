import type { CSSProperties, DetailedHTMLProps, HTMLAttributes } from 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'iconify-icon': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        icon?: string;
        width?: string | number;
        height?: string | number;
        style?: CSSProperties;
      };
    }
  }
}

declare global {
  interface KakaoJsSdk {
    init: (appKey: string) => void;
    isInitialized: () => boolean;
    Share: {
      sendScrap: (options: { requestUrl: string }) => Promise<unknown>;
    };
  }

  interface Window {
    Kakao?: KakaoJsSdk;
    kakao?: {
      maps?: {
        load?: (callback: () => void) => void;
      };
    } & Record<string, unknown>;
  }
}
