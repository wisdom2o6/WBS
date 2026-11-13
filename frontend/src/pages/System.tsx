import { useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../context/WorkspaceContext";
import {
  Avatar,
  Avatars,
  Badge,
  Button,
  Confirm,
  ContextMenu,
  Dropdown,
  EmptyState,
  Field,
  Heading,
  IconButton,
  Input,
  Notice,
  Select,
  Spinner,
  useToast,
} from "../components/ui";
import { Icon } from "../components/Icon";
import {
  Breadcrumbs,
  LoadingState,
  MenuDivider,
  MenuItem,
  NotificationItem,
  PermissionNote,
  PlannedBadge,
  Presence,
  RoleBadge,
  SearchField,
  SecurityStatus,
  StatusIndicator,
} from "../components/patterns";
import type { SyncState } from "../components/patterns";
import { ResourceDialog } from "../components/ResourceDialog";

const sections = [
  ["status", "Module status"],
  ["foundations", "Foundations"],
  ["buttons", "Buttons"],
  ["inputs", "Inputs"],
  ["menus", "Dropdowns & menus"],
  ["badges", "Badges & status"],
  ["feedback", "Feedback"],
  ["dialogs", "Dialogs"],
  ["navigation", "Navigation"],
  ["collaboration", "Collaboration"],
  ["responsive", "Responsive"],
] as const;

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="ds-section" id={id} aria-labelledby={`${id}-title`}>
      <div className="ds-section-head">
        <Heading>
          <span id={`${id}-title`}>{title}</span>
        </Heading>
        {description && <p>{description}</p>}
      </div>
      {children}
    </section>
  );
}
function Spec({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ds-spec">
      <div className="ds-spec-stage">{children}</div>
      <span>{label}</span>
    </div>
  );
}
const modules: {
  name: string;
  status: "Live" | "Beta" | "Planned";
  detail: string;
  next?: string;
}[] = [
  { name: "Workspaces, projects, rooms", status: "Live", detail: "REST create, rename, delete and listing." },
  { name: "Members", status: "Live", detail: "List members, add existing users.", next: "Role changes, removal and invitation email." },
  { name: "Canvas", status: "Live", detail: "STOMP drawing, cursors, REST restore. Layers, groups, align, distribute, snap, frames, inline text." },
  { name: "Canvas: table, smart connectors, templates", status: "Planned", detail: "Designed tool entry points only." },
  { name: "Documents", status: "Beta", detail: "Persistent block documents with STOMP updates and Markdown export.", next: "Conflict-free collaborative editing." },
  { name: "Room chat", status: "Beta", detail: "Encrypted live delivery and 50-message server history.", next: "Edits, reactions, attachments, typing." },
  { name: "End-to-end encryption", status: "Live", detail: "AES-256-GCM room messages encrypted and decrypted in the browser." },
  { name: "Media library", status: "Beta", detail: "Room files upload, index, restore and delete from PostgreSQL.", next: "Workspace indexing and storage quota." },
  { name: "Notifications", status: "Planned", detail: "Sample notifications only; no delivery service." },
];
const tokens = [
  ["--bg", "Background"],
  ["--surface", "Surface"],
  ["--surface-2", "Surface 2"],
  ["--border", "Border"],
  ["--ink", "Ink"],
  ["--muted", "Muted"],
  ["--accent", "Accent"],
  ["--accent-soft", "Accent soft"],
  ["--success", "Success"],
  ["--warning", "Warning"],
  ["--danger", "Danger"],
  ["--sidebar", "Sidebar"],
];
const syncStates: SyncState[] = [
  "connected",
  "connecting",
  "saving",
  "saved",
  "local",
  "offline",
  "reconnecting",
  "failed",
  "readonly",
];

