import type { ReactNode } from "react";
import {
  Badge,
  Button,
  Field,
  IconButton,
  Input,
  Select,
  Textarea,
} from "../../components/ui";
import { Icon } from "../../components/Icon";
import type { AlignMode, Shape } from "./types";
import {
  FONT_FAMILIES,
  NOTE_COLORS,
  STROKE_COLORS,
  STROKE_WIDTHS,
  shapeIcon,
  shapeLabel,
} from "./types";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="inspector-section">
      <span className="eyebrow">{title}</span>
      {children}
    </section>
  );
}
export function Swatches({
  colors,
  value,
  onChange,
  disabled,
  label,
  custom = true,
}: {
  colors: { name: string; value: string }[] | string[];
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label: string;
  custom?: boolean;
}) {
  const list = colors.map((c) =>
    typeof c === "string" ? { name: c, value: c } : c,
  );
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
      {list.map((c) => (
        <button
          key={c.value}
          type="button"
          role="radio"
          aria-checked={value?.toLowerCase() === c.value.toLowerCase()}
          aria-label={c.name}
          title={c.name}
          disabled={disabled}
          className="swatch"
          style={{ background: c.value }}
          onClick={() => onChange(c.value)}
        />
      ))}
      {custom && (
        <label className="swatch swatch-custom" title="Custom color">
          <Icon name="palette" size={12} />
          <input
            type="color"
            aria-label={`Custom ${label.toLowerCase()}`}
            disabled={disabled}
            value={value?.startsWith("#") ? value.slice(0, 7) : "#20221f"}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      )}
    </div>
  );
}
function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
  label,
}: {
  options: { value: T; label: string; icon?: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div className="inspector-segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          aria-label={o.icon ? o.label : undefined}
          title={o.label}
          disabled={disabled}
          className={value === o.value ? "active" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.icon ? <Icon name={o.icon} size={14} /> : o.label}
        </button>
      ))}
    </div>
  );
}
function Opacity({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <Field label="Opacity">
      <div className="inspector-range">
        <Input
          type="range"
          min="0"
          max="100"
          disabled={disabled}
          value={Math.round(value * 100)}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
        />
        <span>{Math.round(value * 100)}%</span>
      </div>
    </Field>
  );
}
const num = (v: string, min = -100000) => Math.max(min, Number(v) || 0);

