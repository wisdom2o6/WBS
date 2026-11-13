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
  "arrow-up": "M12 19V5 m-6 6 6-6 6 6",
  "arrow-down": "M12 5v14 m-6-6 6 6 6-6",
  unlock: "M5 10h14v12H5z M8 10V6a4 4 0 0 1 7.5-2 M12 15v3",
  "align-left": "M4 3v18 M8 6h11v5H8z M8 14h6v4H8z",
  "align-center": "M12 3v18 M6 6h12v5H6z M8 14h8v4H8z",
  "align-right": "M20 3v18 M5 6h11v5H5z M10 14h6v4h-6z",
  "align-top": "M3 4h18 M6 8h5v11H6z M14 8h4v6h-4z",
  "align-middle": "M3 12h18 M6 6h5v12H6z M14 8h4v8h-4z",
  "align-bottom": "M3 20h18 M6 5h5v11H6z M14 10h4v6h-4z",
  "distribute-h": "M4 3v18 M20 3v18 M10 7h4v10h-4z",
  "distribute-v": "M3 4h18 M3 20h18 M7 10h10v4H7z",
  fit: "M3 8V3h5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5 M8 8h8v8H8z",
  magnet: "M5 3v8a7 7 0 0 0 14 0V3h-4v8a3 3 0 0 1-6 0V3z M5 7h4 M15 7h4",
  table: "M3 4h18v16H3z M3 10h18 M3 15h18 M9 4v16",
  template: "M3 3h18v6H3z M3 13h8v8H3z M15 13h6v8h-6z",
  group:
    "M3 7V3h4 M17 3h4v4 M21 17v4h-4 M7 21H3v-4 M7 7h6v6H7z M11 11h6v6h-6z",
  ungroup: "M3 3h7v7H3z M14 14h7v7h-7z",
  "bring-front": "M9 9h12v12H9z M5 15H3V3h12v2",
  "send-back": "M3 3h12v12H3z M19 9h2v12H9v-2",
  bold: "M7 4h6a4 4 0 0 1 0 8H7z M7 12h7a4 4 0 0 1 0 8H7z",
  italic: "M10 4h9 M5 20h9 M15 4 9 20",
  strike: "M4 12h16 M16 7c-1-2-3-3-5-3-3 0-4 2-4 3 M8 17c1 2 3 3 5 3 3 0 4-2 4-3",
  quote: "M3 20c3 0 6-2 6-8V5H3v7h4 M14 20c3 0 6-2 6-8V5h-6v7h4",
  heading: "M6 4v16 M18 4v16 M6 12h12",
  "list-ordered":
    "M10 6h11 M10 12h11 M10 18h11 M4 4h1v5 M3 9h3 M3 14h3l-3 4h3",
  checkbox: "M3 3h18v18H3z m4 9 3 3 7-7",
  divider: "M3 12h18 M8 6h8 M8 18h8",
  "wifi-off":
    "m2 2 20 20 M8.5 16.5a5 5 0 0 1 7 0 M5 12.5a10 10 0 0 1 5-2.7 M19 12.5a10 10 0 0 0-2-1.6 M2 8.8a15 15 0 0 1 4-2.5 M22 8.8A15 15 0 0 0 11 5 M12 20h.01",
  alert: "M12 3 2 21h20z M12 10v5 M12 18h.01",
  "cloud-check":
    "M7 19a5 5 0 1 1 1-9.9A6 6 0 0 1 19 11a4 4 0 0 1-1 8z m2-5 2 2 4-4",
  at: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8",
  storage: "M2 13h20v7H2z M5 13 8 4h8l3 9 M6 17h.01 M10 17h.01",
  video: "M2 6h14v12H2z M16 10l6-4v12l-6-4",
  connector: "M3 3h6v6H3z M15 15h6v6h-6z M9 6h3a3 3 0 0 1 3 3v6",
  section:
    "M3 7V3h4 M17 3h4v4 M21 17v4h-4 M7 21H3v-4 M3 11v2 M21 11v2 M11 3h2 M11 21h2",
  move: "M12 2v20 M2 12h20 m-3-3 3 3-3 3 M5 9l-3 3 3 3 M9 5l3-3 3 3 M9 19l3 3 3-3",
  flag: "M4 22V3 M4 4h13l-2 4 2 4H4",
  "panel-right": "M3 3h18v18H3z M15 3v18",
  inbox: "M3 13h5l2 3h4l2-3h5 M3 13 6 4h12l3 9v7H3z",
  history: "M3 12a9 9 0 1 0 3-6.7 M3 3v5h5 M12 7v5l3 2",
  "text-left": "M3 6h18 M3 12h12 M3 18h16",
  "text-center": "M3 6h18 M6 12h12 M4 18h16",
  "text-right": "M3 6h18 M9 12h12 M5 18h16",
  palette:
    "M12 3a9 9 0 0 0 0 18c1 0 2-1 2-2s-1-2 0-3h3a4 4 0 0 0 4-4c0-5-4-9-9-9 M7 12h.01 M9 8h.01 M14 7h.01 M17 11h.01",
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
