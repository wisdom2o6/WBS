export interface Shape {
  id: string;
  type:
    | "RECTANGLE"
    | "CIRCLE"
    | "ELLIPSE"
    | "FREEHAND"
    | "STICKY_NOTE"
    | "TEXT"
    | "ARROW"
    | "IMAGE"
    | "LINE";
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radius?: number;
  radiusX?: number;
  radiusY?: number;
  points?: number[];
  text?: string;
  imageUrl?: string;
  color: string;
  strokeWidth?: number;
  name?: string;
  kind?: "frame" | "section" | "connector";
  hidden?: boolean;
  locked?: boolean;
  rotation?: number;
  opacity?: number;
  fill?: string;
  order?: number;
  fontSize?: number;
  groupId?: string;
  /** Text and sticky-note typography (new optional metadata). */
  fontFamily?: string;
  fontStyle?: "normal" | "bold" | "italic" | "bold italic";
  align?: "left" | "center" | "right";
  textColor?: string;
  /** Image fit inside its box. */
  fit?: "stretch" | "contain" | "cover";
}
export type Tool =
  | "SELECT"
  | "HAND"
  | "FREEHAND"
  | "RECTANGLE"
  | "CIRCLE"
  | "ELLIPSE"
  | "STICKY_NOTE"
  | "TEXT"
  | "ARROW"
  | "ERASER"
  | "LINE"
  | "FRAME"
  | "SECTION"
  | "CONNECTOR";
export type AlignMode =
  | "left"
  | "center"
  | "right"
  | "top"
  | "middle"
  | "bottom"
  | "distribute-h"
  | "distribute-v";

/** Canvas grid spacing in canvas units; also used for snap. */
export const GRID = 18;
/** Stroke colors drawn from the WBS tokens (ink, accent, success, warning, danger, muted). */
export const STROKE_COLORS = [
  "#20221f",
  "#2455d6",
  "#39755b",
  "#b98236",
  "#b4473f",
  "#74766f",
];
/** Sticky-note paper tones derived from the existing avatar / board palette. */
export const NOTE_COLORS = [
  { name: "Sage", value: "#e8ebcc" },
  { name: "Sand", value: "#f1e2c4" },
  { name: "Mist", value: "#dde5f0" },
  { name: "Clay", value: "#efd9d0" },
  { name: "Mint", value: "#d8e8dc" },
  { name: "Linen", value: "#f3f1ea" },
];
export const STROKE_WIDTHS = [2, 4, 8];
export const FONT_FAMILIES = [
  { label: "IBM Plex Sans", value: "IBM Plex Sans, sans-serif" },
  { label: "Space Grotesk", value: "Space Grotesk, sans-serif" },
  { label: "IBM Plex Mono", value: "IBM Plex Mono, monospace" },
];
export const DRAW_TOOLS: Tool[] = [
  "FREEHAND",
  "RECTANGLE",
  "CIRCLE",
  "ELLIPSE",
  "LINE",
  "ARROW",
  "CONNECTOR",
];
export const SHAPE_TOOLS: { id: Tool; icon: string; label: string }[] = [
  { id: "RECTANGLE", icon: "rect", label: "Rectangle (R)" },
  { id: "CIRCLE", icon: "circle", label: "Circle (O)" },
  { id: "ELLIPSE", icon: "ellipse", label: "Ellipse" },
  { id: "LINE", icon: "minus", label: "Line (L)" },
  { id: "ARROW", icon: "diagonal", label: "Arrow (A)" },
  { id: "CONNECTOR", icon: "connector", label: "Connector (manual endpoints)" },
];
export const PLANNED_TOOLS = [
  {
    icon: "table",
    label: "Table",
    detail: "Structured rows and columns on the canvas.",
  },
  {
    icon: "connector",
    label: "Smart connectors",
    detail: "Connectors that attach to and follow objects.",
  },
  {
    icon: "template",
    label: "Template library",
    detail: "Start from retrospectives, journeys and roadmaps.",
  },
];
export function shapeLabel(s: Shape) {
  return (
    s.name ||
    (s.kind
      ? s.kind[0].toUpperCase() + s.kind.slice(1)
      : s.type === "STICKY_NOTE"
        ? "Sticky note"
        : s.type === "FREEHAND"
          ? "Drawing"
          : s.type[0] + s.type.slice(1).toLowerCase())
  );
}
export function shapeIcon(s: Shape) {
  if (s.kind === "frame") return "frame";
  if (s.kind === "section") return "section";
  if (s.kind === "connector") return "connector";
  return (
    {
      TEXT: "text",
      IMAGE: "image",
      STICKY_NOTE: "sticky",
      FREEHAND: "pen",
      CIRCLE: "circle",
      ELLIPSE: "ellipse",
      LINE: "minus",
      ARROW: "diagonal",
      RECTANGLE: "rect",
    } as Record<Shape["type"], string>
  )[s.type];
}
export interface CanvasPrefs {
  grid: boolean;
  snap: boolean;
  layers: boolean;
}
export function readCanvasPrefs(): CanvasPrefs {
  try {
    return {
      grid: true,
      snap: false,
      layers: window.innerWidth > 1000,
      ...JSON.parse(localStorage.getItem("wbs:canvas-prefs") || "{}"),
    };
  } catch {
    return { grid: true, snap: false, layers: window.innerWidth > 1000 };
  }
}
export function writeCanvasPrefs(prefs: Partial<CanvasPrefs>) {
  localStorage.setItem(
    "wbs:canvas-prefs",
    JSON.stringify({ ...readCanvasPrefs(), ...prefs }),
  );
}