export default function System() {
  const { workspace, base } = useWorkspace();
  const toast = useToast();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<
    null | "project" | "room" | "rename" | "confirm"
  >(null);
  const [demoValue, setDemoValue] = useState("");
  const [loading, setLoading] = useState(false);
  const project = workspace?.projects[0];
  return (
    <div className="page ds-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">WBS 2.0 · DESIGN SYSTEM</div>
          <Heading level={1}>
            Components & states<span className="blue-text">.</span>
          </Heading>
          <p>
            One visual language across workspace, canvas, documents and the
            modules that come next.
          </p>
        </div>
      </div>
      <div className="ds-layout">
        <nav className="ds-nav" aria-label="Design system sections">
          {sections.map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
        </nav>
        <div className="ds-content">
          <Section
            id="status"
            title="Module status"
            description="What is implemented against the current backend, what runs as a beta, and what is designed but planned."
          >
            <div className="ds-status table-panel">
              <div className="ds-status-head">
                <span>MODULE</span>
                <span>STATUS</span>
                <span>TODAY</span>
                <span>NEXT</span>
              </div>
              {modules.map((m) => (
                <div className="ds-status-row" key={m.name}>
                  <strong>{m.name}</strong>
                  <span>
                    {m.status === "Live" ? (
                      <Badge tone="success">Live</Badge>
                    ) : (
                      <PlannedBadge label={m.status} />
                    )}
                  </span>
                  <span>{m.detail}</span>
                  <span className="muted">{m.next || "—"}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section
            id="foundations"
            title="Foundations"
            description="Existing WBS tokens. New components reuse these; no new palette was introduced."
          >
            <div className="ds-tokens">
              {tokens.map(([v, label]) => (
                <div key={v}>
                  <span style={{ background: `var(${v})` }} />
                  <strong>{label}</strong>
                  <code>{v}</code>
                </div>
              ))}
            </div>
            <div className="ds-type">
              <div>
                <span className="ds-type-sample display">Space Grotesk</span>
                <small>Display · H1 34 / 500 / −1.35</small>
              </div>
              <div>
                <span className="ds-type-sample body">IBM Plex Sans</span>
                <small>Body · 12–14 / 400–550</small>
              </div>
              <div>
                <span className="ds-type-sample mono">IBM PLEX MONO</span>
                <small>Eyebrows, metadata · 9–10</small>
              </div>
            </div>
            <div className="ds-scale">
              {[4, 8, 12, 16, 20, 24, 32, 40].map((n) => (
                <div key={n}>
                  <i style={{ width: n, height: n }} />
                  <small>{n}</small>
                </div>
              ))}
              <div>
                <i className="r4" />
                <small>Radius 4</small>
              </div>
              <div>
                <i className="r6" />
                <small>Radius 6</small>
              </div>
            </div>
          </Section>

          <Section id="buttons" title="Buttons" description="Default, hover, active, focus, disabled and loading.">
            {(["primary", "secondary", "ghost", "danger"] as const).map((v) => (
              <div className="ds-row" key={v}>
                <span className="ds-row-label">{v}</span>
                <Spec label="Default">
                  <Button variant={v} icon="plus">
                    Button
                  </Button>
                </Spec>
                <Spec label="Hover">
                  <Button variant={v} icon="plus" className="ds-hover">
                    Button
                  </Button>
                </Spec>
                <Spec label="Active">
                  <Button variant={v} icon="plus" className="ds-active">
                    Button
                  </Button>
                </Spec>
                <Spec label="Focus">
                  <Button variant={v} icon="plus" className="ds-focus">
                    Button
                  </Button>
                </Spec>
                <Spec label="Disabled">
                  <Button variant={v} icon="plus" disabled>
                    Button
                  </Button>
                </Spec>
                <Spec label="Loading">
                  <Button variant={v} loading>
                    Saving…
                  </Button>
                </Spec>
              </div>
            ))}
            <div className="ds-row">
              <span className="ds-row-label">Icon</span>
              <Spec label="Default">
                <IconButton icon="more" label="More" />
              </Spec>
              <Spec label="Pressed">
                <IconButton icon="grid" label="Grid" aria-pressed className="ds-pressed" />
              </Spec>
              <Spec label="Interactive">
                <Button
                  variant="primary"
                  loading={loading}
                  onClick={() => {
                    setLoading(true);
                    setTimeout(() => {
                      setLoading(false);
                      toast("Saved.");
                    }, 1200);
                  }}
                >
                  {loading ? "Saving…" : "Try loading"}
                </Button>
              </Spec>
            </div>
          </Section>

          <Section id="inputs" title="Inputs" description="Default, focus, error, disabled and filled.">
            <div className="ds-grid-5">
              <Field label="Default">
                <Input placeholder="Project name" />
              </Field>
              <Field label="Focus">
                <Input placeholder="Project name" className="ds-focus-input" />
              </Field>
              <Field label="Error" error="Give your project a name.">
                <Input aria-invalid placeholder="Project name" />
              </Field>
              <Field label="Disabled" hint="Requires Owner role">
                <Input disabled value="Studio North" readOnly />
              </Field>
              <Field label="Filled">
                <Input value="Brand evolution" readOnly />
              </Field>
            </div>
            <div className="ds-grid-3">
              <Field label="Search field">
                <SearchField
                  value={demoValue}
                  onChange={setDemoValue}
                  placeholder="Search…"
                  label="Search demo"
                />
              </Field>
              <Field label="Select">
                <Select defaultValue="member">
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </Select>
              </Field>
              <Field label="Select · disabled">
                <Select disabled defaultValue="member">
                  <option value="member">Member · defined by backend</option>
                </Select>
              </Field>
            </div>
          </Section>

          <Section id="menus" title="Dropdowns & menus" description="Closed, open, selected and disabled items; context menus share the same items.">
            <div className="ds-row ds-row-top">
              <Spec label="Closed">
                <Dropdown align="left" label={<span className="ds-trigger">Sort: Newest <Icon name="down" size={13} /></span>}>
                  <MenuItem icon="check">Newest first</MenuItem>
                  <MenuItem>Name A–Z</MenuItem>
                </Dropdown>
              </Spec>
              <Spec label="Open · selected · disabled · danger">
                <div className="dropdown-menu ds-static-menu" role="menu">
                  <span className="menu-label">PROJECT</span>
                  <MenuItem icon="folder">Open project</MenuItem>
                  <MenuItem icon="edit" badge={<Icon name="check" size={14} />}>
                    Rename
                  </MenuItem>
                  <MenuItem icon="copy" shortcut="⌘D">
                    Duplicate
                  </MenuItem>
                  <MenuItem icon="template" disabled badge={<PlannedBadge />}>
                    Save as template
                  </MenuItem>
                  <MenuDivider />
                  <MenuItem icon="trash" danger>
                    Delete project
                  </MenuItem>
                </div>
              </Spec>
              <Spec label="Context menu · right-click">
                <ContextMenu
                  actions={
                    <>
                      <MenuItem icon="frame">Open canvas</MenuItem>
                      <MenuItem icon="link">Copy link</MenuItem>
                      <MenuDivider />
                      <MenuItem icon="trash" danger>
                        Delete room
                      </MenuItem>
                    </>
                  }
                >
                  <div className="ds-context-target">Right-click here</div>
                </ContextMenu>
              </Spec>
            </div>
          </Section>

          <Section id="badges" title="Badges & status" description="Roles, module maturity, save / sync state and connection security.">
            <div className="ds-row">
              <span className="ds-row-label">Roles</span>
              <RoleBadge role="OWNER" />
              <RoleBadge role="ADMIN" />
              <RoleBadge role="MEMBER" />
              <RoleBadge role="VIEWER" />
              <span className="ds-row-label">Maturity</span>
              <Badge tone="success">Live</Badge>
              <PlannedBadge label="Beta" />
              <PlannedBadge />
              <Badge>Local draft</Badge>
              <Badge tone="warning">Not verified</Badge>
            </div>
            <div className="ds-row ds-wrap">
              <span className="ds-row-label">Sync</span>
              {syncStates.map((s) => (
                <StatusIndicator key={s} state={s} />
              ))}
            </div>
            <div className="ds-grid-4">
              <SecurityStatus state="secure" />
              <SecurityStatus state="transit" />
              <SecurityStatus state="setup" />
              <SecurityStatus state="e2ee" />
            </div>
            <p className="ds-note">
              <Icon name="shield" size={13} />
              The end-to-end encrypted variant renders as active only when
              passed a verified flag. WBS does not set it today, so it always
              reads “not available”.
            </p>
          </Section>

          <Section id="feedback" title="Feedback" description="Toasts, notices, loading and empty states.">
            <div className="ds-row">
              <span className="ds-row-label">Toasts</span>
              <Button icon="check" onClick={() => toast("Project created.")}>
                Success
              </Button>
              <Button icon="alert" onClick={() => toast("Unable to reach the WBS server.", "error")}>
                Error
              </Button>
              <Button icon="alert" onClick={() => toast("You are offline. Changes are queued.", "warning")}>
                Warning
              </Button>
              <Button icon="info" onClick={() => toast("Room link copied. Sharing does not grant access.", "info")}>
                Info
              </Button>
            </div>
            <div className="ds-grid-2">
              <Notice>Neutral notice: integration boundaries and context.</Notice>
              <Notice tone="error">Error notice: the server returned 500.</Notice>
              <PermissionNote role="VIEWER">
                Permission-denied state. Actions are hidden, not just disabled.
              </PermissionNote>
              <div className="ds-inline-loading">
                <Spinner size={14} /> Inline loading
              </div>
            </div>
            <div className="ds-grid-2">
              <LoadingState variant="rows" count={2} />
              <LoadingState variant="stats" />
            </div>
            <LoadingState variant="cards" count={3} />
            <EmptyState
              icon="frame"
              title="A blank canvas. A fresh start."
              description="Empty states explain what belongs here and offer the next step."
              action={<Button icon="plus">Create room</Button>}
            />
          </Section>

          <Section id="dialogs" title="Dialogs" description="All dialogs share the modal shell, focus trap and Escape handling.">
            <div className="ds-row ds-wrap">
              <Button icon="folder" onClick={() => setDialog("project")}>
                Create project
              </Button>
              <Button icon="frame" disabled={!project} onClick={() => setDialog("room")}>
                Create room
              </Button>
              <Button icon="users" onClick={() => navigate(`${base}/members?invite=1`)}>
                Invite member
              </Button>
              <Button icon="edit" disabled={!project} onClick={() => setDialog("rename")}>
                Rename
              </Button>
              <Button icon="trash" variant="danger" onClick={() => setDialog("confirm")}>
                Delete confirmation
              </Button>
            </div>
            <Spec label="Document actions menu">
              <div className="dropdown-menu ds-static-menu" role="menu">
                <MenuItem icon="edit">Rename</MenuItem>
                <MenuItem icon="copy">Duplicate</MenuItem>
                <MenuItem icon="download">Export Markdown</MenuItem>
                <MenuItem icon="info">Document information</MenuItem>
                <MenuDivider />
                <MenuItem icon="trash" danger>
                  Delete document
                </MenuItem>
              </div>
            </Spec>
          </Section>

          <Section id="navigation" title="Navigation" description="Active and hover states, breadcrumbs, tabs and segmented filters.">
            <Breadcrumbs
              items={[
                { label: "Studio North", to: "#" },
                { label: "Projects", to: "#" },
                { label: "Brand evolution", to: "#" },
                { label: "Brand direction" },
              ]}
            />
            <div className="tabs ds-tabs">
              <Button variant="ghost" className="active">
                Rooms <span className="tab-count">2</span>
              </Button>
              <Button variant="ghost">Documents</Button>
              <Button variant="ghost" className="ds-hover">
                Files (hover)
              </Button>
            </div>
            <div className="segmented">
              <button type="button" className="active">
                All <span>5</span>
              </button>
              <button type="button">
                Owner <span>1</span>
              </button>
              <button type="button">
                Member <span>3</span>
              </button>
              <button type="button">
                Viewer <span>1</span>
              </button>
            </div>
            <div className="ds-sidebar-sample">
              <span className="nav-item active">
                <Icon name="home" size={18} />
                <span>Active item</span>
              </span>
              <span className="nav-item ds-nav-hover">
                <Icon name="folder" size={18} />
                <span>Hover item</span>
              </span>
              <span className="nav-item">
                <Icon name="image" size={18} />
                <span>Media library</span>
                <PlannedBadge label="Beta" />
              </span>
              <span className="nav-item ds-collapsed" title="Collapsed">
                <Icon name="users" size={18} />
              </span>
            </div>
          </Section>

          <Section id="collaboration" title="Collaboration" description="Presence, message states and notifications.">
            <div className="ds-row">
              <Presence people={[{ name: "Sarah Chen", color: "#2455d6" }, { name: "James Wilson", color: "#39755b" }]} label="2 here" />
              <Avatars names={["Alex Morgan", "Sarah Chen", "James Wilson", "Mia Thompson", "Oliver Park"]} />
              <Avatar name="Alex Morgan" />
            </div>
            <div className="ds-chat chat-timeline">
              <div className="chat-system">
                <Icon name="info" size={12} />
                <span>System message · Sarah Chen created this room</span>
              </div>
              <div className="chat-message">
                <Avatar name="Sarah Chen" tone={1} />
                <div className="message-content">
                  <div className="message-author">
                    <strong>Sarah Chen</strong>
                    <time>09:41</time>
                  </div>
                  <div className="message-reply-preview">
                    <Icon name="reply" size={13} />
                    Reply preview of the quoted message
                  </div>
                  <p>Default message with a reaction.</p>
                  <div className="message-reactions">
                    <button type="button" className="reaction mine">
                      <Icon name="heart" size={12} />2
                    </button>
                  </div>
                </div>
              </div>
              <div className="chat-unread-divider">
                <span>NEW MESSAGES</span>
              </div>
              <div className="chat-message selected">
                <Avatar name="Mia Thompson" tone={3} />
                <div className="message-content">
                  <div className="message-author">
                    <strong>Mia Thompson</strong>
                    <time>09:52</time>
                  </div>
                  <p>Selected message state.</p>
                </div>
              </div>
              <div className="chat-message status-sending own">
                <Avatar name="Alex Morgan" />
                <div className="message-content">
                  <div className="message-author">
                    <strong>Alex Morgan</strong>
                    <span>you</span>
                    <time>09:53</time>
                  </div>
                  <p>Sending state.</p>
                  <span className="message-status">
                    <Spinner size={9} />
                    Sending…
                  </span>
                </div>
              </div>
              <div className="chat-message status-failed own">
                <Avatar name="Alex Morgan" />
                <div className="message-content">
                  <p>Failed to send.</p>
                  <span className="message-status failed">
                    <Icon name="alert" size={12} />
                    Not sent.
                    <button type="button">Retry</button>
                    <button type="button">Discard</button>
                  </span>
                </div>
              </div>
            </div>
            <div className="ds-notifications table-panel">
              <NotificationItem title="Sarah mentioned you" detail="“What do you think of this direction?”" time="12 min ago" type="mention" read={false} to="#" />
              <NotificationItem title="Project brief updated" detail="James added the latest project goals." time="38 min ago" type="document" read to="#" />
            </div>
            <div className="ds-row">
              <span className="ds-row-label">File types</span>
              {[
                ["photo.jpg", "image/jpeg"],
                ["brief.pdf", "application/pdf"],
                ["walkthrough.mp4", "video/mp4"],
                ["archive.zip", "application/zip"],
              ].map(([n, t]) => (
                <span key={n} className={`file-type type-${t.startsWith("image") ? "image" : t.includes("pdf") ? "document" : t.startsWith("video") ? "video" : "other"}`}>
                  {n.split(".").pop()!.toUpperCase()}
                </span>
              ))}
            </div>
          </Section>

          <Section id="responsive" title="Responsive" description="Desktop is primary. Editors keep a usable working area at every width.">
            <div className="ds-breakpoints">
              {[
                ["1440", "Desktop", "Full shell, layers and properties panels open."],
                ["1280", "Laptop", "Panels narrow; members role guide stacks below the table."],
                ["768", "Tablet", "Sidebar becomes a drawer; canvas panels overlay the stage."],
                ["375", "Mobile", "Tool rail moves to the bottom; contextual toolbars scroll horizontally."],
              ].map(([w, n, d]) => (
                <div key={w}>
                  <strong>{w}px</strong>
                  <span>{n}</span>
                  <p>{d}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
      {(dialog === "project" || dialog === "room") && (
        <ResourceDialog kind={dialog} parentId={project?.id} onClose={() => setDialog(null)} />
      )}
      {dialog === "rename" && project && (
        <ResourceDialog kind="project" mode="rename" resource={project} onClose={() => setDialog(null)} />
      )}
      {dialog === "confirm" && (
        <Confirm
          title="Delete Brand evolution?"
          description="This permanently removes the project, its rooms and all associated canvas data. Preview only — nothing is deleted here."
          confirmLabel="Delete project"
          requireText="Brand evolution"
          onClose={() => setDialog(null)}
          onConfirm={() => {
            setDialog(null);
            toast("Preview only. Nothing was deleted.", "info");
          }}
        />
      )}
    </div>
  );
}
