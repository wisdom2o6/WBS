import { useEffect, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { useWorkspace } from "../context/WorkspaceContext";
import {
  Avatar,
  Badge,
  Button,
  Confirm,
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
import type { Block, BlockKind, Document } from "../types/workspace";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080/api/v1";
const WS_URL = import.meta.env.VITE_WS_URL || "http://localhost:8080/ws";

// ID định danh riêng cho tab trình duyệt hiện tại để tránh tự nhận lại event của chính mình
const TAB_CLIENT_ID = crypto.randomUUID();

function getAuthHeaders(): HeadersInit {
  const token =
    localStorage.getItem("token") || localStorage.getItem("accessToken");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const blockNames: Record<BlockKind, string> = {
  paragraph: "Paragraph",
  heading1: "Heading 1",
  heading2: "Heading 2",
  heading3: "Heading 3",
  bullet: "Bullet list",
  numbered: "Numbered list",
  checklist: "Checklist",
  quote: "Quote",
  code: "Code block",
  image: "Image URL",
  table: "Table",
  divider: "Divider",
  canvas: "Embed canvas",
};

export default function Documents({ roomId }: { roomId?: string }) {
  const { documentId } = useParams();
  const { documents, setDocuments, workspace, base, demo, logActivity } =
    useWorkspace();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(params.has("create"));
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [roomDocument, setRoomDocument] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const navigate = useNavigate();

  // 1. Tải danh sách tài liệu từ Backend khi vào Workspace hoặc Room
  useEffect(() => {
    if (demo || !workspace?.id) return;

    let cancelled = false;
    const fetchDocuments = async () => {
      setLoading(true);
      try {
        const url = new URL(
          `${API_BASE}/workspaces/${workspace.id}/documents`,
        );
        if (roomId) url.searchParams.set("roomId", roomId);

        const res = await fetch(url.toString(), {
          headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Document[] = await res.json();

        if (!cancelled) {
          setDocuments((prev) => {
            const others = prev.filter(
              (d) =>
                d.workspaceId !== workspace.id ||
                (roomId && d.roomId !== roomId),
            );
            return [...others, ...data];
          });
        }
      } catch (err) {
        console.error("Failed to load documents:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchDocuments();
    return () => {
      cancelled = true;
    };
  }, [demo, workspace?.id, roomId, setDocuments]);

  const currentId = roomId ? roomDocument : documentId;
  const current = documents.find(
    (d) =>
      d.id === currentId &&
      d.workspaceId === workspace?.id &&
      (!roomId || d.roomId === roomId),
  );
  const items = documents.filter(
    (d) =>
      d.workspaceId === workspace?.id &&
      (!roomId || d.roomId === roomId) &&
      d.title.toLowerCase().includes(query.toLowerCase()),
  );

  if (current)
    return (
      <DocumentEditor
        document={current}
        onBack={roomId ? () => setRoomDocument("") : undefined}
      />
    );

  if (documentId && !roomId && !loading)
    return (
      <EmptyState
        title="Document not found"
        description="This document may belong to another workspace or has been deleted."
        action={
          <Link className="btn btn-secondary" to={`${base}/documents`}>
            All documents
          </Link>
        }
      />
    );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || submitting) return;

    const projectId =
      params.get("project") ||
      workspace.projects.find((p) => p.rooms.some((r) => r.id === roomId))?.id;

    const initialBlocks: Block[] = [
      { id: crypto.randomUUID(), kind: "paragraph", text: "" },
    ];

    if (demo) {
      const id = crypto.randomUUID();
      const doc: Document = {
        id,
        title: title.trim(),
        description: "",
        author: "Alex Morgan",
        workspaceId: workspace.id,
        projectId,
        roomId,
        updatedAt: new Date().toISOString(),
        blocks: initialBlocks,
      };
      setDocuments((prev) => [...prev, doc]);
      finishCreate(id, doc.title);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `${API_BASE}/workspaces/${workspace.id}/documents`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            title: title.trim(),
            description: "",
            projectId: projectId || null,
            roomId: roomId || null,
            blocks: initialBlocks,
          }),
        },
      );
      if (!res.ok) throw new Error(`Create failed (${res.status})`);
      const created: Document = await res.json();
      setDocuments((prev) => [...prev, created]);
      finishCreate(created.id, created.title);
    } catch (err) {
      console.error(err);
      toast("Không thể tạo tài liệu trên server.");
    } finally {
      setSubmitting(false);
    }
  };

  const finishCreate = (id: string, docTitle: string) => {
    logActivity("created a document", docTitle, `/documents/${id}`, "file");
    setTitle("");
    setCreating(false);
    setParams({});
    if (roomId) setRoomDocument(id);
    else navigate(`${base}/documents/${id}`);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const targetId = deleteId;
    setDeleteId("");

    if (!demo) {
      try {
        const res = await fetch(`${API_BASE}/documents/${targetId}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      } catch (err) {
        console.error(err);
        toast("Xóa tài liệu thất bại.");
        return;
      }
    }

    setDocuments((prev) => prev.filter((d) => d.id !== targetId));
    toast("Đã xóa tài liệu.");
  };

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
        <Button
          variant="primary"
          icon="plus"
          disabled={!workspace}
          onClick={() => setCreating(true)}
        >
          New document
        </Button>
      </div>

      {demo && (
        <Notice>
          Sample documents and local drafts. Editing works in this session;
          real-time co-editing is disabled in demo mode.
        </Notice>
      )}

      <div className="list-toolbar">
        <div className="search-input">
          <Icon name="search" />
          <Input
            placeholder="Search documents…"
            aria-label="Search documents"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <span className="muted">
          {loading ? "Loading…" : `${items.length} documents`}
        </span>
      </div>

      <div className="document-list">
        {items.map((d) => (
          <div key={d.id}>
            <Button
              variant="ghost"
              className="document-list-link"
              onClick={() =>
                roomId
                  ? setRoomDocument(d.id)
                  : navigate(`${base}/documents/${d.id}`)
              }
            >
              <span className="document-icon">
                <Icon name="file" size={22} />
              </span>
              <span>
                <strong>{d.title}</strong>
                <small>{d.description || "A new page of possibilities."}</small>
              </span>
              <Badge>{demo ? "Local draft" : "Synced"}</Badge>
              <span className="muted small-text">{d.author}</span>
              <Icon name="chevron" size={16} />
            </Button>
            <IconButton
              icon="trash"
              label={`Delete ${d.title}`}
              onClick={() => setDeleteId(d.id)}
            />
          </div>
        ))}
      </div>

      {!loading && !items.length && (
        <EmptyState
          icon="file"
          title="Give your ideas a home"
          description="Start with a blank page. Add headings, checklists, images, and a little clarity."
          action={
            <Button icon="plus" onClick={() => setCreating(true)}>
              Create document
            </Button>
          }
        />
      )}

      {(creating || params.has("create")) && (
        <Modal
          title={demo ? "Create a local document" : "Create a shared document"}
          onClose={() => {
            setCreating(false);
            setParams({});
          }}
        >
          <form className="form-stack" onSubmit={handleCreate}>
            <Field label="Document title">
              <Input
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Untitled idea"
                autoFocus
              />
            </Field>
            <div className="modal-actions">
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? "Creating…" : "Create document"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {deleteId && (
        <Confirm
          title="Delete this document?"
          description={
            demo
              ? "This removes the document from the current session."
              : "This permanently deletes the document for all workspace members."
          }
          onClose={() => setDeleteId("")}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

function DocumentEditor({
  document: doc,
  onBack,
}: {
  document: Document;
  onBack?: () => void;
}) {
  const { setDocuments, workspace, base, demo } = useWorkspace();
  const toast = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState(demo ? "Local draft" : "Synced");
  const [liveConnected, setLiveConnected] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<string[]>([]);
  const [versions, setVersions] = useState<Document[]>([]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stompRef = useRef<Client | null>(null);
  const latestDocRef = useRef<Document>(doc);
  const editor = useRef<HTMLDivElement>(null);

  latestDocRef.current = doc;

  // 2. Kết nối WebSocket STOMP để đồng bộ Real-time giữa các thành viên
  useEffect(() => {
    if (demo) return;

    const token =
      localStorage.getItem("token") || localStorage.getItem("accessToken");
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      reconnectDelay: 3000,
      onConnect: () => {
        setLiveConnected(true);
        client.subscribe(`/topic/doc.${doc.id}`, (frame) => {
          try {
            const payload = JSON.parse(frame.body);
            // Bỏ qua gói tin do chính tab này gửi lên
            if (payload.senderId === TAB_CLIENT_ID) return;

            setDocuments((prev) =>
              prev.map((d) =>
                d.id === doc.id
                  ? {
                      ...d,
                      title: payload.title ?? d.title,
                      description: payload.description ?? d.description,
                      blocks: payload.blocks ?? d.blocks,
                      updatedAt: payload.updatedAt || new Date().toISOString(),
                    }
                  : d,
              ),
            );
            setStatus("Updated by collaborator");
          } catch (e) {
            console.error("Invalid STOMP document payload:", e);
          }
        });
      },
      onDisconnect: () => setLiveConnected(false),
      onStompError: () => setLiveConnected(false),
    });

    client.activate();
    stompRef.current = client;

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      client.deactivate();
      stompRef.current = null;
    };
  }, [demo, doc.id, setDocuments]);

  // 3. Cập nhật state + Broadcast STOMP ngay lập tức + Debounce lưu DB
  const update = (patch: Partial<Document>) => {
    const nextDoc: Document = {
      ...latestDocRef.current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    setDocuments((prev) =>
      prev.map((d) => (d.id === doc.id ? nextDoc : d)),
    );

    if (demo) {
      setStatus("Updating local draft…");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(
        () => setStatus("Up to date · this session only"),
        600,
      );
      return;
    }

    // Gửi real-time cho các thành viên khác đang mở cùng document
    if (stompRef.current?.connected) {
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
    }

    // Debounce lưu xuống PostgreSQL sau 600ms ngừng gõ
    setStatus("Saving…");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/documents/${doc.id}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            title: nextDoc.title,
            description: nextDoc.description,
            blocks: nextDoc.blocks,
          }),
        });
        if (!res.ok) throw new Error(`Save failed (${res.status})`);
        setStatus("Saved to cloud");
      } catch (err) {
        console.error(err);
        setStatus("Save failed · retrying on next edit");
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

  const addBlock = (kind: BlockKind = "paragraph") => {
    const block: Block = {
      id: crypto.randomUUID(),
      kind,
      text:
        kind === "table"
          ? "Column one | Column two\nValue one | Value two"
          : "",
    };
    const index = doc.blocks.findIndex((b) => b.id === selected);
    const blocks = [...doc.blocks];
    blocks.splice(index < 0 ? blocks.length : index + 1, 0, block);
    update({ blocks });
    setSelected(block.id);
  };

  const format = (marker: string) => {
    const field = editor.current?.querySelector<HTMLTextAreaElement>(
      `[data-block="${selected}"]`,
    );
    if (!field || !selected) {
      toast("Select a text block first.");
      return;
    }
    const start = field.selectionStart,
      end = field.selectionEnd,
      value = field.value;
    blockUpdate(selected, {
      text:
        value.slice(0, start) +
        marker +
        value.slice(start, end) +
        marker +
        value.slice(end),
    });
  };

  const download = () => {
    const blob = new Blob(
      [
        `# ${doc.title}\n\n${doc.description}\n\n${doc.blocks
          .map(
            (b) =>
              `${
                b.kind.startsWith("heading")
                  ? "#".repeat(Number(b.kind.at(-1))) + " "
                  : b.kind === "bullet"
                    ? "- "
                    : b.kind === "quote"
                      ? "> "
                      : b.kind === "checklist"
                        ? `- [${b.checked ? "x" : " "}] `
                        : ""
              }${b.text}`,
          )
          .join("\n\n")}`,
      ],
      { type: "text/markdown" },
    );
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${doc.title}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="document-editor">
      <div className="document-topbar">
        {onBack ? (
          <Button variant="ghost" icon="file" onClick={onBack}>
            Room documents
          </Button>
        ) : (
          <Link className="text-link" to={`${base}/documents`}>
            <Icon name="file" size={16} />
            Documents
          </Link>
        )}
        <Icon name="chevron" size={12} />
        <span className="doc-top-title">{doc.title}</span>
        <span className="document-save-status">
          <span className="status-dot" />
          {status}
        </span>
        <IconButton
          icon="clock"
          label="Version snapshots"
          onClick={() => setHistoryOpen(true)}
        />
        <IconButton
          icon="chat"
          label="Document comments"
          onClick={() => setCommentsOpen(true)}
        />
        <Button icon="download" onClick={download}>
          Export
        </Button>
      </div>

      <div className="formatting-toolbar">
        <Button
          variant="ghost"
          onClick={() => format("**")}
          title="Add Markdown bold"
        >
          <b>B</b>
        </Button>
        <Button
          variant="ghost"
          onClick={() => format("_")}
          title="Add Markdown italic"
        >
          <i>I</i>
        </Button>
        <span className="toolbar-divider" />
        <Select
          aria-label="Add block type"
          value=""
          onChange={(e) => addBlock(e.target.value as BlockKind)}
        >
          <option value="" disabled>
            Add a block…
          </option>
          {Object.entries(blockNames).map(([kind, label]) => (
            <option key={kind} value={kind}>
              {label}
            </option>
          ))}
        </Select>
        <span className="small-text muted">
          {demo
            ? "Local draft · No live co-editing"
            : liveConnected
              ? "Live co-editing connected"
              : "Connecting live sync…"}
        </span>
      </div>

      <div className="document-paper" ref={editor}>
        <div className="document-kicker">
          <Badge>{workspace?.name}</Badge>
          <span>{demo ? "LOCAL DOCUMENT" : "COLLABORATIVE DOCUMENT"}</span>
        </div>
        <Input
          className="document-title"
          aria-label="Document title"
          value={doc.title}
          onChange={(e) => update({ title: e.target.value })}
        />
        <Textarea
          className="document-description"
          aria-label="Document description"
          value={doc.description}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="Add a description…"
          rows={1}
        />
        <div className="document-byline">
          <Avatar name={doc.author} size="small" />
          <span>{doc.author}</span>
          <span>·</span>
          <span>
            Edited{" "}
            {new Date(doc.updatedAt).toLocaleString("en", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>

        <div className="document-blocks">
          {doc.blocks.map((block, index) => (
            <div
              className={`document-block block-${block.kind} ${selected === block.id ? "block-selected" : ""}`}
              key={block.id}
              onFocus={() => setSelected(block.id)}
            >
              <div className="block-controls">
                <IconButton
                  icon="plus"
                  label="Add block after this one"
                  onClick={() => {
                    setSelected(block.id);
                    const blocks = [...doc.blocks];
                    blocks.splice(index + 1, 0, {
                      id: crypto.randomUUID(),
                      kind: "paragraph",
                      text: "",
                    });
                    update({ blocks });
                  }}
                />
                <Icon name="drag" size={14} />
              </div>

              {block.kind === "divider" ? (
                <hr />
              ) : block.kind === "canvas" ? (
                <div className="canvas-embed">
                  <Icon name="frame" size={22} />
                  <div>
                    <strong>Canvas reference</strong>
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
                  <Input
                    type="url"
                    aria-label="Image URL"
                    placeholder="https://… image URL"
                    value={block.text}
                    onChange={(e) =>
                      blockUpdate(block.id, { text: e.target.value })
                    }
                  />
                  {/^https?:\/\//.test(block.text) && (
                    <img src={block.text} alt="Document image" />
                  )}
                </div>
              ) : (
                <>
                  <span className="block-prefix">
                    {block.kind === "bullet" ? (
                      "•"
                    ) : block.kind === "numbered" ? (
                      `${index - doc.blocks.slice(0, index).findLastIndex((b) => b.kind !== "numbered")}.`
                    ) : block.kind === "checklist" ? (
                      <Input
                        type="checkbox"
                        checked={!!block.checked}
                        onChange={(e) =>
                          blockUpdate(block.id, { checked: e.target.checked })
                        }
                        aria-label="Check item"
                      />
                    ) : null}
                  </span>
                  <Textarea
                    data-block={block.id}
                    aria-label={`${blockNames[block.kind]} block`}
                    value={block.text}
                    placeholder={
                      block.kind === "table"
                        ? "Use | to separate columns"
                        : `${blockNames[block.kind]}…`
                    }
                    rows={Math.max(
                      1,
                      block.text.split("\n").length +
                        (block.text.length > 100
                          ? Math.ceil(block.text.length / 90) - 1
                          : 0),
                    )}
                    onChange={(e) =>
                      blockUpdate(block.id, { text: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                        e.preventDefault();
                        addBlock();
                      }
                    }}
                  />
                  {block.kind === "table" && (
                    <table className="doc-table">
                      <tbody>
                        {block.text.split("\n").map((row, ri) => (
                          <tr key={ri}>
                            {row
                              .split("|")
                              .map((cell, ci) =>
                                ri === 0 ? (
                                  <th key={ci}>{cell}</th>
                                ) : (
                                  <td key={ci}>{cell}</td>
                                ),
                              )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}

              {selected === block.id && (
                <div className="block-actions">
                  <Select
                    aria-label="Change block type"
                    value={block.kind}
                    onChange={(e) =>
                      blockUpdate(block.id, {
                        kind: e.target.value as BlockKind,
                      })
                    }
                  >
                    {Object.entries(blockNames).map(([kind, label]) => (
                      <option key={kind} value={kind}>
                        {label}
                      </option>
                    ))}
                  </Select>
                  <IconButton
                    icon="undo"
                    label="Move block up"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  />
                  <IconButton
                    icon="redo"
                    label="Move block down"
                    disabled={index === doc.blocks.length - 1}
                    onClick={() => move(index, 1)}
                  />
                  <IconButton
                    icon="copy"
                    label="Duplicate block"
                    onClick={() => {
                      const blocks = [...doc.blocks];
                      blocks.splice(index + 1, 0, {
                        ...block,
                        id: crypto.randomUUID(),
                      });
                      update({ blocks });
                    }}
                  />
                  <IconButton
                    icon="trash"
                    label="Delete block"
                    onClick={() =>
                      update({
                        blocks: doc.blocks.filter((b) => b.id !== block.id),
                      })
                    }
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <Button
          variant="ghost"
          icon="plus"
          className="add-block-button"
          onClick={() => addBlock()}
        >
          Add a block
        </Button>

        <div className="document-footnote">
          <Icon name="info" size={14} />
          {demo
            ? "Changes live in this session only. Export a copy to keep your work."
            : "Changes are automatically saved and synced with your workspace."}
        </div>
      </div>

      {historyOpen && (
        <Modal
          title="Version snapshots"
          onClose={() => setHistoryOpen(false)}
        >
          <div className="form-stack">
            <Button
              icon="plus"
              onClick={() => {
                setVersions((prev) => [structuredClone(doc), ...prev]);
                toast("Snapshot created.");
              }}
            >
              Create snapshot
            </Button>
            {versions.map((v, i) => (
              <div className="snapshot-row" key={i}>
                <span>
                  {new Date(v.updatedAt).toLocaleTimeString()} ·{" "}
                  {v.blocks.length} blocks
                </span>
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
              </div>
            ))}
          </div>
        </Modal>
      )}

      {commentsOpen && (
        <Modal
          title="Document notes"
          onClose={() => setCommentsOpen(false)}
        >
          <div className="form-stack">
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
                placeholder="Leave a note…"
              />
              <Button variant="primary" type="submit">
                Add note
              </Button>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}