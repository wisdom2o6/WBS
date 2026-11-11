import { useState } from "react";
import { useWorkspace } from "../context/WorkspaceContext";
import { errorMessage } from "../services/workspace";
import { Button, Field, Input, Modal, Notice, Select, Textarea } from "./ui";

export function ResourceDialog({
  kind,
  parentId,
  onClose,
  resource,
}: {
  kind: "workspace" | "project" | "room";
  parentId?: string;
  onClose: () => void;
  resource?: { id: string; name: string; description?: string };
}) {
  const { workspace, create, update, demo } = useWorkspace();
  const [name, setName] = useState(resource?.name || "");
  const [description, setDescription] = useState(resource?.description || "");
  const [projectId, setProjectId] = useState(
    parentId || workspace?.projects[0]?.id || "",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={`${resource ? "Edit" : "Create"} ${kind}`} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            if (resource)
              await update(
                kind,
                resource.id,
                name.trim(),
                kind === "workspace" ? description : undefined,
              );
            else
              await create(
                kind,
                name.trim(),
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
        {demo && <Notice>Demo workspace. Changes stay in this session.</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        <Field label="Name">
          <Input
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              kind === "project"
                ? "e.g. Brand evolution"
                : kind === "room"
                  ? "e.g. Design exploration"
                  : "e.g. Studio North"
            }
            autoFocus
          />
        </Field>
        {(!resource || kind === "workspace") && (
          <Field label="Description">
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Give your team a little context."
            />
          </Field>
        )}
        {kind === "room" && !resource && (
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
        <div className="modal-actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : resource ? "Save changes" : `Create ${kind}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
