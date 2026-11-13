import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "../../components/ui";
import { Icon } from "../../components/Icon";
import { PlannedBadge } from "../../components/patterns";
import type { Tool } from "./types";
import {
  DRAW_TOOLS,
  NOTE_COLORS,
  PLANNED_TOOLS,
  SHAPE_TOOLS,
  STROKE_COLORS,
  STROKE_WIDTHS,
} from "./types";
import { Swatches } from "./CanvasInspector";

type Flyout = { kind: "shapes" | "more"; rect: DOMRect } | null;

export function CanvasToolRail({
  tool,
  setTool,
  shapeTool,
  setShapeTool,
  readOnly,
  onUpload,
  onLibrary,
}: {
  tool: Tool;
  setTool: (t: Tool) => void;
  shapeTool: Tool;
  setShapeTool: (t: Tool) => void;
  readOnly: boolean;
  onUpload: () => void;
  onLibrary: () => void;
}) {
  const [flyout, setFlyout] = useState<Flyout>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!flyout) return;
    const close = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node)) setFlyout(null);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setFlyout(null);
    setTimeout(() => document.addEventListener("mousedown", close));
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [flyout]);
  const btn = (id: Tool, icon: string, label: string) => (
    <IconButton
      key={id}
      icon={icon}
      label={label}
      aria-pressed={tool === id}
      className={tool === id ? "active" : ""}
      onClick={() => setTool(id)}
    />
  );
  const shape = SHAPE_TOOLS.find((t) => t.id === shapeTool) || SHAPE_TOOLS[0];
  const shapeActive = SHAPE_TOOLS.some((t) => t.id === tool);
  const open = (kind: "shapes" | "more", el: HTMLElement) =>
    setFlyout((f) =>
      f?.kind === kind ? null : { kind, rect: el.getBoundingClientRect() },
    );
  const position = (rect: DOMRect): CSSProperties =>
    window.innerWidth < 560
      ? {
          left: Math.max(8, Math.min(rect.left - 60, window.innerWidth - 268)),
          bottom: window.innerHeight - rect.top + 8,
        }
      : { left: rect.right + 8, top: Math.min(rect.top, window.innerHeight - 260) };
  return (
    <>
      <div
        className={`canvas-tool-rail ${readOnly ? "read-only" : ""}`}
        role="toolbar"
        aria-label="Canvas tools"
      >
        {btn("SELECT", "cursor", "Select (V)")}
        {btn("HAND", "hand", "Hand / pan (H)")}
        {readOnly ? (
          <span className="rail-readonly" title="View only">
            <Icon name="eye" size={14} />
          </span>
        ) : (
          <>
            <span className="rail-divider" />
            {btn("FREEHAND", "pen", "Pen (P)")}
            {btn("ERASER", "eraser", "Eraser (E)")}
            <span className="rail-divider" />
            <div className="rail-flyout-trigger">
              <IconButton
                icon={shape.icon}
                label={shape.label}
                aria-pressed={shapeActive}
                aria-haspopup="menu"
                aria-expanded={flyout?.kind === "shapes"}
                className={shapeActive ? "active" : ""}
                onClick={(e) => {
                  setTool(shape.id);
                  open("shapes", e.currentTarget);
                }}
              />
              <i aria-hidden="true" />
            </div>
            {btn("TEXT", "text", "Text (T)")}
            {btn("STICKY_NOTE", "sticky", "Sticky note (S)")}
            <span className="rail-divider" />
            {btn("FRAME", "frame", "Frame (F)")}
            {btn("SECTION", "section", "Section")}
            <span className="rail-divider" />
            <IconButton icon="image" label="Upload image" onClick={onUpload} />
            <IconButton
              icon="folder"
              label="Insert from media library"
              onClick={onLibrary}
            />
            <span className="rail-divider" />
            <IconButton
              icon="template"
              label="More tools (planned)"
              aria-haspopup="menu"
              aria-expanded={flyout?.kind === "more"}
              className="rail-more"
              onClick={(e) => open("more", e.currentTarget)}
            />
          </>
        )}
      </div>
      {flyout &&
        createPortal(
          <div
            ref={panel}
            className={`canvas-flyout flyout-${flyout.kind}`}
            role="menu"
            style={position(flyout.rect)}
          >
            {flyout.kind === "shapes" ? (
              <>
                <span className="menu-label">SHAPES & LINES</span>
                <div className="canvas-flyout-grid">
                  {SHAPE_TOOLS.map((t) => (
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={tool === t.id}
                      key={t.id}
                      className={tool === t.id ? "active" : ""}
                      onClick={() => {
                        setShapeTool(t.id);
                        setTool(t.id);
                        setFlyout(null);
                      }}
                    >
                      <Icon name={t.icon} size={17} />
                      <span>{t.label.replace(/ \(.+\)$/, "")}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <span className="menu-label">COMING NEXT</span>
                {PLANNED_TOOLS.map((t) => (
                  <div className="canvas-planned-item" key={t.label}>
                    <span className="canvas-planned-icon">
                      <Icon name={t.icon} size={16} />
                    </span>
                    <span>
                      <strong>{t.label}</strong>
                      <small>{t.detail}</small>
                    </span>
                    <PlannedBadge />
                  </div>
                ))}
                <p className="canvas-flyout-note">
                  Planned tools are designed but not implemented yet.
                </p>
              </>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

const toolNames: Partial<Record<Tool, string>> = {
  FREEHAND: "Pen",
  RECTANGLE: "Rectangle",
  CIRCLE: "Circle",
  ELLIPSE: "Ellipse",
  LINE: "Line",
  ARROW: "Arrow",
  CONNECTOR: "Connector",
  TEXT: "Text",
  STICKY_NOTE: "Sticky note",
  ERASER: "Eraser",
  FRAME: "Frame",
  SECTION: "Section",
};
/** Floating, contextual options for the active creation tool. */
export function CanvasToolOptions({
  tool,
  color,
  setColor,
  strokeWidth,
  setStrokeWidth,
  noteColor,
  setNoteColor,
}: {
  tool: Tool;
  color: string;
  setColor: (c: string) => void;
  strokeWidth: number;
  setStrokeWidth: (w: number) => void;
  noteColor: string;
  setNoteColor: (c: string) => void;
}) {
  const name = toolNames[tool];
  if (!name) return null;
  return (
    <div className="canvas-tool-options" role="toolbar" aria-label={`${name} options`}>
      <strong>{name}</strong>
      <span className="toolbar-divider" />
      {DRAW_TOOLS.includes(tool) && (
        <>
          <Swatches
            label="Stroke color"
            colors={STROKE_COLORS}
            value={color}
            onChange={setColor}
          />
          <span className="toolbar-divider" />
          <div className="inspector-width-presets">
            {STROKE_WIDTHS.map((w) => (
              <button
                type="button"
                key={w}
                aria-label={`${w}px stroke`}
                aria-pressed={strokeWidth === w}
                className={strokeWidth === w ? "active" : ""}
                onClick={() => setStrokeWidth(w)}
              >
                <i style={{ height: Math.max(1, w / 1.5) }} />
              </button>
            ))}
          </div>
        </>
      )}
      {tool === "TEXT" && (
        <>
          <Swatches
            label="Text color"
            colors={STROKE_COLORS}
            value={color}
            onChange={setColor}
          />
          <span className="tool-options-hint">Click to place text</span>
        </>
      )}
      {tool === "STICKY_NOTE" && (
        <>
          <Swatches
            label="Note color"
            colors={NOTE_COLORS}
            value={noteColor}
            onChange={setNoteColor}
            custom={false}
          />
          <span className="tool-options-hint">Click to place a note</span>
        </>
      )}
      {tool === "ERASER" && (
        <span className="tool-options-hint">
          Click or drag across objects to erase. Locked layers are protected.
        </span>
      )}
      {(tool === "FRAME" || tool === "SECTION") && (
        <span className="tool-options-hint">
          Drag to draw. {tool === "FRAME" ? "Frames" : "Sections"} organize
          visually; they don’t clip content.
        </span>
      )}
    </div>
  );
}
