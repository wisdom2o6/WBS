import { useEffect, useRef, useState } from "react";
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
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(params.has("create"));
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [roomDocument, setRoomDocument] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const navigate = useNavigate();
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
  if (documentId && !roomId)
    return (
      <EmptyState
        title="Document not found"
        description="This document may belong to another workspace or an earlier demo session."
        action={
          <Link className="btn btn-secondary" to={`${base}/documents`}>
            All documents
          </Link>
        }
      />
    );
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
      <Notice>
        {demo
          ? "Sample documents and local drafts. Editing works in this session; real-time co-editing is not connected."
          : "Document persistence and collaboration are not available on this backend. Documents created here are session-only drafts. Download a copy before leaving."}
      </Notice>
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
        <span className="muted">{items.length} documents</span>
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
              <Badge>Local draft</Badge>
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
      {!items.length && (
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
          title="Create a local document"
          onClose={() => {
            setCreating(false);
            setParams({});
          }}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (!workspace) return;
              const id = crypto.randomUUID();
              const doc: Document = {
                id,
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
              setDocuments((prev) => [...prev, doc]);
              logActivity(
                "created a local document",
                doc.title,
                `/documents/${id}`,
                "file",
              );
              setCreating(false);
              setParams({});
              if (roomId) setRoomDocument(id);
              else navigate(`${base}/documents/${id}`);
            }}
          >
            <Notice>
              This document is a session-only local draft, not a synchronized
              team document.
            </Notice>
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
              <Button type="submit" variant="primary">
                Create document
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {deleteId && (
        <Confirm
          title="Delete this draft?"
          description="This removes the document from the current session."
          onClose={() => setDeleteId("")}
          onConfirm={() => {
            setDocuments((prev) => prev.filter((d) => d.id !== deleteId));
            setDeleteId("");
          }}
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
  const { setDocuments, workspace, base } = useWorkspace();
  const toast = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState("Local draft");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<string[]>([]);
  const [versions, setVersions] = useState<Document[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editor = useRef<HTMLDivElement>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const update = (patch: Partial<Document>) => {
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === doc.id
          ? { ...d, ...patch, updatedAt: new Date().toISOString() }
          : d,
      ),
    );
    setStatus("Updating local draft…");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () => setStatus("Up to date · this session only"),
      600,
    );
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
    toast("Markdown formatting added to this local draft.");
  };
  const download = () => {
    const blob = new Blob(
      [
        `# ${doc.title}\n\n${doc.description}\n\n${doc.blocks.map((b) => `${b.kind.startsWith("heading") ? "#".repeat(Number(b.kind.at(-1))) + " " : b.kind === "bullet" ? "- " : b.kind === "quote" ? "> " : b.kind === "checklist" ? `- [${b.checked ? "x" : " "}] ` : ""}${b.text}`).join("\n\n")}`,
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
          label="Local version snapshots"
          onClick={() => setHistoryOpen(true)}
        />
        <IconButton
          icon="chat"
          label="Local document comments"
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
          Local draft · No live co-editing
        </span>
      </div>
      <div className="document-paper" ref={editor}>
        <div className="document-kicker">
          <Badge>{workspace?.name}</Badge>
          <span>LOCAL DOCUMENT</span>
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
          Changes live in this session only. Export a copy to keep your work.
        </div>
      </div>
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
            <Button
              icon="plus"
              onClick={() => {
                setVersions((prev) => [structuredClone(doc), ...prev]);
                toast("Local snapshot created.");
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