export function CanvasInspector({
  selected,
  multiCount,
  readOnly,
  onChange,
  onAlign,
  onReorder,
  onDuplicate,
  onDelete,
  onGroup,
  onUngroup,
  canGroup,
  canUngroup,
  color,
  setColor,
  strokeWidth,
  setStrokeWidth,
  noteColor,
  setNoteColor,
  grid,
  setGrid,
  snap,
  setSnap,
  shapesCount,
  onClear,
  demo,
  onClose,
}: {
  selected?: Shape;
  multiCount: number;
  readOnly: boolean;
  onChange: (patch: Partial<Shape>) => void;
  onAlign: (mode: AlignMode) => void;
  onReorder: (direction: "front" | "forward" | "backward" | "back") => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  canGroup: boolean;
  canUngroup: boolean;
  color: string;
  setColor: (c: string) => void;
  strokeWidth: number;
  setStrokeWidth: (w: number) => void;
  noteColor: string;
  setNoteColor: (c: string) => void;
  grid: boolean;
  setGrid: (v: boolean) => void;
  snap: boolean;
  setSnap: (v: boolean) => void;
  shapesCount: number;
  onClear: () => void;
  demo: boolean;
  onClose: () => void;
}) {
  const s = selected;
  const off = readOnly || !!s?.locked;
  const isShape =
    s && ["RECTANGLE", "CIRCLE", "ELLIPSE"].includes(s.type) && s.kind !== "connector";
  const isStroke = s && ["LINE", "ARROW", "FREEHAND"].includes(s.type);
  const arrange = !readOnly && (
    <Section title="ARRANGE">
      <div className="inspector-icon-row">
        <IconButton
          icon="bring-front"
          label="Bring to front (Shift ])"
          onClick={() => onReorder("front")}
        />
        <IconButton
          icon="arrow-up"
          label="Bring forward (])"
          onClick={() => onReorder("forward")}
        />
        <IconButton
          icon="arrow-down"
          label="Send backward ([)"
          onClick={() => onReorder("backward")}
        />
        <IconButton
          icon="send-back"
          label="Send to back (Shift [)"
          onClick={() => onReorder("back")}
        />
      </div>
      <div className="inspector-arrange">
        <Button icon="copy" onClick={onDuplicate}>
          Duplicate
        </Button>
        <Button icon="trash" disabled={!!s?.locked} onClick={onDelete}>
          Delete
        </Button>
      </div>
    </Section>
  );
  const alignTools = (
    <Section title="ALIGN & DISTRIBUTE">
      <div className="inspector-icon-row">
        {(
          [
            ["left", "align-left", "Align left"],
            ["center", "align-center", "Align horizontal centers"],
            ["right", "align-right", "Align right"],
            ["top", "align-top", "Align top"],
            ["middle", "align-middle", "Align vertical centers"],
            ["bottom", "align-bottom", "Align bottom"],
          ] as const
        ).map(([mode, icon, label]) => (
          <IconButton
            key={mode}
            icon={icon}
            label={label}
            disabled={readOnly || multiCount < 2}
            onClick={() => onAlign(mode)}
          />
        ))}
      </div>
      <div className="inspector-icon-row">
        <IconButton
          icon="distribute-h"
          label="Distribute horizontally"
          disabled={readOnly || multiCount < 3}
          onClick={() => onAlign("distribute-h")}
        />
        <IconButton
          icon="distribute-v"
          label="Distribute vertically"
          disabled={readOnly || multiCount < 3}
          onClick={() => onAlign("distribute-v")}
        />
        <span className="inspector-hint">
          {multiCount < 3 ? "Select 3+ to distribute" : `${multiCount} objects`}
        </span>
      </div>
    </Section>
  );
  return (
    <aside className="canvas-inspector" aria-label="Properties">
      <div className="canvas-panel-heading">
        <strong>Properties</strong>
        {s && !multiCount && (
          <Badge>
            <Icon name={shapeIcon(s)} size={11} />
            {s.kind || s.type.toLowerCase().replace("_", " ")}
          </Badge>
        )}
        <IconButton
          icon="close"
          label="Close properties panel"
          className="panel-close"
          onClick={onClose}
        />
      </div>
      <div className="inspector-content">
        {readOnly && (
          <div className="inspector-readonly">
            <Icon name="eye" size={13} />
            View only. You can inspect but not edit objects.
          </div>
        )}
        {multiCount > 1 ? (
          <>
            <div className="inspector-multi">
              <span>
                <Icon name="layers" size={18} />
              </span>
              <div>
                <strong>{multiCount} objects selected</strong>
                <small>Shift + click to add or remove.</small>
              </div>
            </div>
            {alignTools}
            {!readOnly && (
              <Section title="GROUP">
                <div className="inspector-arrange">
                  <Button icon="group" disabled={!canGroup} onClick={onGroup}>
                    Group
                  </Button>
                  <Button
                    icon="ungroup"
                    disabled={!canUngroup}
                    onClick={onUngroup}
                  >
                    Ungroup
                  </Button>
                </div>
              </Section>
            )}
            {arrange}
          </>
        ) : s ? (
          <>
            <Field label="Layer name">
              <Input
                disabled={off}
                value={s.name ?? shapeLabel(s)}
                onChange={(e) => onChange({ name: e.target.value })}
              />
            </Field>
            {s.locked && !readOnly && (
              <div className="inspector-locked">
                <Icon name="lock" size={13} />
                Locked
                <Button variant="ghost" onClick={() => onChange({ locked: false })}>
                  Unlock
                </Button>
              </div>
            )}
            <Section title="LAYOUT">
              <div className="inspector-two-col">
                <Field label="X">
                  <Input
                    type="number"
                    value={Math.round(s.x || 0)}
                    disabled={off}
                    onChange={(e) => onChange({ x: num(e.target.value) })}
                  />
                </Field>
                <Field label="Y">
                  <Input
                    type="number"
                    value={Math.round(s.y || 0)}
                    disabled={off}
                    onChange={(e) => onChange({ y: num(e.target.value) })}
                  />
                </Field>
                {s.type === "CIRCLE" ? (
                  <Field label="Radius">
                    <Input
                      type="number"
                      min="1"
                      disabled={off}
                      value={Math.round(s.radius || 0)}
                      onChange={(e) => onChange({ radius: num(e.target.value, 1) })}
                    />
                  </Field>
                ) : s.type === "ELLIPSE" ? (
                  <>
                    <Field label="W">
                      <Input
                        type="number"
                        min="1"
                        disabled={off}
                        value={Math.round((s.radiusX || 0) * 2)}
                        onChange={(e) =>
                          onChange({ radiusX: num(e.target.value, 2) / 2 })
                        }
                      />
                    </Field>
                    <Field label="H">
                      <Input
                        type="number"
                        min="1"
                        disabled={off}
                        value={Math.round((s.radiusY || 0) * 2)}
                        onChange={(e) =>
                          onChange({ radiusY: num(e.target.value, 2) / 2 })
                        }
                      />
                    </Field>
                  </>
                ) : (
                  s.width !== undefined && (
                    <>
                      <Field label="W">
                        <Input
                          type="number"
                          min="1"
                          disabled={off}
                          value={Math.round(s.width)}
                          onChange={(e) =>
                            onChange({ width: num(e.target.value, 1) })
                          }
                        />
                      </Field>
                      {s.height !== undefined && (
                        <Field label="H">
                          <Input
                            type="number"
                            min="1"
                            disabled={off}
                            value={Math.round(s.height)}
                            onChange={(e) =>
                              onChange({ height: num(e.target.value, 1) })
                            }
                          />
                        </Field>
                      )}
                    </>
                  )
                )}
                <Field label="Rotation">
                  <Input
                    type="number"
                    disabled={off}
                    value={Math.round(s.rotation || 0)}
                    onChange={(e) => onChange({ rotation: num(e.target.value) })}
                  />
                </Field>
              </div>
            </Section>
            {isShape && (
              <Section title={s.kind ? s.kind.toUpperCase() : "FILL & BORDER"}>
                <Field label="Fill">
                  <Swatches
                    label="Fill color"
                    colors={["#fffefb", ...NOTE_COLORS.map((c) => c.value).slice(0, 4), "#20221f"]}
                    value={s.fill}
                    disabled={off}
                    onChange={(fill) => onChange({ fill })}
                  />
                </Field>
                <Field label="Border color">
                  <Swatches
                    label="Border color"
                    colors={STROKE_COLORS}
                    value={s.color}
                    disabled={off}
                    onChange={(c) => onChange({ color: c })}
                  />
                </Field>
                <Field label="Border width">
                  <div className="inspector-range">
                    <Input
                      type="range"
                      min="0"
                      max="20"
                      disabled={off}
                      value={s.strokeWidth ?? 2}
                      onChange={(e) =>
                        onChange({ strokeWidth: Number(e.target.value) })
                      }
                    />
                    <span>{s.strokeWidth ?? 2}px</span>
                  </div>
                </Field>
                <Opacity
                  value={s.opacity ?? 1}
                  disabled={off}
                  onChange={(opacity) => onChange({ opacity })}
                />
              </Section>
            )}
            {isStroke && (
              <Section title="STROKE">
                <Field label="Color">
                  <Swatches
                    label="Stroke color"
                    colors={STROKE_COLORS}
                    value={s.color}
                    disabled={off}
                    onChange={(c) => onChange({ color: c })}
                  />
                </Field>
                <Field label="Width">
                  <div className="inspector-range">
                    <Input
                      type="range"
                      min="1"
                      max="30"
                      disabled={off}
                      value={s.strokeWidth ?? 3}
                      onChange={(e) =>
                        onChange({ strokeWidth: Number(e.target.value) })
                      }
                    />
                    <span>{s.strokeWidth ?? 3}px</span>
                  </div>
                </Field>
                <Opacity
                  value={s.opacity ?? 1}
                  disabled={off}
                  onChange={(opacity) => onChange({ opacity })}
                />
                {s.kind === "connector" && (
                  <p className="inspector-hint">
                    Manual connector. Attaching to objects is planned.
                  </p>
                )}
              </Section>
            )}
            {s.type === "STICKY_NOTE" && (
              <Section title="NOTE">
                <Field label="Background">
                  <Swatches
                    label="Note color"
                    colors={NOTE_COLORS}
                    value={s.fill || s.color}
                    disabled={off}
                    onChange={(c) => onChange({ fill: c, color: c })}
                  />
                </Field>
              </Section>
            )}
            {(s.type === "TEXT" || s.type === "STICKY_NOTE") && (
              <Section title="TEXT">
                <Field label="Content">
                  <Textarea
                    rows={3}
                    disabled={off}
                    value={s.text || ""}
                    onChange={(e) => onChange({ text: e.target.value })}
                  />
                </Field>
                <Field label="Font">
                  <Select
                    disabled={off}
                    value={s.fontFamily || FONT_FAMILIES[0].value}
                    onChange={(e) => onChange({ fontFamily: e.target.value })}
                  >
                    {FONT_FAMILIES.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="inspector-two-col">
                  <Field label="Size">
                    <Input
                      type="number"
                      min="6"
                      max="300"
                      disabled={off}
                      value={Math.round(
                        s.fontSize || (s.type === "TEXT" ? 18 : 14),
                      )}
                      onChange={(e) =>
                        onChange({ fontSize: num(e.target.value, 6) })
                      }
                    />
                  </Field>
                  <Field label="Weight">
                    <Select
                      disabled={off}
                      value={s.fontStyle || "normal"}
                      onChange={(e) =>
                        onChange({
                          fontStyle: e.target.value as Shape["fontStyle"],
                        })
                      }
                    >
                      <option value="normal">Regular</option>
                      <option value="bold">Bold</option>
                      <option value="italic">Italic</option>
                      <option value="bold italic">Bold italic</option>
                    </Select>
                  </Field>
                </div>
                <Field label="Alignment">
                  <Segmented
                    label="Text alignment"
                    disabled={off}
                    value={s.align || "left"}
                    onChange={(align) => onChange({ align })}
                    options={[
                      { value: "left", label: "Align left", icon: "text-left" },
                      {
                        value: "center",
                        label: "Align center",
                        icon: "text-center",
                      },
                      {
                        value: "right",
                        label: "Align right",
                        icon: "text-right",
                      },
                    ]}
                  />
                </Field>
                <Field label="Text color">
                  <Swatches
                    label="Text color"
                    colors={
                      s.type === "STICKY_NOTE"
                        ? ["#4b543e", ...STROKE_COLORS.slice(0, 5)]
                        : STROKE_COLORS
                    }
                    value={
                      s.type === "STICKY_NOTE"
                        ? s.textColor || "#4b543e"
                        : s.color
                    }
                    disabled={off}
                    onChange={(c) =>
                      onChange(
                        s.type === "STICKY_NOTE" ? { textColor: c } : { color: c },
                      )
                    }
                  />
                </Field>
                {s.type === "TEXT" && (
                  <Opacity
                    value={s.opacity ?? 1}
                    disabled={off}
                    onChange={(opacity) => onChange({ opacity })}
                  />
                )}
                {!readOnly && (
                  <p className="inspector-hint">Double-click on canvas to edit text.</p>
                )}
              </Section>
            )}
            {s.type === "IMAGE" && (
              <Section title="IMAGE">
                <Field label="Fit">
                  <Segmented
                    label="Image fit"
                    disabled={off}
                    value={s.fit || "stretch"}
                    onChange={(fit) => onChange({ fit })}
                    options={[
                      { value: "stretch", label: "Stretch" },
                      { value: "contain", label: "Fit" },
                      { value: "cover", label: "Fill" },
                    ]}
                  />
                </Field>
                <Opacity
                  value={s.opacity ?? 1}
                  disabled={off}
                  onChange={(opacity) => onChange({ opacity })}
                />
              </Section>
            )}
            {s.groupId && (
              <div className="inspector-group-note">
                <Icon name="group" size={13} />
                Part of a group
                {!readOnly && (
                  <Button variant="ghost" onClick={onUngroup}>
                    Ungroup
                  </Button>
                )}
              </div>
            )}
            {arrange}
          </>
        ) : (
          <>
            <span className="inspector-empty-icon">
              <Icon name="cursor" size={25} />
            </span>
            <strong className="inspector-empty-title">
              {readOnly ? "Nothing selected." : "A little room to create."}
            </strong>
            <p className="inspector-hint">
              {readOnly
                ? "Select an object to inspect its properties."
                : "Select an object to adjust its properties, or choose a tool to begin."}
            </p>
            {!readOnly && (
              <Section title="DRAWING DEFAULTS">
                <Field label="Stroke color">
                  <Swatches
                    label="Drawing color"
                    colors={STROKE_COLORS}
                    value={color}
                    onChange={setColor}
                  />
                </Field>
                <Field label="Stroke width">
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
                    <span>{strokeWidth}px</span>
                  </div>
                </Field>
                <Field label="Sticky note color">
                  <Swatches
                    label="Default note color"
                    colors={NOTE_COLORS}
                    value={noteColor}
                    onChange={setNoteColor}
                    custom={false}
                  />
                </Field>
              </Section>
            )}
            <Section title="CANVAS">
              <label className="inspector-toggle">
                <Input
                  type="checkbox"
                  checked={grid}
                  onChange={(e) => setGrid(e.target.checked)}
                />
                <span>Show grid</span>
                <kbd>⇧ G</kbd>
              </label>
              <label className="inspector-toggle">
                <Input
                  type="checkbox"
                  checked={snap}
                  disabled={readOnly}
                  onChange={(e) => setSnap(e.target.checked)}
                />
                <span>Snap to grid</span>
                <kbd>⇧ S</kbd>
              </label>
            </Section>
            <Section title="SHORTCUTS">
              <dl className="inspector-shortcuts">
                <dt>Pan</dt>
                <dd>Space + drag</dd>
                <dt>Zoom</dt>
                <dd>Scroll</dd>
                <dt>Fit to screen</dt>
                <dd>⇧ 1</dd>
                <dt>Multi-select</dt>
                <dd>⇧ click</dd>
                {!readOnly && (
                  <>
                    <dt>Duplicate</dt>
                    <dd>⌘ D</dd>
                    <dt>Group</dt>
                    <dd>⌘ G</dd>
                    <dt>Undo</dt>
                    <dd>⌘ Z</dd>
                    <dt>Nudge</dt>
                    <dd>Arrows</dd>
                  </>
                )}
              </dl>
            </Section>
            {!readOnly && (
              <Button
                variant="ghost"
                icon="trash"
                className="inspector-danger"
                disabled={!shapesCount}
                onClick={onClear}
              >
                Clear canvas
              </Button>
            )}
          </>
        )}
        <div className="inspector-integration-note">
          <Icon name={demo ? "info" : "shield"} size={13} />
          <p>
            {demo
              ? "Demo canvas. All drawing is local to this browser session."
              : "Drawing events use your existing STOMP persistence. Server receipt is not a database-save guarantee."}
          </p>
        </div>
      </div>
    </aside>
  );
}
