import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import { errorMessage, workspaceService } from "../services/workspace";
import type { Asset } from "../types/workspace";

export default function Media({ roomId }: { roomId?: string }) {
  const { assets, setAssets, workspace, demo, logActivity } = useWorkspace();
  const [params] = useSearchParams();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("name");
  const [view, setView] = useState("grid");
  const [preview, setPreview] = useState<Asset | null>(null);
  const [renaming, setRenaming] = useState<Asset | null>(null);
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState<Asset | null>(null);
  const [upload, setUpload] = useState<{
    status: "idle" | "uploading" | "success" | "failed";
    message: string;
  }>({ status: "idle", message: "" });
  const [dragging, setDragging] = useState(false);
  const [projectId, setProjectId] = useState(params.get("project") || "");
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const items = assets
    .filter(
      (a) =>
        a.workspaceId === workspace?.id &&
        (!roomId || a.roomId === roomId) &&
        (!projectId || a.projectId === projectId) &&
        a.name.toLowerCase().includes(query.toLowerCase()) &&
        (type === "all" ||
          (type === "image"
            ? a.type.startsWith("image/")
            : !a.type.startsWith("image/"))),
    )
    .toSorted((a, b) =>
      sort === "size" ? b.size - a.size : a.name.localeCompare(b.name),
    );
  const uploadFiles = async (files: FileList | File[]) => {
    if (!workspace || upload.status === "uploading") return;
    setUpload({ status: "uploading", message: "Preparing your files…" });
    try {
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024)
          throw new Error(`${file.name} exceeds the 20 MB frontend limit.`);
        const url = demo
          ? URL.createObjectURL(file)
          : (await workspaceService.upload(file)).url;
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
        logActivity(
          demo ? "added a local file" : "uploaded",
          file.name,
          "/media",
          "upload",
        );
      }
      setUpload({
        status: "success",
        message: demo
          ? "Files added to this demo session. Nothing was uploaded to a server."
          : "Files uploaded. Library metadata is session-only; the backend has no asset indexing endpoint.",
      });
    } catch (err) {
      setUpload({ status: "failed", message: errorMessage(err) });
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
        <Button
          variant="primary"
          icon="upload"
          disabled={!workspace || upload.status === "uploading"}
          onClick={() => input.current?.click()}
        >
          Upload files
        </Button>
      </div>
      <Notice>
        {demo
          ? "Sample references and local uploads. Files you add remain in this browser session only."
          : "Upload uses the existing WBS file endpoint. Workspace/project associations, renaming and library removal are session-only metadata; the backend does not index or delete stored files."}
      </Notice>
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
            {upload.status === "uploading"
              ? "Adding your files…"
              : "Drop your files here, or browse"}
          </strong>
          <span>
            Images, documents, and the building blocks of your next idea. Up to
            20 MB per file.
          </span>
        </div>
        <Button
          onClick={() => input.current?.click()}
          disabled={upload.status === "uploading"}
        >
          Browse files
        </Button>
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
      {upload.status !== "idle" && (
        <Notice tone={upload.status === "failed" ? "error" : ""}>
          {upload.message}
        </Notice>
      )}
      <div className="list-toolbar">
        <div className="search-input">
          <Icon name="search" />
          <Input
            placeholder="Search files…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search files"
          />
        </div>
        <Select
          value={type}
          onChange={(e) => setType(e.target.value)}
          aria-label="File type"
        >
          <option value="all">All file types</option>
          <option value="image">Images</option>
          <option value="files">Other files</option>
        </Select>
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
                <Icon name="file" size={42} />
              )}
            </Button>
            <div className="asset-info">
              <strong>{asset.name}</strong>
              <small>
                {formatSize(asset.size)} ·{" "}
                {asset.type.split("/")[1]?.toUpperCase() || "FILE"}
              </small>
              <div>
                <IconButton
                  icon="download"
                  label={`Download ${asset.name}`}
                  onClick={() => void download(asset)}
                />
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
              </div>
            </div>
          </article>
        ))}
      </div>
      {!items.length && (
        <EmptyState
          icon="image"
          title="Make this collection yours"
          description="Upload a reference, a document, or an image to get started."
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
              <strong>{preview.type}</strong>
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
          <p className="muted small-text">
            Usage tracking is not available on the current backend.
          </p>
          <div className="modal-actions">
            <Button icon="download" onClick={() => void download(preview)}>
              Download original
            </Button>
          </div>
        </Modal>
      )}
      {renaming && (
        <Modal title="Rename file metadata" onClose={() => setRenaming(null)}>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              setAssets((prev) =>
                prev.map((a) =>
                  a.id === renaming.id ? { ...a, name: name.trim() } : a,
                ),
              );
              setRenaming(null);
              toast("File label updated in this session.");
            }}
          >
            <Field label="File name">
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Button variant="primary" type="submit">
              Save label
            </Button>
          </form>
        </Modal>
      )}
      {deleting && (
        <Confirm
          title="Remove from library?"
          description="This removes the session library reference only. It does not delete files stored on the backend."
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            setAssets((prev) => prev.filter((a) => a.id !== deleting.id));
            if (deleting.url.startsWith("blob:"))
              URL.revokeObjectURL(deleting.url);
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}
function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
