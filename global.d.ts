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
  interface Window {
    kakao?: {
      maps?: {
        load?: (callback: () => void) => void;
      };
    } & Record<string, unknown>;
  }
}
