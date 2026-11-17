import type { SVGProps } from "react";

const PATHS = {
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.3-4.3",
  heart:
    "M12 20s-7-4.4-9.2-8.6C1.3 8.4 3.1 5 6.4 5c2 0 3.5 1.1 4.3 2.4h2.6C14.1 6.1 15.6 5 17.6 5c3.3 0 5.1 3.4 3.6 6.4C19 15.6 12 20 12 20Z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c.6-3.4 3.5-5.5 7-5.5s6.4 2.1 7 5.5",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  arrowRight: "M5 12h14m-5-5 5 5-5 5",
  arrowLeft: "M19 12H5m5-5-5 5 5 5",
  chevronDown: "m6 9 6 6 6-6",
  chevronLeft: "m15 6-6 6 6 6",
  chevronRight: "m9 6 6 6-6 6",
  play: "M8 5.5v13l10.5-6.5L8 5.5Z",
  pause: "M8 5h3v14H8zM13 5h3v14h-3z",
  replay: "M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4",
  check: "m5 12.5 4.5 4.5L19 7",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-9 9h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z",
  filter: "M4 6h16M7 12h10M10 18h4",
  external: "M14 4h6v6m0-6-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  plus: "M12 5v14M5 12h14",
  trash: "M5 7h14M10 11v6m4-6v6M8 7l1-3h6l1 3m-9 0 1 13h8l1-13",
  up: "m6 15 6-6 6 6",
  down: "m6 9 6 6 6-6",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  book: "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Zm0 15A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5Z",
  trend: "M3 17l6-6 4 4 8-8m0 0h-5m5 0v5",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z",
  lotus:
    "M12 20c-4 0-8-2-9-5 2 0 4 .5 5.5 1.5C7 13 8.5 9 12 6c3.5 3 5 7 3.5 10.5C17 15.5 19 15 21 15c-1 3-5 5-9 5Z",
  dumbbell: "M6 9v6M18 9v6M3 10v4M21 10v4M6 12h12",
  alert: "M12 4 2.5 20h19L12 4Zm0 6v4m0 3h.01",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-11v6m0-9h.01",
  calendar: "M5 6h14v14H5zM5 10h14M9 3v4m6-4v4",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  layers: "m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4m-4-4h11",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 20,
  filled = false,
  strokeWidth = 1.8,
  title,
  ...rest
}: { name: IconName; size?: number; filled?: boolean; strokeWidth?: number; title?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <path d={PATHS[name]} />
    </svg>
  );
}
