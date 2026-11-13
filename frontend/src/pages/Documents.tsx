import { Fragment, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useWorkspace } from "../context/WorkspaceContext";
import {
  Avatar,
  Badge,
  Button,
  Confirm,
  Dropdown,
  EmptyState,
  Field,
  Heading,
  IconButton,
  Input,
  Modal,
  Notice,
  Select,
  Textarea,
  useToast,
} from "../components/ui";
import { Icon } from "../components/Icon";
import {
  Breadcrumbs,
  MenuDivider,
  MenuItem,
  PermissionNote,
  Presence,
  SearchField,
  StatusIndicator,
} from "../components/patterns";
import type { SyncState } from "../components/patterns";
import type { Block, BlockKind, Document } from "../types/workspace";

const API_BASE = "http://localhost:8080/api/v1";
const WS_URL = "http://localhost:8080/ws-visual-workspace";
const TAB_CLIENT_ID = crypto.randomUUID();
const authHeaders = () => {
  const token =
    localStorage.getItem("accessToken") ||
    sessionStorage.getItem("accessToken");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const blockTypes: {
  kind: BlockKind;
  label: string;
  icon: string;
  hint: string;
  group: "Text" | "Lists" | "Media" | "Structure";
}[] = [
  { kind: "paragraph", label: "Paragraph", icon: "text-left", hint: "Plain text", group: "Text" },
  { kind: "heading1", label: "Heading 1", icon: "heading", hint: "Large section title", group: "Text" },
  { kind: "heading2", label: "Heading 2", icon: "heading", hint: "Medium heading", group: "Text" },
  { kind: "heading3", label: "Heading 3", icon: "heading", hint: "Small heading", group: "Text" },
  { kind: "quote", label: "Quote", icon: "quote", hint: "Call out a thought", group: "Text" },
  { kind: "bullet", label: "Bullet list", icon: "list", hint: "Simple bulleted item", group: "Lists" },
  { kind: "numbered", label: "Numbered list", icon: "list-ordered", hint: "Ordered steps", group: "Lists" },
  { kind: "checklist", label: "Checklist", icon: "checkbox", hint: "Track a to-do", group: "Lists" },
  { kind: "code", label: "Code block", icon: "code", hint: "Monospaced snippet", group: "Structure" },
  { kind: "table", label: "Table", icon: "table", hint: "Rows and columns", group: "Structure" },
  { kind: "divider", label: "Divider", icon: "divider", hint: "Separate sections", group: "Structure" },
  { kind: "image", label: "Image", icon: "image", hint: "From URL or media library", group: "Media" },
  { kind: "canvas", label: "Canvas embed", icon: "frame", hint: "Reference a room canvas", group: "Media" },
];
const blockName = (k: BlockKind) =>
  blockTypes.find((b) => b.kind === k)?.label || k;
const TEXT_KINDS: BlockKind[] = [
  "paragraph",
  "heading1",
  "heading2",
  "heading3",
  "bullet",
  "numbered",
  "checklist",
  "quote",
  "code",
];

function toMarkdown(doc: Document) {
  let n = 0;
  const lines = doc.blocks.map((b) => {
    if (b.kind !== "numbered") n = 0;
    switch (b.kind) {
      case "heading1":
        return `# ${b.text}`;
      case "heading2":
        return `## ${b.text}`;
      case "heading3":
        return `### ${b.text}`;
      case "bullet":
        return `- ${b.text}`;
      case "numbered":
        return `${++n}. ${b.text}`;
      case "checklist":
        return `- [${b.checked ? "x" : " "}] ${b.text}`;
      case "quote":
        return b.text
          .split("\n")
          .map((l) => `> ${l}`)
          .join("\n");
      case "code":
        return `\`\`\`${b.language || ""}\n${b.text}\n\`\`\``;
      case "divider":
        return "---";
      case "image":
        return b.text ? `![](${b.text})` : "";
      case "canvas":
        return b.text ? `[Canvas: ${b.text}](/room/${b.text})` : "";
      case "table": {
        const rows = b.text.split("\n").map((r) => r.split("|").map((c) => c.trim()));
        if (!rows.length) return "";
        const head = `| ${rows[0].join(" | ")} |`;
        const sep = `| ${rows[0].map(() => "---").join(" | ")} |`;
        return [head, sep, ...rows.slice(1).map((r) => `| ${r.join(" | ")} |`)].join("\n");
      }
      default:
        return b.text;
    }
  });
  return `# ${doc.title}\n\n${doc.description ? doc.description + "\n\n" : ""}${lines.filter((l) => l !== "").join("\n\n")}\n`;
}
function downloadMarkdown(doc: Document) {
  const url = URL.createObjectURL(
    new Blob([toMarkdown(doc)], { type: "text/markdown" }),
  );
  const a = window.document.createElement("a");
  a.href = url;
  a.download = `${doc.title || "Untitled"}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
/** Minimal inline Markdown renderer for preview / read-only mode. */
function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|_[^_]+_|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(pattern)) {
    const t = match[0];
    if (match.index! > last) out.push(text.slice(last, match.index));
    if (t.startsWith("**")) out.push(<strong key={key++}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("~~")) out.push(<s key={key++}>{t.slice(2, -2)}</s>);
    else if (t.startsWith("`")) out.push(<code key={key++}>{t.slice(1, -1)}</code>);
    else if (t.startsWith("[")) {
      const [, label, href] = t.match(/\[([^\]]+)\]\(([^)]+)\)/) || [];
      out.push(
        /^https?:\/\//.test(href) ? (
          <a key={key++} href={href} target="_blank" rel="noreferrer">
            {label}
          </a>
        ) : (
          <span key={key++}>{label}</span>
        ),
      );
    } else out.push(<em key={key++}>{t.slice(1, -1)}</em>);
    last = match.index! + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
