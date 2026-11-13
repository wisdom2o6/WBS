import { useState } from "react";
import type { ReactNode } from "react";
import { Badge, Button, IconButton } from "../../components/ui";
import { Icon } from "../../components/Icon";
import { SearchField } from "../../components/patterns";
import type { Shape } from "./types";
import { shapeIcon, shapeLabel } from "./types";

export function CanvasLayers({
  shapes,
  selectedIds,
  readOnly,
  onSelect,
  onSelectGroup,
  onToggle,
  onMove,
  onGroup,
  onUngroup,
  canGroup,
  canUngroup,
  onClose,
}: {
  /** Shapes in ascending z-order. */
  shapes: Shape[];
  selectedIds: string[];
  readOnly: boolean;
  onSelect: (id: string, additive: boolean) => void;
  onSelectGroup: (groupId: string) => void;
  onToggle: (shape: Shape, key: "hidden" | "locked") => void;
  onMove: (dragId: string, targetId: string, after: boolean) => void;
  onGroup: () => void;
  onUngroup: () => void;
  canGroup: boolean;
  canUngroup: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [drag, setDrag] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; after: boolean } | null>(
    null,
  );
  const top = shapes.toReversed();
  const filtered = query
    ? top.filter((s) =>
        shapeLabel(s).toLowerCase().includes(query.toLowerCase()),
      )
    : top;
  const row = (s: Shape, nested = false) => {
    const active = selectedIds.includes(s.id);
    return (
      <div
        key={s.id}
        className={`canvas-layer-row ${active ? "active" : ""} ${s.hidden ? "layer-hidden" : ""} ${nested ? "nested" : ""} ${drop?.id === s.id ? (drop.after ? "drop-after" : "drop-before") : ""} ${drag === s.id ? "dragging" : ""}`}
        draggable={!readOnly && !query}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", s.id);
          e.dataTransfer.effectAllowed = "move";
          setDrag(s.id);
        }}
        onDragOver={(e) => {
          if (!drag || drag === s.id) return;
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          setDrop({ id: s.id, after: e.clientY > rect.top + rect.height / 2 });
        }}
        onDragLeave={() => setDrop(null)}
        onDrop={(e) => {
          e.preventDefault();
          if (drag && drop) onMove(drag, drop.id, drop.after);
          setDrag(null);
          setDrop(null);
        }}
        onDragEnd={() => {
          setDrag(null);
          setDrop(null);
        }}
      >
        <Button
          variant="ghost"
          aria-pressed={active}
          onClick={(e) => onSelect(s.id, e.shiftKey || e.metaKey)}
        >
          {!readOnly && !query && (
            <span className="layer-grip" aria-hidden="true">
              <Icon name="drag" size={11} />
            </span>
          )}
          <Icon name={shapeIcon(s)} size={13} />
          <span>{shapeLabel(s)}</span>
        </Button>
        {s.locked && readOnly && (
          <span className="layer-lock-indicator" title="Locked">
            <Icon name="lock" size={11} />
          </span>
        )}
        {!readOnly && (
          <>
            <IconButton
              icon={s.hidden ? "eyeoff" : "eye"}
              label={`${s.hidden ? "Show" : "Hide"} layer`}
              className={s.hidden ? "persist" : ""}
              onClick={() => onToggle(s, "hidden")}
            />
            <IconButton
              icon={s.locked ? "lock" : "unlock"}
              label={`${s.locked ? "Unlock" : "Lock"} layer`}
              className={s.locked ? "persist" : ""}
              onClick={() => onToggle(s, "locked")}
            />
          </>
        )}
      </div>
    );
  };
  const items: ReactNode[] = [];
  const seen = new Set<string>();
  for (const s of filtered) {
    if (!s.groupId || query) {
      items.push(row(s));
      continue;
    }
    if (seen.has(s.groupId)) continue;
    seen.add(s.groupId);
    const members = filtered.filter((m) => m.groupId === s.groupId);
    const open = !collapsed.includes(s.groupId);
    const groupActive = members.every((m) => selectedIds.includes(m.id));
    items.push(
      <div
        key={`group-${s.groupId}`}
        className={`canvas-layer-group ${groupActive ? "active" : ""}`}
      >
        <button
          type="button"
          className="layer-group-toggle"
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} group`}
          onClick={() =>
            setCollapsed((prev) =>
              open
                ? [...prev, s.groupId!]
                : prev.filter((g) => g !== s.groupId),
            )
          }
        >
          <Icon name={open ? "down" : "chevron"} size={11} />
        </button>
        <Button variant="ghost" onClick={() => onSelectGroup(s.groupId!)}>
          <Icon name="group" size={13} />
          <span>Group</span>
          <small>{members.length}</small>
        </Button>
      </div>,
    );
    if (open) members.forEach((m) => items.push(row(m, true)));
  }
  return (
    <aside className="canvas-layers" aria-label="Layers">
      <div className="canvas-panel-heading">
        <strong>Layers</strong>
        <Badge>{shapes.length}</Badge>
        <IconButton
          icon="close"
          label="Close layers panel"
          className="panel-close"
          onClick={onClose}
        />
      </div>
      {shapes.length > 6 && (
        <div className="canvas-layer-search">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Find a layer…"
            label="Find a layer"
          />
        </div>
      )}
      <div className="canvas-layer-list">
        {items}
        {!shapes.length && (
          <p className="canvas-layer-empty">
            Objects you add appear here, top to bottom.
          </p>
        )}
        {shapes.length > 0 && !filtered.length && (
          <p className="canvas-layer-empty">No layers match “{query}”.</p>
        )}
      </div>
      <div className="canvas-layer-footer">
        <span>
          {readOnly
            ? "View only · layers cannot be changed"
            : "Drag to reorder · Shift + click to multi-select"}
        </span>
        {!readOnly && (
          <div>
            <Button
              variant="ghost"
              icon="group"
              disabled={!canGroup}
              onClick={onGroup}
            >
              Group
            </Button>
            <Button
              variant="ghost"
              icon="ungroup"
              disabled={!canUngroup}
              onClick={onUngroup}
            >
              Ungroup
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
