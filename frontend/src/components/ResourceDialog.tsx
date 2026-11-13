import { useState } from "react";
import { useWorkspace } from "../context/WorkspaceContext";
import { errorMessage } from "../services/workspace";
import { Button, Field, Input, Modal, Notice, Select, Textarea } from "./ui";
import { Icon } from "./Icon";

type Kind = "workspace" | "project" | "room";
const placeholders: Record<Kind, string> = {
  project: "e.g. Brand evolution",
  room: "e.g. Design exploration",
  workspace: "e.g. Studio North",
};
const intros: Record<Kind, string> = {
  workspace: "A workspace holds your team, projects and shared documents.",
  project: "A project groups rooms, documents and files around one goal.",
  room: "A room is a shared canvas with documents and conversation.",
};

export function ResourceDialog({
  kind,
  parentId,
  onClose,
  resource,
  mode,
}: {
  kind: Kind;
  parentId?: string;
  onClose: () => void;
  resource?: { id: string; name: string; description?: string };
  /** "rename" shows only the name; "edit" also shows the description. */
  mode?: "rename" | "edit";
}) {
  const { workspace, create, update, demo } = useWorkspace();
  const [name, setName] = useState(resource?.name || "");
  const [description, setDescription] = useState(resource?.description || "");
  const [projectId, setProjectId] = useState(
    parentId || workspace?.projects[0]?.id || "",
  );
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState("");
  const [busy, setBusy] = useState(false);
  const editing = !!resource;
  const resolvedMode = mode || (editing ? "rename" : undefined);
  // The live backend only persists description changes for workspaces.
  const descriptionPersisted = demo || kind === "workspace";
  const showDescription = !editing || resolvedMode === "edit";
  const label = kind[0].toUpperCase() + kind.slice(1);
  const title = !editing
    ? `Create ${kind}`
    : resolvedMode === "edit"
      ? `Edit ${kind} details`
      : `Rename ${kind}`;
  return (
    <Modal title={title} onClose={onClose}>
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) {
            setNameError(`Give your ${kind} a name.`);
            return;
          }
          if (kind === "room" && !editing && !projectId) {
            setError("Select a project for this room.");
            return;
          }
          setBusy(true);
          setError("");
          try {
            if (editing)
              await update(
                kind,
                resource.id,
                trimmed,
                showDescription && descriptionPersisted
                  ? description
                  : undefined,
              );
            else
              await create(
                kind,
                trimmed,
                description,
                kind === "project" ? workspace?.id : projectId,
              );
            onClose();
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
        className="form-stack"
      >
        {!editing && <p className="dialog-intro">{intros[kind]}</p>}
        {demo && <Notice>Demo workspace. Changes stay in this session.</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        <Field label={`${label} name`} error={nameError}>
          <Input
            maxLength={100}
            value={name}
            aria-invalid={!!nameError}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError("");
            }}
            placeholder={placeholders[kind]}
            autoFocus
          />
        </Field>
        {showDescription && (
          <Field
            label="Description"
            hint={
              descriptionPersisted
                ? `${description.length}/280 · Optional`
                : "Description changes are not yet saved by the WBS backend."
            }
          >
            <Textarea
              rows={3}
              maxLength={280}
              value={description}
              disabled={editing && !descriptionPersisted}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Give your team a little context."
            />
          </Field>
        )}
        {kind === "room" && !editing && (
          <Field label="Project">
            <Select
              required
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="" disabled>
                Select a project
              </option>
              {workspace?.projects.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {kind === "room" && !editing && (
          <div className="dialog-includes">
            <span className="eyebrow">EVERY ROOM INCLUDES</span>
            <div>
              <span>
                <Icon name="frame" size={14} />
                Canvas
              </span>
              <span>
                <Icon name="file" size={14} />
                Documents
              </span>
              <span>
                <Icon name="chat" size={14} />
                Chat · beta
              </span>
              <span>
                <Icon name="folder" size={14} />
                Files
              </span>
            </div>
          </div>
        )}
        <div className="modal-actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" loading={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : `Create ${kind}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
