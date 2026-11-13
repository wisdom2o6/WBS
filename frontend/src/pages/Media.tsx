import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import {
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
  useToast,
} from "../components/ui";
import { Icon } from "../components/Icon";
import {
  PermissionNote,
  PlannedBadge,
  SearchField,
} from "../components/patterns";
import { errorMessage, workspaceService } from "../services/workspace";
import type { Asset } from "../types/workspace";

const API_ORIGIN = "http://localhost:8080";

type Category = "image" | "document" | "video" | "other";
function category(a: { type: string; name: string }): Category {
  if (a.type.startsWith("image/")) return "image";
  if (a.type.startsWith("video/")) return "video";
  if (
    /pdf|word|text|sheet|presentation|markdown/.test(a.type) ||
    /\.(pdf|docx?|txt|md|xlsx?|pptx?|csv)$/i.test(a.name)
  )
    return "document";
  return "other";
}
const ext = (name: string, type: string) =>
  (name.includes(".") ? name.split(".").pop()! : type.split("/")[1] || "file")
    .slice(0, 4)
    .toUpperCase();
function FileType({ asset }: { asset: { name: string; type: string } }) {
  return (
    <span className={`file-type type-${category(asset)}`}>
      {ext(asset.name, asset.type)}
    </span>
  );
}
function formatSize(bytes: number) {
  if (!bytes) return "0 KB";
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
interface UploadItem {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "uploading" | "done" | "failed";
  error?: string;
}

interface RoomFileRecord {
  id: string;
  roomId: string;
  fileName: string;
  fileUrl: string;
  fileType?: string;
  fileSize?: number;
}

export default function Media({ roomId }: { roomId?: string }) {
  const {
    assets,
    setAssets,
    workspace,
    demo,
    logActivity,
    can,
    role,
    documents,
    setDocuments,
    base,
  } = useWorkspace();
  const { token } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | Category>("all");
  const [sort, setSort] = useState("name");
  const [view, setView] = useState("grid");
  const [preview, setPreview] = useState<Asset | null>(null);
  const [renaming, setRenaming] = useState<Asset | null>(null);
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState<Asset | null>(null);
  const [inserting, setInserting] = useState<{
    asset: Asset;
    target: "canvas" | "document";
  } | null>(null);
  const [targetId, setTargetId] = useState("");
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [projectId, setProjectId] = useState(params.get("project") || "");
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  useEffect(() => {
    if (demo || !roomId || !workspace?.id) return;
    let active = true;
    axios
      .get<RoomFileRecord[]>(`${API_ORIGIN}/api/rooms/${roomId}/files`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(({ data }) => {
        if (!active || !Array.isArray(data)) return;
        const roomAssets: Asset[] = data.map((file) => ({
          id: file.id,
          name: file.fileName,
          type: file.fileType || "application/octet-stream",
          size: file.fileSize || 0,
          workspaceId: workspace.id,
          roomId: file.roomId,
          url: file.fileUrl,
        }));
        setAssets((prev) => [
          ...prev.filter((asset) => asset.roomId !== roomId),
          ...roomAssets,
        ]);
      })
      .catch((error) =>
        toast(`Room files could not be loaded: ${errorMessage(error)}`, true),
      );
    return () => {
      active = false;
    };
  }, [demo, roomId, setAssets, token, toast, workspace?.id]);
  const scoped = assets.filter(
    (a) => a.workspaceId === workspace?.id && (!roomId || a.roomId === roomId),
  );
  const items = scoped
    .filter(
      (a) =>
        (!projectId || a.projectId === projectId) &&
        a.name.toLowerCase().includes(query.toLowerCase()) &&
        (type === "all" || category(a) === type),
    )
    .toSorted((a, b) =>
      sort === "size" ? b.size - a.size : a.name.localeCompare(b.name),
    );
  const busy = uploads.some((u) => u.status === "uploading");
  const patchUpload = (id: string, patch: Partial<UploadItem>) =>
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  const uploadFiles = async (files: FileList | File[]) => {
    if (!workspace || !can.create) return;
    const list = Array.from(files);
    const queue = list.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      size: f.size,
      progress: 0,
      status: "uploading" as const,
    }));
    setUploads((prev) => [...queue, ...prev.filter((u) => u.status === "uploading")]);
    for (const [i, file] of list.entries()) {
      const item = queue[i];
      try {
        if (file.size > 20 * 1024 * 1024)
          throw new Error("Exceeds the 20 MB limit.");
        let url: string;
        if (demo) {
          patchUpload(item.id, { progress: 0.6 });
          url = URL.createObjectURL(file);
        } else if (roomId) {
          const form = new FormData();
          form.append("file", file);
          const response = await axios.post<RoomFileRecord>(
            `${API_ORIGIN}/api/rooms/${roomId}/files`,
            form,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "multipart/form-data",
              },
              onUploadProgress: (event) =>
                patchUpload(item.id, {
                  progress: event.total ? event.loaded / event.total : 0,
                }),
            },
          );
          const record = response.data;
          url = record.fileUrl;
        } else
          url = (
            await workspaceService.upload(file, (p) =>
              patchUpload(item.id, { progress: p }),
            )
          ).url;
        const asset: Asset = {
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          workspaceId: workspace.id,
          projectId: roomId
            ? workspace.projects.find((p) =>
                p.rooms.some((r) => r.id === roomId),
              )?.id
            : projectId || undefined,
          roomId,
          url,
        };
        setAssets((prev) => [...prev, asset]);
        patchUpload(item.id, { progress: 1, status: "done" });
        logActivity(
          demo ? "added a local file" : "uploaded",
          file.name,
          "/media",
          "upload",
        );
      } catch (err) {
        patchUpload(item.id, { status: "failed", error: errorMessage(err) });
      }
    }
    if (input.current) input.current.value = "";
  };
  const download = async (asset: Asset) => {
    try {
      const response = await fetch(asset.url);
      if (!response.ok) throw new Error("Download failed.");
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = asset.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast(
        "Unable to download this file. Check that the file server permits access.",
        true,
      );
    }
  };
  const totals = (["image", "document", "video", "other"] as Category[]).map(
    (c) => ({
      c,
      size: scoped.filter((a) => category(a) === c).reduce((n, a) => n + a.size, 0),
      count: scoped.filter((a) => category(a) === c).length,
    }),
  );
  const totalSize = totals.reduce((n, t) => n + t.size, 0);
  const rooms = workspace?.projects.flatMap((p) =>
    p.rooms.map((r) => ({ ...r, project: p.name })),
  );
  const docs = documents.filter((d) => d.workspaceId === workspace?.id);
  const openInsert = (asset: Asset, target: "canvas" | "document") => {
    setPreview(null);
    setTargetId(
      target === "canvas"
        ? roomId || asset.roomId || rooms?.[0]?.id || ""
        : docs[0]?.id || "",
    );
    setInserting({ asset, target });
  };
  return (
    <div className={roomId ? "room-resource-page" : "page"}>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ALL THE PIECES, IN ONE PLACE</div>
          <Heading level={1}>
            {roomId ? "Shared files" : "Media library"}
            <span className="blue-text">.</span>
          </Heading>
          <p>A considered collection of everything you create with.</p>
        </div>
        {can.create && (
          <Button
            variant="primary"
            icon="upload"
            disabled={!workspace}
            loading={busy}
            onClick={() => input.current?.click()}
          >
            {busy ? "Uploading…" : "Upload files"}
          </Button>
        )}
      </div>
      <div className="media-module-status">
        <PlannedBadge label="Beta" />
        <span>
          {demo
            ? "Sample references and local uploads. Files you add remain in this browser session only."
            : roomId
              ? "Room files are uploaded, indexed and restored from PostgreSQL. Library labels remain session metadata."
              : "Workspace uploads use the file endpoint. Workspace/project associations and labels remain session metadata."}
        </span>
      </div>
      <div className="media-overview">
        {can.create ? (
          <div
            className={`upload-dropzone ${dragging ? "dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void uploadFiles(e.dataTransfer.files);
            }}
          >
            <span className="upload-symbol">
              <Icon name="upload" size={23} />
            </span>
            <div>
              <strong>
                {dragging
                  ? "Release to upload"
                  : busy
                    ? "Adding your files…"
                    : "Drop your files here, or browse"}
              </strong>
              <span>
                Images, documents, and the building blocks of your next idea.
                Up to 20 MB per file.
              </span>
            </div>
            <Button onClick={() => input.current?.click()} disabled={busy}>
              Browse files
            </Button>
          </div>
        ) : (
          <PermissionNote role={role}>
            You can browse and download files. Uploading requires the Member
            role.
          </PermissionNote>
        )}
        <aside className="storage-card" aria-label="Storage">
          <div>
            <Icon name="storage" size={16} />
            <strong>Storage</strong>
            <span>{formatSize(totalSize)}</span>
          </div>
          <div className="storage-bar" aria-hidden="true">
            {totals
              .filter((t) => t.size)
              .map((t) => (
                <i
                  key={t.c}
                  className={`type-${t.c}`}
                  style={{ width: `${(t.size / Math.max(1, totalSize)) * 100}%` }}
                />
              ))}
          </div>
          <ul>
            {totals.map((t) => (
              <li key={t.c}>
                <i className={`type-${t.c}`} />
                {t.c === "image"
                  ? "Images"
                  : t.c === "document"
                    ? "Documents"
                    : t.c === "video"
                      ? "Video"
                      : "Other"}
                <span>
                  {t.count} · {formatSize(t.size)}
                </span>
              </li>
            ))}
          </ul>
          <small>
            {demo
              ? "Sample totals for this session."
              : "Quota is not reported by the backend yet."}
          </small>
        </aside>
      </div>
      <Input
        ref={input}
        type="file"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose files"
        onChange={(e) => {
          if (e.target.files) void uploadFiles(e.target.files);
        }}
      />
      {uploads.length > 0 && (
        <div className="upload-queue" aria-live="polite">
          <div className="upload-queue-head">
            <strong>
              {busy
                ? `Uploading ${uploads.filter((u) => u.status === "uploading").length} file(s)…`
                : `${uploads.filter((u) => u.status === "done").length} uploaded${uploads.some((u) => u.status === "failed") ? ` · ${uploads.filter((u) => u.status === "failed").length} failed` : ""}`}
            </strong>
            {!busy && (
              <Button variant="ghost" onClick={() => setUploads([])}>
                Clear
              </Button>
            )}
          </div>
          {uploads.map((u) => (
            <div key={u.id} className={`upload-row ${u.status}`}>
              <FileType asset={{ name: u.name, type: "" }} />
              <span className="upload-row-copy">
                <strong>{u.name}</strong>
                <small>
                  {u.status === "failed"
                    ? u.error
                    : u.status === "done"
                      ? `${formatSize(u.size)} · ${demo ? "Added locally" : "Uploaded"}`
                      : `${formatSize(u.size)} · ${Math.round(u.progress * 100)}%`}
                </small>
                {u.status === "uploading" && (
                  <span className="upload-progress">
                    <i style={{ width: `${Math.max(6, u.progress * 100)}%` }} />
                  </span>
                )}
              </span>
              <Icon
                name={
                  u.status === "done"
                    ? "check"
                    : u.status === "failed"
                      ? "alert"
                      : "upload"
                }
                size={15}
              />
            </div>
          ))}
        </div>
      )}
      <div className="list-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search files…"
          label="Search files"
        />
        <div className="segmented" role="tablist" aria-label="File type">
          {(["all", "image", "document", "other"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={type === t}
              className={type === t ? "active" : ""}
              onClick={() => setType(t)}
            >
              {t === "all"
                ? "All"
                : t === "image"
                  ? "Images"
                  : t === "document"
                    ? "Documents"
                    : "Other"}
            </button>
          ))}
        </div>
        {!roomId && (
          <Select
            aria-label="Filter project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">All projects</option>
            {workspace?.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        )}
        <Select
          aria-label="Sort files"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="name">Name A–Z</option>
          <option value="size">Largest first</option>
        </Select>
        <div className="view-toggle">
          <IconButton
            icon="grid"
            label="Gallery view"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          />
          <IconButton
            icon="list"
            label="File list view"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          />
        </div>
      </div>
      <div className={`media-gallery ${view === "list" ? "media-list" : ""}`}>
        {items.map((asset, i) => (
          <article className={`asset-card asset-${i % 3}`} key={asset.id}>
            <Button
              variant="ghost"
              className="asset-preview"
              onClick={() => setPreview(asset)}
              aria-label={`Preview ${asset.name}`}
            >
              {asset.type.startsWith("image/") ? (
                <img src={asset.url} alt={asset.name} loading="lazy" />
              ) : (
                <Icon name={category(asset) === "video" ? "video" : "file"} size={42} />
              )}
              <FileType asset={asset} />
            </Button>
            <div className="asset-info">
              <strong>{asset.name}</strong>
              <small>
                {formatSize(asset.size)} ·{" "}
                {workspace?.projects.find((p) => p.id === asset.projectId)
                  ?.name || "Workspace"}
              </small>
              <div>
                <IconButton
                  icon="download"
                  label={`Download ${asset.name}`}
                  onClick={() => void download(asset)}
                />
                {can.edit && (
                  <>
                    <IconButton
                      icon="edit"
                      label={`Rename ${asset.name}`}
                      onClick={() => {
                        setRenaming(asset);
                        setName(asset.name);
                      }}
                    />
                    <IconButton
                      icon="trash"
                      label={`Remove ${asset.name}`}
                      onClick={() => setDeleting(asset)}
                    />
                  </>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {!items.length && (
        <EmptyState
          icon={query || type !== "all" ? "search" : "image"}
          title={
            query || type !== "all"
              ? "No matching files"
              : "Make this collection yours"
          }
          description={
            query || type !== "all"
              ? "Try another keyword or file type."
              : "Upload a reference, a document, or an image to get started."
          }
        />
      )}
      {preview && (
        <Modal title={preview.name} onClose={() => setPreview(null)} wide>
          <div className="asset-modal-preview">
            {preview.type.startsWith("image/") ? (
              <img src={preview.url} alt={preview.name} />
            ) : (
              <Icon name="file" size={64} />
            )}
          </div>
          <div className="asset-metadata">
            <div>
              <span>FILE TYPE</span>
              <strong>
                <FileType asset={preview} /> {preview.type}
              </strong>
            </div>
            <div>
              <span>SIZE</span>
              <strong>{formatSize(preview.size)}</strong>
            </div>
            <div>
              <span>WORKSPACE</span>
              <strong>{workspace?.name}</strong>
            </div>
            <div>
              <span>PROJECT</span>
              <strong>
                {workspace?.projects.find((p) => p.id === preview.projectId)
                  ?.name || "Workspace asset"}
              </strong>
            </div>
          </div>
          {preview.attribution && (
            <p className="muted small-text">
              Photography: {preview.attribution}. Sample reference asset.
            </p>
          )}
          <div className="asset-integrations">
            <span className="eyebrow">USE THIS FILE</span>
            <div>
              <Button
                icon="frame"
                disabled={!can.edit || category(preview) !== "image"}
                onClick={() => openInsert(preview, "canvas")}
              >
                Insert into canvas
              </Button>
              <Button
                icon="file"
                disabled={!can.edit || category(preview) !== "image" || !docs.length}
                onClick={() => openInsert(preview, "document")}
              >
                Insert into document
              </Button>
              <Button icon="chat" disabled title="Chat attachments are planned">
                Send to chat
                <PlannedBadge />
              </Button>
            </div>
            {category(preview) !== "image" && (
              <p className="muted small-text">
                Only images can be placed on a canvas or in a document.
              </p>
            )}
          </div>
          <div className="modal-actions">
            <span className="muted small-text">
              Usage tracking is not available on the current backend.
            </span>
            <Button icon="download" onClick={() => void download(preview)}>
              Download original
            </Button>
          </div>
        </Modal>
      )}
      {inserting && (
        <Modal
          title={
            inserting.target === "canvas"
              ? "Insert into a canvas"
              : "Insert into a document"
          }
          onClose={() => setInserting(null)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (!targetId) return;
              const { asset } = inserting;
              if (inserting.target === "canvas") {
                navigate(`${base}/room/${targetId}`, {
                  state: { insertAsset: { url: asset.url, name: asset.name } },
                });
              } else {
                setDocuments((prev) =>
                  prev.map((d) =>
                    d.id === targetId
                      ? {
                          ...d,
                          updatedAt: new Date().toISOString(),
                          blocks: [
                            ...d.blocks,
                            { id: crypto.randomUUID(), kind: "image", text: asset.url },
                          ],
                        }
                      : d,
                  ),
                );
                toast(`${asset.name} added to the document.`);
                navigate(`${base}/documents/${targetId}`);
              }
              setInserting(null);
            }}
          >
            <div className="insert-preview">
              <img src={inserting.asset.url} alt="" />
              <span>
                <strong>{inserting.asset.name}</strong>
                <small>{formatSize(inserting.asset.size)}</small>
              </span>
            </div>
            <Field
              label={inserting.target === "canvas" ? "Room canvas" : "Document"}
              hint={
                inserting.target === "canvas"
                  ? "The image is placed in the centre of the current view."
                  : "The image is added as the last block."
              }
            >
              <Select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                required
              >
                {inserting.target === "canvas"
                  ? rooms?.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.project} · {r.name}
                      </option>
                    ))
                  : docs.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
              </Select>
            </Field>
            <div className="modal-actions">
              <Button onClick={() => setInserting(null)}>Cancel</Button>
              <Button type="submit" variant="primary" icon="arrow">
                Insert and open
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {renaming && (
        <Modal title="Rename file" onClose={() => setRenaming(null)}>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              setAssets((prev) =>
                prev.map((a) =>
                  a.id === renaming.id ? { ...a, name: name.trim() } : a,
                ),
              );
              setRenaming(null);
              toast("File label updated in this session.");
            }}
          >
            <Field
              label="File name"
              hint={demo ? undefined : "Renaming changes the library label only."}
            >
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <div className="modal-actions">
              <Button onClick={() => setRenaming(null)}>Cancel</Button>
              <Button variant="primary" type="submit">
                Save label
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && (
        <Confirm
          title={`Remove ${deleting.name}?`}
          description={
            !demo && deleting.roomId
              ? "This removes the file record from the room backend and from the library."
              : "This removes the session library reference only."
          }
          confirmLabel="Remove from library"
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            if (!demo && deleting.roomId)
              await axios.delete(
                `${API_ORIGIN}/api/rooms/${deleting.roomId}/files/${deleting.id}`,
                { headers: { Authorization: `Bearer ${token}` } },
              );
            setAssets((prev) => prev.filter((a) => a.id !== deleting.id));
            if (deleting.url.startsWith("blob:"))
              URL.revokeObjectURL(deleting.url);
            setDeleting(null);
            toast(`${deleting.name} removed from the library.`);
          }}
        />
      )}
      {!demo && !roomId && (
        <Notice>
          Files are served from the configured WBS file endpoint. Library
          metadata resets when you reload.
        </Notice>
      )}
    </div>
  );
}
