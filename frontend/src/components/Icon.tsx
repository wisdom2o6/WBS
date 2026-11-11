import type { CSSProperties } from "react";

const paths: Record<string, string> = {
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  home: "m3 10 9-7 9 7v10H3z M9 20v-7h6v7",
  folder: "M3 7V4h6l3 3h9v13H3z",
  check: "m5 12 4 4L19 6",
  tasks: "M9 5h12 M9 12h12 M9 19h12 M3 4l1 1 2-2 M3 11l1 1 2-2 M3 18l1 1 2-2",
  clock: "M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  image: "M3 3h18v18H3z m0 13 5-5 4 4 3-3 6 6 M8 7h.01",
  file: "M14 2H5v20h14V7z M14 2v6h5 M8 13h8 M8 17h6",
  users:
    "M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M15 4a4 4 0 0 1 0 8 M22 21v-3a4 4 0 0 0-3-4 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  settings:
    "m9 3 6 0 1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  bell: "M18 8a6 6 0 0 0-12 0c0 8-3 8-3 10h18c0-2-3-2-3-10 M10 22h4",
  plus: "M12 5v14 M5 12h14",
  chevron: "m9 5 7 7-7 7",
  down: "m6 9 6 6 6-6",
  arrow: "M4 12h16 m-6-6 6 6-6 6",
  diagonal: "M5 19 19 5 M5 5h14v14",
  more: "M5 12h.01 M12 12h.01 M19 12h.01",
  close: "m6 6 12 12 M6 18 18 6",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  panel: "M3 3h18v18H3z M9 3v18",
  logout: "M10 3H3v18h7 M10 12h11 m-5-5 5 5-5 5",
  help: "M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4 M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  lock: "M5 10h14v12H5z M8 10V6a4 4 0 0 1 8 0v4 M12 15v3",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  eyeoff: "m3 3 18 18 M9 5c7-2 13 7 13 7l-3 4 M6 6l-4 6s6 9 14 6",
  mail: "M2 4h20v16H2z m0 1 10 8L22 5",
  list: "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
  filter: "M3 5h18 M6 12h12 M9 19h6",
  star: "m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1z",
  chat: "M21 3H3v15h5l4 4 4-4h5z M7 8h10 M7 12h6",
  upload: "M12 16V2 m-5 5 5-5 5 5 M3 15v6h18v-6",
  download: "M12 2v14 m-5-5 5 5 5-5 M3 15v6h18v-6",
  trash: "M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7",
  edit: "m3 16 13-13 5 5L8 21H3z M13 6l5 5",
  info: "M12 10v7 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  link: "m10 13 4-4 M8 16l-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0 M16 8l2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0",
  send: "m22 2-7 20-4-9L2 9z M11 13 22 2",
  reply: "m9 4-6 6 6 6 M3 10h10a7 7 0 0 1 7 7v3",
  pin: "m16 3 5 5-4 1-3 5 1 3-8-8 3 1 5-3z M8 16l-5 5",
  heart: "M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-5 5 8 15 8 15S25 10 20 5",
  paperclip: "m8 12 7-7a4 4 0 0 1 6 6L10 22a6 6 0 0 1-8-8L13 3 M6 16l10-10",
  shield: "m12 2 9 4v7c0 5-9 9-9 9s-9-4-9-9V6z m-4 10 3 3 5-6",
  sun: "M12 1v2 M12 21v2 M1 12h2 M21 12h2 M4 4l2 2 M18 18l2 2 M4 20l2-2 M18 6l2-2 M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0",
  moon: "M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10",
  cursor: "m4 2 16 11-8 1-4 8z",
  hand: "M8 12V5a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-6a2 2 0 0 1 4 0v10c0 8-12 10-15 2l-3-6a2 2 0 0 1 3-2l3 3",
  pen: "m3 21 3-8L17 2l5 5-11 11z M14 5l5 5 M6 13l5 5",
  rect: "M3 3h18v18H3z",
  circle: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  ellipse: "M21 12a9 6 0 1 1-18 0 9 6 0 0 1 18 0",
  text: "M4 4h16 M12 4v16 M8 20h8",
  sticky: "M3 3h18v12l-6 6H3z M15 21v-6h6",
  eraser: "m3 14 10-11 8 8-10 10H8z M8 9l8 8 M13 21h9",
  frame: "M5 1v22 M19 1v22 M1 5h22 M1 19h22",
  undo: "m8 3-5 5 5 5 M3 8h10a8 8 0 0 1 0 16",
  redo: "m16 3 5 5-5 5 M21 8H11a8 8 0 0 0 0 16",
  minus: "M5 12h14",
  layers: "m12 2 10 5-10 5L2 7z M2 12l10 5 10-5 M2 17l10 5 10-5",
  copy: "M8 8h13v13H8z M16 4V2H2v14h2",
  align: "M12 2v20 M5 5h14v5H5z M8 14h8v5H8z",
  refresh: "M21 3v6h-6 M3 21v-6h6 M21 9a9 9 0 0 0-16-4 M3 15a9 9 0 0 0 16 4",
  code: "m8 5-7 7 7 7 M16 5l7 7-7 7 M14 2l-4 20",
  drag: "M8 5h.01 M16 5h.01 M8 12h.01 M16 12h.01 M8 19h.01 M16 19h.01",
};

export function Icon({
  name,
  size = 18,
  className = "",
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      <path d={paths[name] || paths.grid} />
    </svg>
  );
}