function docLocation(
  doc: Document,
  projects: { id: string; name: string; rooms: { id: string; name: string }[] }[],
) {
  const project = projects.find((p) => p.id === doc.projectId);
  const room = project?.rooms.find((r) => r.id === doc.roomId);
  return { project, room };
}
function editedLabel(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

export default function Documents({ roomId }: { roomId?: string }) {
  const { documentId } = useParams();
  const { documents, setDocuments, workspace, base, demo, logActivity, can, role } =
    useWorkspace();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(params.has("create"));
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState("");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("all");
  const [roomDocument, setRoomDocument] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  useEffect(() => {
    if (demo || !workspace?.id) return;
    let active = true;
    setLoading(true);
    const url = new URL(`${API_BASE}/workspaces/${workspace.id}/documents`);
    if (roomId) url.searchParams.set("roomId", roomId);
    fetch(url, { headers: authHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<Document[]>;
      })
      .then((data) => {
        if (!active) return;
        setDocuments((prev) => [
          ...prev.filter(
            (doc) =>
              doc.workspaceId !== workspace.id ||
              (!!roomId && doc.roomId !== roomId),
          ),
          ...data,
        ]);
      })
      .catch(() => {
        if (active) toast("Documents could not be loaded from the server.", true);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [demo, roomId, setDocuments, toast, workspace?.id]);
  const currentId = roomId ? roomDocument : documentId;
  const current = documents.find(
    (d) =>
      d.id === currentId &&
      d.workspaceId === workspace?.id &&
      (!roomId || d.roomId === roomId),
  );
  const items = documents
    .filter(
      (d) =>
        d.workspaceId === workspace?.id &&
        (!roomId || d.roomId === roomId) &&
        (scope === "all" || (scope === "rooms" ? !!d.roomId : !d.roomId)) &&
        `${d.title} ${d.description}`.toLowerCase().includes(query.toLowerCase()),
    )
    .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const open = (id: string) =>
    roomId ? setRoomDocument(id) : navigate(`${base}/documents/${id}`);
  const duplicate = (d: Document) => {
    const copy: Document = {
      ...structuredClone(d),
      id: crypto.randomUUID(),
      title: `${d.title} (copy)`,
      author: demo ? "Alex Morgan" : "You",
      updatedAt: new Date().toISOString(),
      blocks: d.blocks.map((b) => ({ ...b, id: crypto.randomUUID() })),
    };
    setDocuments((prev) => [...prev, copy]);
    toast("Document duplicated.");
    return copy;
  };
  if (current)
    return (
      <DocumentEditor
        key={current.id}
        document={current}
        onBack={roomId ? () => setRoomDocument("") : undefined}
        onOpen={open}
        onDuplicate={duplicate}
      />
    );
  if (documentId && !roomId)
    return (
      <div className="page">
        <EmptyState
          title="Document not found"
          description="This document may belong to another workspace or an earlier demo session."
          action={
            <Link className="btn btn-secondary" to={`${base}/documents`}>
              All documents
            </Link>
          }
        />
      </div>
    );
  const deleting = documents.find((d) => d.id === deleteId);
  return (
    <div className={roomId ? "room-resource-page" : "page"}>
      <div className="page-heading">
        <div>
          <div className="eyebrow">THOUGHTS, WITH A LITTLE STRUCTURE</div>
          <Heading level={1}>
            {roomId ? "Room documents" : "Shared documents"}
            <span className="blue-text">.</span>
          </Heading>
          <p>A place to turn thinking into understanding.</p>
        </div>
        {can.create && (
          <Button
            variant="primary"
            icon="plus"
            disabled={!workspace}
            onClick={() => setCreating(true)}
          >
            New document
          </Button>
        )}
      </div>
      <Notice>
        {demo
          ? "Sample documents and local drafts. Editing works in this session; real-time co-editing is not connected."
          : "Document persistence and collaboration are not available on this backend. Documents created here are session-only drafts. Download a copy before leaving."}
      </Notice>
      {!can.create && (
        <div className="doc-permission">
          <PermissionNote role={role}>
            You can read documents. Creating and editing requires the Member
            role.
          </PermissionNote>
        </div>
      )}
      <div className="list-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search documents…"
          label="Search documents"
        />
        {!roomId && (
          <div className="segmented" role="tablist" aria-label="Document scope">
            {[
              ["all", "All"],
              ["workspace", "Workspace"],
              ["rooms", "In rooms"],
            ].map(([v, l]) => (
              <button
                type="button"
                role="tab"
                key={v}
                aria-selected={scope === v}
                className={scope === v ? "active" : ""}
                onClick={() => setScope(v)}
              >
                {l}
              </button>
            ))}
          </div>
        )}
        <span className="list-count">{items.length} documents</span>
      </div>
      <div className="document-list">
        {items.map((d) => {
          const { project, room } = docLocation(d, workspace?.projects || []);
          return (
            <div key={d.id}>
              <Button
                variant="ghost"
                className="document-list-link"
                onClick={() => open(d.id)}
              >
                <span className="document-icon">
                  <Icon name="file" size={22} />
                </span>
                <span>
                  <strong>{d.title}</strong>
                  <small>
                    {d.description || "A new page of possibilities."}
                  </small>
                </span>
                <span className="document-location">
                  <Icon name={room ? "frame" : "home"} size={12} />
                  {room ? room.name : project ? project.name : "Workspace"}
                </span>
                <span className="document-meta">
                  <Avatar name={d.author} size="small" />
                  <span>
                    <small>{d.author}</small>
                    <time>{editedLabel(d.updatedAt)}</time>
                  </span>
                </span>
                <Icon name="chevron" size={16} />
              </Button>
              <Dropdown
                className="resource-more"
                ariaLabel={`${d.title} actions`}
                label={<Icon name="more" />}
              >
                <MenuItem icon="file" onClick={() => open(d.id)}>
                  Open
                </MenuItem>
                {can.create && (
                  <MenuItem icon="copy" onClick={() => duplicate(d)}>
                    Duplicate
                  </MenuItem>
                )}
                <MenuItem icon="download" onClick={() => downloadMarkdown(d)}>
                  Export Markdown
                </MenuItem>
                {can.edit && (
                  <>
                    <MenuDivider />
                    <MenuItem
                      icon="trash"
                      danger
                      onClick={() => setDeleteId(d.id)}
                    >
                      Delete
                    </MenuItem>
                  </>
                )}
              </Dropdown>
            </div>
          );
        })}
      </div>
      {!loading && !items.length && (
        <EmptyState
          icon={query ? "search" : "file"}
          title={query ? "No matching documents" : "Give your ideas a home"}
          description={
            query
              ? "Try another keyword."
              : "Start with a blank page. Add headings, checklists, images, and a little clarity."
          }
          action={
            can.create && !query ? (
              <Button icon="plus" onClick={() => setCreating(true)}>
                Create document
              </Button>
            ) : undefined
          }
        />
      )}
      {(creating || params.has("create")) && can.create && (
        <Modal
          title="Create a document"
          onClose={() => {
            setCreating(false);
            setParams({});
          }}
        >
          <form
            className="form-stack"
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              if (!workspace) return;
              if (!title.trim()) {
                setTitleError("Give your document a title.");
                return;
              }
              const local: Document = {
                id: crypto.randomUUID(),
                title: title.trim(),
                description: "",
                author: demo ? "Alex Morgan" : "You",
                workspaceId: workspace.id,
                projectId:
                  params.get("project") ||
                  workspace.projects.find((p) =>
                    p.rooms.some((r) => r.id === roomId),
                  )?.id,
                roomId,
                updatedAt: new Date().toISOString(),
                blocks: [
                  { id: crypto.randomUUID(), kind: "paragraph", text: "" },
                ],
              };
              let doc = local;
              if (!demo) {
                const response = await fetch(
                  `${API_BASE}/workspaces/${workspace.id}/documents`,
                  {
                    method: "POST",
                    headers: authHeaders(),
                    body: JSON.stringify(local),
                  },
                );
                if (!response.ok) {
                  toast("Document could not be created on the server.", true);
                  return;
                }
                doc = await response.json();
              }
              setDocuments((prev) => [...prev, doc]);
              logActivity(
                demo ? "created a local document" : "created a document",
                doc.title,
                `/documents/${doc.id}`,
                "file",
              );
              setCreating(false);
              setTitle("");
              setParams({});
              open(doc.id);
            }}
          >
            <Notice>
              This document is a session-only local draft, not a synchronized
              team document.
            </Notice>
            <Field label="Document title" error={titleError}>
              <Input
                maxLength={200}
                value={title}
                aria-invalid={!!titleError}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTitleError("");
                }}
                placeholder="Untitled idea"
                autoFocus
              />
            </Field>
            <div className="modal-actions">
              <Button
                onClick={() => {
                  setCreating(false);
                  setParams({});
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Create document
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && (
        <Confirm
          title={`Delete “${deleting.title}”?`}
          description="This removes the document from the current session. Export a Markdown copy first if you want to keep it."
          confirmLabel="Delete document"
          onClose={() => setDeleteId("")}
          onConfirm={async () => {
            if (!demo) {
              const response = await fetch(
                `${API_BASE}/documents/${deleteId}`,
                { method: "DELETE", headers: authHeaders() },
              );
              if (!response.ok && response.status !== 404)
                throw new Error(`Delete failed (${response.status})`);
            }
            setDocuments((prev) => prev.filter((d) => d.id !== deleteId));
            setDeleteId("");
            toast("Document deleted.");
          }}
        />
      )}
    </div>
  );
}

type BlockMenu = {
  mode: "insert" | "convert" | "slash";
  blockId: string | null;
  query: string;
  x: number;
  y: number;
} | null;

function BlockTypeMenu({
  menu,
  onChoose,
  onClose,
}: {
  menu: NonNullable<BlockMenu>;
  onChoose: (kind: BlockKind) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState("");
  const [active, setActive] = useState(0);
  const query = menu.mode === "slash" ? menu.query : filter;
  const list = blockTypes.filter((b) =>
    `${b.label} ${b.hint}`.toLowerCase().includes(query.toLowerCase()),
  );
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) =>
          Math.max(0, Math.min(list.length - 1, a + (e.key === "ArrowDown" ? 1 : -1))),
        );
      }
      if (e.key === "Enter" && list[active]) {
        e.preventDefault();
        onChoose(list[active].kind);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key, true);
    };
  }, [list, active, onChoose, onClose]);
  return createPortal(
    <div
      ref={ref}
      role="menu"
      className="block-menu"
      style={{
        left: Math.min(menu.x, window.innerWidth - 280),
        top: Math.min(menu.y, window.innerHeight - 380),
      }}
    >
      {menu.mode !== "slash" && (
        <div className="block-menu-search">
          <Icon name="search" size={14} />
          <input
            autoFocus
            placeholder={menu.mode === "convert" ? "Turn into…" : "Search blocks…"}
            aria-label="Filter block types"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setActive(0);
            }}
          />
        </div>
      )}
      <div className="block-menu-list">
        {list.map((b, i) => {
          const header = i === 0 || b.group !== list[i - 1].group;
          return (
            <Fragment key={b.kind}>
              {header && !query && (
                <span className="menu-label">{b.group.toUpperCase()}</span>
              )}
              <button
                type="button"
                role="menuitem"
                className={i === active ? "active" : ""}
                onMouseEnter={() => setActive(i)}
                onClick={() => onChoose(b.kind)}
              >
                <span className="block-menu-icon">
                  <Icon name={b.icon} size={15} />
                  {b.kind.startsWith("heading") && <b>{b.kind.at(-1)}</b>}
                </span>
                <span>
                  <strong>{b.label}</strong>
                  <small>{b.hint}</small>
                </span>
              </button>
            </Fragment>
          );
        })}
        {!list.length && <p className="block-menu-empty">No matching blocks</p>}
      </div>
    </div>,
    document.body,
  );
}

