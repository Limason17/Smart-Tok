import type { SVGProps } from 'react';

// Small hand-drawn line icon set (24x24, stroke 1.8). Filled variants for active states.
const PATHS: Record<string, string> = {
  heart: 'M12 20.5s-7.5-4.6-9.2-9.6C1.6 7.4 3.8 4 7.3 4c2 0 3.6 1.1 4.7 2.7C13.1 5.1 14.7 4 16.7 4c3.5 0 5.7 3.4 4.5 6.9-1.7 5-9.2 9.6-9.2 9.6Z',
  dislike:
    'M7 14V4.5M7 14l3.6 6.3c.3.5.8.7 1.3.7 1 0 1.8-.9 1.6-1.9L12.8 15h5.6c1.3 0 2.3-1.2 2-2.5l-1.4-6.4A2.6 2.6 0 0 0 16.5 4H7M7 14H4.6c-.9 0-1.6-.7-1.6-1.6V6.1c0-.9.7-1.6 1.6-1.6H7',
  bookmark: 'M6.5 3.5h11c.6 0 1 .4 1 1v16l-6.5-4.4-6.5 4.4v-16c0-.6.4-1 1-1Z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-11v6.5M12 7.2v.1',
  share: 'M12 15V3.5M12 3.5 7.8 7.7M12 3.5l4.2 4.2M5 12.5v6c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-6',
  layers: 'm12 3 9 4.8-9 4.8-9-4.8L12 3Zm-9 9.2 9 4.8 9-4.8M3 16.4l9 4.8 9-4.8',
  settings:
    'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm7.4-3.2c0-.5 0-1-.1-1.4l2-1.6-2-3.4-2.4.9c-.7-.6-1.6-1.1-2.5-1.4L14 2.6h-4l-.4 2.5c-.9.3-1.8.8-2.5 1.4l-2.4-.9-2 3.4 2 1.6a8 8 0 0 0 0 2.8l-2 1.6 2 3.4 2.4-.9c.7.6 1.6 1.1 2.5 1.4l.4 2.5h4l.4-2.5c.9-.3 1.8-.8 2.5-1.4l2.4.9 2-3.4-2-1.6c.1-.4.1-.9.1-1.4Z',
  close: 'M6 6l12 12M18 6 6 18',
  chevron: 'm9 6 6 6-6 6',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  plus: 'M12 5v14M5 12h14',
  // Area icons
  mindset: 'M12 3a6.5 6.5 0 0 0-4 11.6V18h8v-3.4A6.5 6.5 0 0 0 12 3Zm-2.5 18h5M12 7v3.5m-2 0h4',
  speech: 'M4 5.5h16v10H9.5L5 19.5v-4H4v-10Zm4 4h8m-8 3h5',
  people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5m.5-16.3a3.5 3.5 0 0 1 0 6.6M17.5 14.8c1.9.6 3.1 2.4 3.5 5.2',
  money: 'M3.5 6.5h17v11h-17v-11Zm8.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6.5 9.5v.1m11 4.8v.1',
  faith: 'M12 2.8v18.4M6.5 8.2h11',
  knowledge: 'M4 5.5c2.7-.9 5.3-.6 8 1 2.7-1.6 5.3-1.9 8-1v13c-2.7-.9-5.3-.6-8 1-2.7-1.6-5.3-1.9-8-1v-13Zm8 1v13',
  history: 'M12 21a9 9 0 1 0-8.5-6M3 20v-5h5M12 7.5V12l3 2',
  quote: 'M10 7.5c-3 .8-4.5 3-4.5 6.2V17H10v-4.5H7.6M18.5 7.5c-3 .8-4.5 3-4.5 6.2V17h4.5v-4.5h-2.4',
  body: 'M12 6.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM5 9l7 1.2L19 9m-7 1.2V15m0 0-3 6.5m3-6.5 3 6.5',
  news: 'M5 4.5h11.5v15H6.5A1.5 1.5 0 0 1 5 18V4.5Zm11.5 4H19V18a1.5 1.5 0 0 1-3 0M8 8h5.5M8 11.5h5.5M8 15h3.5',
};

const FILLABLE = new Set(['heart', 'bookmark', 'dislike']);

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: string;
  filled?: boolean;
  size?: number;
}

export function Icon({ name, filled, size = 24, ...rest }: IconProps) {
  const d = PATHS[name] ?? PATHS.info;
  const fill = filled && FILLABLE.has(name);
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={fill ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={d} />
    </svg>
  );
}
