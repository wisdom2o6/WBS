import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../context/WorkspaceContext";
import { errorMessage } from "../services/workspace";
import type { Project, Room } from "../types/workspace";
import { Confirm, Dropdown, useToast } from "./ui";
import { Icon } from "./Icon";
import { MenuDivider, MenuItem, PlannedBadge } from "./patterns";
import { ResourceDialog } from "./ResourceDialog";

/**
 * Menu items + dialogs for a project or room. The same items render in a
 * "more" dropdown and in the right-click context menu, filtered by role.
 */
export function useResourceActions(
  kind: "project" | "room",
  resource: Project | Room,
) {
  const { base, can, remove } = useWorkspace();
  const [dialog, setDialog] = useState<null | "rename" | "edit" | "delete">(
    null,
  );
  const navigate = useNavigate();
  const toast = useToast();
  const path =
    kind === "project" ? `/projects/${resource.id}` : `/room/${resource.id}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${base}${path}`,
      );
      toast(`${kind === "room" ? "Room" : "Project"} link copied. Sharing does not grant access.`);
    } catch {
      toast("Copy the link from your browser’s address bar.", "info");
    }
  };
  const items = (
    <>
      {kind === "room" ? (
        <>
          <MenuItem icon="frame" onClick={() => navigate(`${base}${path}`)}>
            Open canvas
          </MenuItem>
          <MenuItem
            icon="file"
            onClick={() => navigate(`${base}${path}/documents`)}
          >
            Open documents
          </MenuItem>
          <MenuItem
            icon="chat"
            onClick={() => navigate(`${base}${path}/chat`)}
            badge={<PlannedBadge label="Beta" />}
          >
            Open conversation
          </MenuItem>
        </>
      ) : (
        <MenuItem icon="folder" onClick={() => navigate(`${base}${path}`)}>
          Open project
        </MenuItem>
      )}
      <MenuItem icon="link" onClick={copy}>
        Copy link
      </MenuItem>
      {can.edit && (
        <>
          <MenuDivider />
          <MenuItem icon="edit" onClick={() => setDialog("rename")}>
            Rename
          </MenuItem>
          <MenuItem icon="text-left" onClick={() => setDialog("edit")}>
            Edit description
          </MenuItem>
          {kind === "project" && (
            <MenuItem
              icon="settings"
              onClick={() => navigate(`${base}${path}?tab=Members`)}
            >
              Manage project
            </MenuItem>
          )}
        </>
      )}
      {can.remove && (
        <>
          <MenuDivider />
          <MenuItem danger icon="trash" onClick={() => setDialog("delete")}>
            Delete {kind}
          </MenuItem>
        </>
      )}
    </>
  );
  const rooms = kind === "project" ? (resource as Project).rooms.length : 0;
  const dialogs = (
    <>
      {(dialog === "rename" || dialog === "edit") && (
        <ResourceDialog
          kind={kind}
          resource={resource}
          mode={dialog}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "delete" && (
        <Confirm
          title={`Delete ${resource.name}?`}
          description={
            kind === "project"
              ? `This permanently removes the project, its ${rooms} room${rooms === 1 ? "" : "s"} and all associated canvas data. This cannot be undone.`
              : "This permanently removes the room and its canvas data. This cannot be undone."
          }
          confirmLabel={`Delete ${kind}`}
          requireText={kind === "project" ? resource.name : undefined}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            try {
              await remove(kind, resource.id);
              setDialog(null);
            } catch (err) {
              toast(errorMessage(err), true);
            }
          }}
        />
      )}
    </>
  );
  return { items, dialogs };
}

export function ResourceActions({
  kind,
  resource,
}: {
  kind: "project" | "room";
  resource: Project | Room;
}) {
  const { items, dialogs } = useResourceActions(kind, resource);
  return (
    <>
      <Dropdown
        className="resource-more"
        ariaLabel={`${resource.name} actions`}
        label={<Icon name="more" />}
      >
        {items}
      </Dropdown>
      {dialogs}
    </>
  );
}