function TableBlock({
  text,
  readOnly,
  onChange,
}: {
  text: string;
  readOnly: boolean;
  onChange: (text: string) => void;
}) {
  const rows = (text || " | ").split("\n").map((r) => r.split("|").map((c) => c.trim()));
  const cols = Math.max(...rows.map((r) => r.length));
  const grid = rows.map((r) => [...r, ...Array(cols - r.length).fill("")]);
  const write = (next: string[][]) => onChange(next.map((r) => r.join(" | ")).join("\n"));
  return (
    <div className="table-block">
      <table className="doc-table">
        <tbody>
          {grid.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => {
                const Tag = ri === 0 ? "th" : "td";
                return (
                  <Tag key={ci}>
                    {readOnly ? (
                      renderInline(cell)
                    ) : (
                      <input
                        aria-label={`Row ${ri + 1}, column ${ci + 1}`}
                        value={cell}
                        onChange={(e) => {
                          const next = grid.map((r) => [...r]);
                          next[ri][ci] = e.target.value.replace(/\|/g, "/");
                          write(next);
                        }}
                      />
                    )}
                  </Tag>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly && (
        <div className="table-block-actions">
          <Button
            variant="ghost"
            icon="plus"
            onClick={() => write([...grid, Array(cols).fill("")])}
          >
            Row
          </Button>
          <Button
            variant="ghost"
            icon="plus"
            onClick={() => write(grid.map((r, i) => [...r, i === 0 ? "Column" : ""]))}
          >
            Column
          </Button>
          {grid.length > 2 && (
            <Button variant="ghost" icon="minus" onClick={() => write(grid.slice(0, -1))}>
              Row
            </Button>
          )}
          {cols > 1 && (
            <Button
              variant="ghost"
              icon="minus"
              onClick={() => write(grid.map((r) => r.slice(0, -1)))}
            >
              Column
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function DocumentEditor({
  document: doc,
  onBack,
  onOpen,
  onDuplicate,
}: {
  document: Document;
  onBack?: () => void;
  onOpen: (id: string) => void;
  onDuplicate: (doc: Document) => Document;
}) {
  const { setDocuments, workspace, base, demo, can, assets, role } = useWorkspace();
  const toast = useToast();
  const navigate = useNavigate();
  const readOnly = !can.edit;
  const [mode, setMode] = useState<"edit" | "preview">(readOnly ? "preview" : "edit");
  const preview = readOnly || mode === "preview";
  const [selected, setSelected] = useState<string | null>(null);
  const [save, setSave] = useState<SyncState>(demo ? "local" : "connecting");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(doc.title);
  const [deleting, setDeleting] = useState(false);
  const [libraryFor, setLibraryFor] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<string[]>([]);
  const [versions, setVersions] = useState<Document[]>([]);
  const [menu, setMenu] = useState<BlockMenu>(null);
  const [handleMenu, setHandleMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; after: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stompRef = useRef<Client | null>(null);
  const latestDocRef = useRef(doc);
  const editor = useRef<HTMLDivElement>(null);
  latestDocRef.current = doc;
  const handleRef = useRef<HTMLDivElement>(null);
  const { project, room } = docLocation(doc, workspace?.projects || []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (demo) return;
    const token =
      localStorage.getItem("accessToken") ||
      sessionStorage.getItem("accessToken");
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      reconnectDelay: 3000,
      onConnect: () => {
        setSave("saved");
        client.subscribe(`/topic/doc.${doc.id}`, (frame) => {
          try {
            const payload = JSON.parse(frame.body);
            if (payload.senderId === TAB_CLIENT_ID) return;
            setDocuments((prev) =>
              prev.map((item) =>
                item.id === doc.id
                  ? {
                      ...item,
                      title: payload.title ?? item.title,
                      description: payload.description ?? item.description,
                      blocks: payload.blocks ?? item.blocks,
                      updatedAt:
                        payload.updatedAt || new Date().toISOString(),
                    }
                  : item,
              ),
            );
            setSave("saved");
          } catch {
            setSave("failed");
          }
        });
      },
      onWebSocketClose: () => setSave("reconnecting"),
      onStompError: () => setSave("failed"),
    });
    client.activate();
    stompRef.current = client;
    return () => {
      client.deactivate();
      stompRef.current = null;
    };
  }, [demo, doc.id, setDocuments]);
  useEffect(() => {
    if (!handleMenu) return;
    const close = (e: MouseEvent) => {
      if (!handleRef.current?.contains(e.target as Node)) setHandleMenu(null);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setHandleMenu(null);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [handleMenu]);
  const focusBlock = (id: string, end = true) =>
    setTimeout(() => {
      const field = editor.current?.querySelector<HTMLTextAreaElement>(
        `[data-block="${id}"]`,
      );
      field?.focus();
      if (field && end) field.setSelectionRange(field.value.length, field.value.length);
    }, 0);
  const update = (patch: Partial<Document>) => {
    if (readOnly) return;
    const nextDoc = {
      ...latestDocRef.current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    setDocuments((prev) =>
      prev.map((d) => (d.id === doc.id ? nextDoc : d)),
    );
    latestDocRef.current = nextDoc;
    setSave("saving");
    if (timer.current) clearTimeout(timer.current);
    if (demo) {
      timer.current = setTimeout(() => setSave("local"), 600);
      return;
    }
    if (stompRef.current?.connected)
      stompRef.current.publish({
        destination: `/app/doc.${doc.id}.update`,
        body: JSON.stringify({
          senderId: TAB_CLIENT_ID,
          documentId: doc.id,
          title: nextDoc.title,
          description: nextDoc.description,
          blocks: nextDoc.blocks,
          updatedAt: nextDoc.updatedAt,
        }),
      });
    timer.current = setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE}/documents/${doc.id}`, {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({
            title: nextDoc.title,
            description: nextDoc.description,
            blocks: nextDoc.blocks,
          }),
        });
        if (!response.ok) throw new Error();
        setSave("saved");
      } catch {
        setSave("failed");
      }
    }, 600);
  };
  const blockUpdate = (id: string, patch: Partial<Block>) =>
    update({
      blocks: doc.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    });
  const move = (index: number, delta: number) => {
    const blocks = [...doc.blocks];
    if (!blocks[index + delta]) return;
    [blocks[index], blocks[index + delta]] = [
      blocks[index + delta],
      blocks[index],
    ];
    update({ blocks });
  };
  const moveTo = (dragId: string, targetId: string, after: boolean) => {
    const blocks = [...doc.blocks];
    const from = blocks.findIndex((b) => b.id === dragId);
    const [item] = blocks.splice(from, 1);
    const to = blocks.findIndex((b) => b.id === targetId);
    blocks.splice(after ? to + 1 : to, 0, item);
    update({ blocks });
  };
  const newBlock = (kind: BlockKind): Block => ({
    id: crypto.randomUUID(),
    kind,
    text:
      kind === "table"
        ? "Column one | Column two\nValue one | Value two"
        : "",
  });
  const insertAfter = (afterId: string | null, kind: BlockKind = "paragraph") => {
    const block = newBlock(kind);
    const index = doc.blocks.findIndex((b) => b.id === afterId);
    const blocks = [...doc.blocks];
    blocks.splice(index < 0 ? blocks.length : index + 1, 0, block);
    update({ blocks });
    setSelected(block.id);
    if (TEXT_KINDS.includes(kind)) focusBlock(block.id);
    return block;
  };
  const addBlock = (kind: BlockKind = "paragraph") => insertAfter(selected, kind);
  const convert = (id: string, kind: BlockKind) => {
    const b = doc.blocks.find((x) => x.id === id);
    if (!b) return;
    blockUpdate(id, {
      kind,
      text:
        kind === "table" && !b.text.includes("|")
          ? `${b.text || "Column one"} | Column two\n | `
          : kind === "divider"
            ? ""
            : b.text,
    });
    if (TEXT_KINDS.includes(kind)) focusBlock(id);
  };
  const remove = (id: string) => {
    const index = doc.blocks.findIndex((b) => b.id === id);
    const blocks = doc.blocks.filter((b) => b.id !== id);
    update({ blocks: blocks.length ? blocks : [newBlock("paragraph")] });
    const prev = blocks[Math.max(0, index - 1)];
    if (prev) {
      setSelected(prev.id);
      if (TEXT_KINDS.includes(prev.kind)) focusBlock(prev.id);
    }
  };
  const duplicateBlock = (index: number) => {
    const blocks = [...doc.blocks];
    blocks.splice(index + 1, 0, { ...doc.blocks[index], id: crypto.randomUUID() });
    update({ blocks });
  };
  const format = (before: string, after = before, placeholder = "text") => {
    const field = editor.current?.querySelector<HTMLTextAreaElement>(
      `[data-block="${selected}"]`,
    );
    if (!field || !selected) {
      toast("Place the cursor in a text block first.", "info");
      return;
    }
    const start = field.selectionStart,
      end = field.selectionEnd,
      value = field.value;
    const inner = value.slice(start, end) || placeholder;
    blockUpdate(selected, {
      text: value.slice(0, start) + before + inner + after + value.slice(end),
    });
    setTimeout(() => {
      field.focus();
      field.setSelectionRange(start + before.length, start + before.length + inner.length);
    }, 0);
  };
  const openMenu = (
    mode: "insert" | "convert" | "slash",
    blockId: string | null,
    el: HTMLElement,
    query = "",
  ) => {
    const r = el.getBoundingClientRect();
    setMenu({ mode, blockId, query, x: r.left, y: r.bottom + 6 });
  };
  const chooseBlock = (kind: BlockKind) => {
    if (!menu) return;
    if (menu.mode === "insert") insertAfter(menu.blockId, kind);
    else if (menu.blockId) {
      if (menu.mode === "slash") blockUpdate(menu.blockId, { kind, text: kind === "table" ? newBlock("table").text : "" });
      else convert(menu.blockId, kind);
      if (TEXT_KINDS.includes(kind)) focusBlock(menu.blockId);
    }
    setMenu(null);
  };
  const words = doc.blocks
    .map((b) => b.text)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  const selectedBlock = doc.blocks.find((b) => b.id === selected);
  const handleBlock = handleMenu && doc.blocks.find((b) => b.id === handleMenu.id);
  const handleIndex = handleBlock ? doc.blocks.indexOf(handleBlock) : -1;
  return (
    <div className={`document-editor ${preview ? "is-preview" : ""}`}>
      <div className="document-topbar">
        <Breadcrumbs
          items={
            onBack
              ? [
                  { label: room?.name || "Room", icon: "frame" },
                  { label: "Documents" },
                  { label: doc.title || "Untitled" },
                ]
              : [
                  { label: "Shared documents", to: `${base}/documents`, icon: "file" },
                  { label: doc.title || "Untitled" },
                ]
          }
        />
        {onBack && (
          <Button variant="ghost" icon="file" onClick={onBack}>
            Room documents
          </Button>
        )}
        <span className="doc-shared-indicator" title="Who can see this document">
          <Icon name={room ? "frame" : "users"} size={12} />
          {room ? `In ${room.name}` : "Shared with workspace"}
        </span>
        <span className="document-save-status">
          <StatusIndicator
            state={readOnly ? "readonly" : save}
            label={
              readOnly
                ? "View only"
                : save === "saving"
                  ? demo
                    ? "Saving locally…"
                    : "Saving to cloud…"
                  : save === "saved"
                    ? "Saved to cloud"
                    : save === "failed"
                      ? "Save failed"
                      : save === "reconnecting"
                        ? "Reconnecting…"
                        : "Saved locally · this session"
            }
          />
        </span>
        {demo && (
          <Presence
            people={[{ name: "James Wilson", color: "#39755b" }]}
            label="James viewing · sample"
            sample
          />
        )}
        {!readOnly && (
          <div className="segmented doc-mode" role="tablist" aria-label="Editor mode">
            {(["edit", "preview"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                className={mode === m ? "active" : ""}
                onClick={() => setMode(m)}
              >
                <Icon name={m === "edit" ? "edit" : "eye"} size={12} />
                {m === "edit" ? "Edit" : "Preview"}
              </button>
            ))}
          </div>
        )}
        <IconButton
          icon="history"
          label="Local version snapshots"
          onClick={() => setHistoryOpen(true)}
        />
        <IconButton
          icon="chat"
          label="Local document comments"
          onClick={() => setCommentsOpen(true)}
        />
        <Button icon="download" onClick={() => downloadMarkdown(doc)}>
          Export
        </Button>
        <Dropdown
          className="resource-more"
          ariaLabel="Document actions"
          label={<Icon name="more" />}
        >
          {!readOnly && (
            <MenuItem icon="edit" onClick={() => {
              setRenameValue(doc.title);
              setRenaming(true);
            }}>
              Rename
            </MenuItem>
          )}
          {can.create && (
            <MenuItem
              icon="copy"
              onClick={() => {
                const copy = onDuplicate(doc);
                onOpen(copy.id);
              }}
            >
              Duplicate
            </MenuItem>
          )}
          <MenuItem icon="download" onClick={() => downloadMarkdown(doc)}>
            Export Markdown
          </MenuItem>
          <MenuItem icon="info" onClick={() => setInfoOpen(true)}>
            Document information
          </MenuItem>
          {!readOnly && (
            <>
              <MenuDivider />
              <MenuItem icon="trash" danger onClick={() => setDeleting(true)}>
                Delete document
              </MenuItem>
            </>
          )}
        </Dropdown>
      </div>
      {readOnly ? (
        <div className="doc-readonly-bar">
          <PermissionNote role={role}>
            You’re reading this document. Editing requires the Member role.
          </PermissionNote>
        </div>
      ) : (
        mode === "edit" && (
          <div className="formatting-toolbar" role="toolbar" aria-label="Formatting">
            <Select
              aria-label="Turn selected block into"
              value={selectedBlock?.kind || ""}
              disabled={!selectedBlock}
              onChange={(e) =>
                selectedBlock && convert(selectedBlock.id, e.target.value as BlockKind)
              }
            >
              <option value="" disabled>
                Turn into…
              </option>
              {blockTypes.map((b) => (
                <option key={b.kind} value={b.kind}>
                  {b.label}
                </option>
              ))}
            </Select>
            <span className="toolbar-divider" />
            <IconButton icon="bold" label="Bold (⌘B)" onMouseDown={(e) => e.preventDefault()} onClick={() => format("**")} />
            <IconButton icon="italic" label="Italic (⌘I)" onMouseDown={(e) => e.preventDefault()} onClick={() => format("_")} />
            <IconButton icon="strike" label="Strikethrough" onMouseDown={(e) => e.preventDefault()} onClick={() => format("~~")} />
            <IconButton icon="code" label="Inline code" onMouseDown={(e) => e.preventDefault()} onClick={() => format("`")} />
            <IconButton
              icon="link"
              label="Link (⌘K)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => format("[", "](https://)", "link text")}
            />
            <span className="toolbar-divider" />
            <Button
              variant="ghost"
              icon="plus"
              className="insert-block-button"
              onClick={(e) => openMenu("insert", selected, e.currentTarget)}
            >
              Insert block
            </Button>
            <span className="small-text muted">
              Markdown formatting · Local draft · No live co-editing
            </span>
          </div>
        )
      )}
      <div className="document-paper" ref={editor}>
        <div className="document-kicker">
          <Badge>{workspace?.name}</Badge>
          <span>
            {project ? `${project.name.toUpperCase()}${room ? ` / ${room.name.toUpperCase()}` : ""}` : "LOCAL DOCUMENT"}
          </span>
        </div>
        <Input
          className="document-title"
          aria-label="Document title"
          value={doc.title}
          readOnly={readOnly}
          placeholder="Untitled"
          onChange={(e) => update({ title: e.target.value })}
        />
        {preview ? (
          doc.description && <p className="document-description preview">{doc.description}</p>
        ) : (
          <Textarea
            className="document-description"
            aria-label="Document description"
            value={doc.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="Add a description…"
            rows={1}
          />
        )}
        <div className="document-byline">
          <Avatar name={doc.author} size="small" />
          <span>{doc.author}</span>
          <span>·</span>
          <span>Edited {editedLabel(doc.updatedAt)}</span>
          <span>·</span>
          <span>{words} words</span>
        </div>
        <div className="document-blocks">
          {doc.blocks.map((block, index) => {
            const numbered =
              block.kind === "numbered"
                ? index -
                  doc.blocks
                    .slice(0, index)
                    .findLastIndex((b) => b.kind !== "numbered")
                : 0;
            return (
              <div
                className={`document-block block-${block.kind} ${selected === block.id && !preview ? "block-selected" : ""} ${block.checked ? "is-checked" : ""} ${drop?.id === block.id ? (drop.after ? "drop-after" : "drop-before") : ""} ${drag === block.id ? "dragging" : ""}`}
                key={block.id}
                onFocus={() => setSelected(block.id)}
                onClick={() => !preview && setSelected(block.id)}
                onDragOver={(e) => {
                  if (!drag || drag === block.id) return;
                  e.preventDefault();
                  const r = e.currentTarget.getBoundingClientRect();
                  setDrop({ id: block.id, after: e.clientY > r.top + r.height / 2 });
                }}
                onDragLeave={() => setDrop(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  if (drag && drop) moveTo(drag, drop.id, drop.after);
                  setDrag(null);
                  setDrop(null);
                }}
              >
                {!preview && (
                  <div className="block-controls">
                    <IconButton
                      icon="plus"
                      label="Add block after this one"
                      onClick={(e) => openMenu("insert", block.id, e.currentTarget)}
                    />
                    <button
                      type="button"
                      className="block-handle"
                      draggable
                      aria-label={`${blockName(block.kind)} block options. Drag to move.`}
                      title="Drag to move · Click for options"
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", block.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDrag(block.id);
                      }}
                      onDragEnd={() => {
                        setDrag(null);
                        setDrop(null);
                      }}
                      onClick={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setSelected(block.id);
                        setHandleMenu({ id: block.id, x: r.left, y: r.bottom + 6 });
                      }}
                    >
                      <Icon name="drag" size={14} />
                    </button>
                  </div>
                )}
                {block.kind === "divider" ? (
                  <hr />
                ) : block.kind === "canvas" ? (
                  <div className="canvas-embed">
                    <Icon name="frame" size={22} />
                    <div>
                      <strong>Canvas reference</strong>
                      {preview ? (
                        <span className="muted small-text">
                          {workspace?.projects
                            .flatMap((p) => p.rooms)
                            .find((r) => r.id === block.text)?.name || "No room selected"}
                        </span>
                      ) : (
                        <Select
                          aria-label="Linked room"
                          value={block.text}
                          onChange={(e) =>
                            blockUpdate(block.id, { text: e.target.value })
                          }
                        >
                          <option value="">Select a room</option>
                          {workspace?.projects.flatMap((p) =>
                            p.rooms.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            )),
                          )}
                        </Select>
                      )}
                    </div>
                    {block.text && (
                      <Link
                        to={`${base}/room/${block.text}`}
                        className="text-link"
                      >
                        Open canvas
                        <Icon name="arrow" size={14} />
                      </Link>
                    )}
                  </div>
                ) : block.kind === "image" ? (
                  <div className="image-block">
                    {/^(https?:\/\/|\/|blob:)/.test(block.text) ? (
                      <figure>
                        <img src={block.text} alt="Document image" />
                        {!preview && (
                          <div className="image-block-tools">
                            <Button variant="ghost" icon="image" onClick={() => setLibraryFor(block.id)}>
                              Replace
                            </Button>
                            <Button variant="ghost" icon="close" onClick={() => blockUpdate(block.id, { text: "" })}>
                              Remove
                            </Button>
                          </div>
                        )}
                      </figure>
                    ) : preview ? (
                      <p className="muted small-text">No image selected.</p>
                    ) : (
                      <div className="image-block-empty">
                        <Icon name="image" size={22} />
                        <div>
                          <Input
                            type="url"
                            aria-label="Image URL"
                            placeholder="Paste an image URL…"
                            value={block.text}
                            onChange={(e) =>
                              blockUpdate(block.id, { text: e.target.value })
                            }
                          />
                          <span>or</span>
                          <Button icon="folder" onClick={() => setLibraryFor(block.id)}>
                            Choose from media library
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : block.kind === "table" ? (
                  <TableBlock
                    text={block.text}
                    readOnly={preview}
                    onChange={(text) => blockUpdate(block.id, { text })}
                  />
                ) : (
                  <>
                    <span className="block-prefix">
                      {block.kind === "bullet" ? (
                        "•"
                      ) : block.kind === "numbered" ? (
                        `${numbered}.`
                      ) : block.kind === "checklist" ? (
                        <Input
                          type="checkbox"
                          checked={!!block.checked}
                          disabled={readOnly}
                          onChange={(e) =>
                            blockUpdate(block.id, { checked: e.target.checked })
                          }
                          aria-label="Check item"
                        />
                      ) : null}
                    </span>
                    {block.kind === "code" && (
                      <div className="code-block-head">
                        {preview ? (
                          <span>{block.language || "Plain text"}</span>
                        ) : (
                          <input
                            aria-label="Code language"
                            placeholder="Language"
                            value={block.language || ""}
                            onChange={(e) =>
                              blockUpdate(block.id, { language: e.target.value })
                            }
                          />
                        )}
                        <Button
                          variant="ghost"
                          icon="copy"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(block.text);
                              toast("Code copied.");
                            } catch {
                              toast("Select the code to copy it.", "info");
                            }
                          }}
                        >
                          Copy
                        </Button>
                      </div>
                    )}
                    {preview ? (
                      <div className="block-preview">
                        {block.kind === "code"
                          ? block.text
                          : block.text
                            ? renderInline(block.text)
                            : <span className="muted">Empty {blockName(block.kind).toLowerCase()}</span>}
                      </div>
                    ) : (
                      <Textarea
                        data-block={block.id}
                        aria-label={`${blockName(block.kind)} block`}
                        value={block.text}
                        placeholder={
                          block.kind === "paragraph"
                            ? "Type “/” for blocks, or just start writing…"
                            : `${blockName(block.kind)}…`
                        }
                        rows={Math.max(
                          1,
                          block.text.split("\n").length +
                            (block.text.length > 100
                              ? Math.ceil(block.text.length / 90) - 1
                              : 0),
                        )}
                        onChange={(e) => {
                          const value = e.target.value;
                          blockUpdate(block.id, { text: value });
                          if (block.kind === "paragraph" && value.startsWith("/") && !value.includes(" "))
                            openMenu("slash", block.id, e.currentTarget, value.slice(1));
                          else if (menu?.mode === "slash") setMenu(null);
                        }}
                        onKeyDown={(e) => {
                          const mod = e.ctrlKey || e.metaKey;
                          if (menu?.mode === "slash" && ["ArrowDown", "ArrowUp", "Enter"].includes(e.key)) return;
                          if (mod && e.key === "Enter") {
                            e.preventDefault();
                            insertAfter(block.id, ["bullet", "numbered", "checklist"].includes(block.kind) ? block.kind : "paragraph");
                          } else if (mod && e.key.toLowerCase() === "b") {
                            e.preventDefault();
                            format("**");
                          } else if (mod && e.key.toLowerCase() === "i") {
                            e.preventDefault();
                            format("_");
                          } else if (e.key === "Backspace" && !block.text && doc.blocks.length > 1) {
                            e.preventDefault();
                            if (block.kind !== "paragraph") convert(block.id, "paragraph");
                            else remove(block.id);
                          } else if (e.altKey && e.key === "ArrowUp") {
                            e.preventDefault();
                            move(index, -1);
                          } else if (e.altKey && e.key === "ArrowDown") {
                            e.preventDefault();
                            move(index, 1);
                          }
                        }}
                      />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
        {!preview && (
          <Button
            variant="ghost"
            icon="plus"
            className="add-block-button"
            onClick={() => addBlock()}
          >
            Add a block
          </Button>
        )}
        <div className="document-footnote">
          <Icon name="info" size={14} />
          Changes live in this session only. Export a copy to keep your work.
          {!preview && " · ⌘↵ new block · / block menu · ⌥↑↓ move"}
        </div>
      </div>
      {menu && (
        <BlockTypeMenu
          key={`${menu.mode}-${menu.blockId}`}
          menu={menu}
          onChoose={chooseBlock}
          onClose={() => setMenu(null)}
        />
      )}
      {handleMenu &&
        handleBlock &&
        createPortal(
          <div
            ref={handleRef}
            role="menu"
            className="context-menu block-handle-menu"
            style={{
              left: Math.min(handleMenu.x, window.innerWidth - 240),
              top: Math.min(handleMenu.y, window.innerHeight - 300),
            }}
          >
            <span className="menu-label">{blockName(handleBlock.kind).toUpperCase()}</span>
            <MenuItem
              icon="refresh"
              onClick={(e) => {
                const el = e.currentTarget;
                setHandleMenu(null);
                openMenu("convert", handleBlock.id, el);
              }}
            >
              Turn into…
            </MenuItem>
            <MenuItem
              icon="arrow-up"
              shortcut="⌥↑"
              disabled={handleIndex === 0}
              onClick={() => {
                move(handleIndex, -1);
                setHandleMenu(null);
              }}
            >
              Move up
            </MenuItem>
            <MenuItem
              icon="arrow-down"
              shortcut="⌥↓"
              disabled={handleIndex === doc.blocks.length - 1}
              onClick={() => {
                move(handleIndex, 1);
                setHandleMenu(null);
              }}
            >
              Move down
            </MenuItem>
            <MenuItem
              icon="copy"
              onClick={() => {
                duplicateBlock(handleIndex);
                setHandleMenu(null);
              }}
            >
              Duplicate block
            </MenuItem>
            <MenuDivider />
            <MenuItem
              icon="trash"
              danger
              onClick={() => {
                remove(handleBlock.id);
                setHandleMenu(null);
              }}
            >
              Delete block
            </MenuItem>
          </div>,
          document.body,
        )}
      {libraryFor && (
        <Modal title="Insert from media library" onClose={() => setLibraryFor(null)} wide>
          <div className="canvas-library">
            {assets
              .filter((a) => a.workspaceId === workspace?.id && a.type.startsWith("image/"))
              .map((a) => (
                <Button
                  key={a.id}
                  variant="ghost"
                  onClick={() => {
                    blockUpdate(libraryFor, { text: a.url });
                    setLibraryFor(null);
                  }}
                >
                  <img src={a.url} alt={a.name} />
                  <span>{a.name}</span>
                </Button>
              ))}
          </div>
          {!assets.some((a) => a.workspaceId === workspace?.id && a.type.startsWith("image/")) && (
            <p className="muted">No images in this workspace yet. Upload one in the media library.</p>
          )}
        </Modal>
      )}
      {renaming && (
        <Modal title="Rename document" onClose={() => setRenaming(false)}>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (!renameValue.trim()) return;
              update({ title: renameValue.trim() });
              setRenaming(false);
              toast("Document renamed.");
            }}
          >
            <Field label="Title">
              <Input autoFocus required maxLength={200} value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
            </Field>
            <div className="modal-actions">
              <Button onClick={() => setRenaming(false)}>Cancel</Button>
              <Button type="submit" variant="primary">
                Save
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {infoOpen && (
        <Modal title="Document information" onClose={() => setInfoOpen(false)}>
          <dl className="doc-info">
            <dt>Title</dt>
            <dd>{doc.title || "Untitled"}</dd>
            <dt>Location</dt>
            <dd>
              {[workspace?.name, project?.name, room?.name].filter(Boolean).join(" / ")}
            </dd>
            <dt>Author</dt>
            <dd>{doc.author}</dd>
            <dt>Last edited</dt>
            <dd>{editedLabel(doc.updatedAt)}</dd>
            <dt>Content</dt>
            <dd>
              {doc.blocks.length} blocks · {words} words
            </dd>
            <dt>Visibility</dt>
            <dd>{room ? `Room members of ${room.name}` : "Workspace members"}</dd>
            <dt>Storage</dt>
            <dd>
              Session-only local draft <Badge tone="warning">Not synced</Badge>
            </dd>
            <dt>Collaboration</dt>
            <dd>Real-time co-editing is planned and not connected.</dd>
          </dl>
        </Modal>
      )}
      {deleting && (
        <Confirm
          title={`Delete “${doc.title}”?`}
          description="This removes the document from the current session. Export a Markdown copy first if you want to keep it."
          confirmLabel="Delete document"
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            if (!demo) {
              const response = await fetch(
                `${API_BASE}/documents/${doc.id}`,
                { method: "DELETE", headers: authHeaders() },
              );
              if (!response.ok && response.status !== 404)
                throw new Error(`Delete failed (${response.status})`);
            }
            setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
            toast("Document deleted.");
            if (onBack) onBack();
            else navigate(`${base}/documents`);
          }}
        />
      )}
      {historyOpen && (
        <Modal
          title="Local version snapshots"
          onClose={() => setHistoryOpen(false)}
        >
          <div className="form-stack">
            <Notice>
              Version history is local to this editor session. No server
              versions are available.
            </Notice>
            {!readOnly && (
              <Button
                icon="plus"
                onClick={() => {
                  setVersions((prev) => [structuredClone(doc), ...prev]);
                  toast("Local snapshot created.");
                }}
              >
                Create snapshot
              </Button>
            )}
            {versions.map((v, i) => (
              <div className="snapshot-row" key={i}>
                <span>
                  {new Date(v.updatedAt).toLocaleTimeString()} ·{" "}
                  {v.blocks.length} blocks
                </span>
                {!readOnly && (
                  <Button
                    onClick={() => {
                      update({
                        title: v.title,
                        blocks: structuredClone(v.blocks),
                      });
                      setHistoryOpen(false);
                    }}
                  >
                    Restore
                  </Button>
                )}
              </div>
            ))}
            {!versions.length && <p className="muted small-text">No snapshots yet.</p>}
          </div>
        </Modal>
      )}
      {commentsOpen && (
        <Modal
          title="Local draft comments"
          onClose={() => setCommentsOpen(false)}
        >
          <div className="form-stack">
            <Notice>
              Comments are local notes, not shared with collaborators.
            </Notice>
            {comments.map((c, i) => (
              <p className="local-comment" key={i}>
                {c}
              </p>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (comment.trim()) {
                  setComments((prev) => [...prev, comment.trim()]);
                  setComment("");
                }
              }}
              className="form-stack"
            >
              <Textarea
                required
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                aria-label="Comment"
                placeholder="Leave a note for yourself…"
              />
              <Button variant="primary" type="submit">
                Add local note
              </Button>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}
