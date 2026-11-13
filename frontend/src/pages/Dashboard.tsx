import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import {
  Avatar,
  Avatars,
  Badge,
  Button,
  ContextMenu,
  Dropdown,
  EmptyState,
  Heading,
} from "../components/ui";
import { Icon } from "../components/Icon";
import { ResourceDialog } from "../components/ResourceDialog";
import { useResourceActions } from "../components/ResourceActions";
import { LoadingState, RoleBadge } from "../components/patterns";
import type { Project, Room } from "../types/workspace";
import { getRecentRooms } from "../services/recentRooms";

export function BoardPreview({ variant = 0 }: { variant?: number }) {
  return (
    <div
      className={`board-preview board-preview-${variant % 3}`}
      aria-hidden="true"
    >
      {variant % 3 === 0 ? (
        <>
          <div className="mini-board-label">NORTH / IDENTITY EXPLORATION</div>
          <div className="preview-brand">
            <span>
              North<span className="blue-text">®</span>
            </span>
            <small>
              Thoughtfully
              <br />
              moving forward.
            </small>
          </div>
          <div className="mini-palette">
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="mini-note">
            Make room for
            <br />
            <strong>what’s next.</strong>
          </div>
          <div className="preview-line" />
          <div className="preview-cursor">
            <Icon name="cursor" size={14} />
            <span>Sarah</span>
          </div>
        </>
      ) : variant % 3 === 1 ? (
        <>
          <div className="mini-web">
            <div className="mini-web-nav">
              north<span>Work &nbsp; Studio &nbsp; Contact</span>
            </div>
            <div className="mini-web-title">
              Independent minds.
              <br />
              <i>Shared ambition.</i>
            </div>
            <div className="mini-web-img">
              <span>N.</span>
              <div />
            </div>
            <div className="mini-web-footer">
              Good things happen when we make space.
            </div>
          </div>
          <div className="mini-wireframe">
            <i />
            <i />
            <span />
            <span />
            <span />
          </div>
          <div className="mini-board-label">WEBSITE / EXPLORATIONS</div>
        </>
      ) : (
        <>
          <div className="mini-roadmap-heading">The bigger picture.</div>
          <div className="mini-roadmap-cols">
            {["DISCOVER", "DEFINE", "DELIVER"].map((label, i) => (
              <div key={label}>
                <small>{label}</small>
                <span>
                  {["Customer insights", "Our north star", "Make it happen"][i]}
                </span>
                <span>
                  {["Opportunity map", "Product principles", "Test & learn"][i]}
                </span>
              </div>
            ))}
          </div>
          <div className="mini-board-label">PRODUCT / Q4 PLANNING</div>
        </>
      )}
    </div>
  );
}
export function RoomCard({
  room,
  project,
  index = 0,
  showActions = false,
}: {
  room: Room;
  project: Project;
  index?: number;
  showActions?: boolean;
}) {
  const { base, members, demo } = useWorkspace();
  const { items, dialogs } = useResourceActions("room", room);
  const activity = room.lastActivity;
  const people = members.slice(index % Math.max(1, members.length - 2), (index % Math.max(1, members.length - 2)) + 3);
  return (
    <div className="room-with-actions">
      <ContextMenu actions={items}>
        <Link to={`${base}/room/${room.id}`} className="room-card">
          {demo ? (
            <BoardPreview variant={index} />
          ) : (
            <div className="live-board-placeholder">
              <Icon name="frame" size={32} />
              <span>{room.name}</span>
              <small>Open your shared canvas</small>
            </div>
          )}
          <div className="room-card-info">
            <div>
              <strong>{room.name}</strong>
              <span>{project.name}</span>
            </div>
            <Icon name="diagonal" size={17} />
          </div>
          <p className="room-card-description">
            {room.description || "A shared canvas for your next idea."}
          </p>
          <div className="room-card-footer">
            <span className="room-card-activity">
              <Icon name="clock" size={12} />
              {activity
                ? `${activity.actor.split(" ")[0]} · ${activity.time}`
                : room.createdAt
                  ? `Created ${new Date(room.createdAt).toLocaleDateString("en", { month: "short", day: "numeric" })}`
                  : "No recent activity"}
              {demo && index === 0 && (
                <span className="subtle-online">
                  <i />2 exploring
                </span>
              )}
            </span>
            <Avatars names={people.map((m) => m.fullName)} limit={3} />
          </div>
        </Link>
      </ContextMenu>
      {showActions && (
        <div className="room-actions-overlay">
          <Dropdown
            className="resource-more"
            ariaLabel={`${room.name} actions`}
            label={<Icon name="more" />}
          >
            {items}
          </Dropdown>
        </div>
      )}
      {dialogs}
    </div>
  );
}
function shortDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString("en", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}
export const Dashboard = () => {
  const {
    workspace,
    members,
    base,
    loading,
    documents,
    activity,
    demo,
    can,
    role,
  } = useWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [creating, setCreating] = useState<
    "workspace" | "project" | "room" | null
  >(null);
  const [hour] = useState(() => new Date().getHours());
  const projects = workspace?.projects || [];
  const rooms = projects.flatMap((p) =>
    p.rooms.map((r) => ({ room: r, project: p })),
  );
  const recentIds = workspace ? getRecentRooms(workspace.id, demo) : [];
  const recentRooms = [...rooms].sort((a, b) => {
    const ai = recentIds.indexOf(a.room.id),
      bi = recentIds.indexOf(b.room.id);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
  const recentDocs = documents
    .filter((d) => d.workspaceId === workspace?.id)
    .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3);
  const firstName = demo
    ? "Alex"
    : user?.fullName?.split(" ")[0] || user?.username || "there";
  const location = (projectId?: string, roomId?: string) => {
    const project = projects.find((p) => p.id === projectId);
    const room = project?.rooms.find((r) => r.id === roomId);
    return [project?.name, room?.name].filter(Boolean).join(" · ") ||
      "Workspace document";
  };
  const quickActions = [
    can.create && {
      key: "canvas",
      icon: "frame",
      title: "Start a canvas",
      detail: "Think outside the page",
      onClick: () => setCreating(projects.length ? "room" : "project"),
    },
    can.create && {
      key: "doc",
      icon: "file",
      title: "Write a document",
      detail: "Give your ideas structure",
      to: `${base}/documents?create=1`,
    },
    {
      key: "media",
      icon: "image",
      title: can.create ? "Upload media" : "Browse media",
      detail: "Keep references close",
      to: `${base}/media`,
    },
    can.manageMembers && {
      key: "invite",
      icon: "users",
      title: "Invite people",
      detail: "Bring your team in",
      to: `${base}/members?invite=1`,
    },
  ].filter(Boolean) as {
    key: string;
    icon: string;
    title: string;
    detail: string;
    to?: string;
    onClick?: () => void;
  }[];
  return (
    <div className="page overview-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR WORKSPACE, IN FOCUS</div>
          <Heading level={1}>
            Good {hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"},{" "}
            {firstName}
            <span className="blue-text">.</span>
          </Heading>
          <p>Make space for your next great idea.</p>
        </div>
        <div className="page-heading-actions">
          <Button
            variant="ghost"
            icon="search"
            className="overview-search"
            onClick={() => window.dispatchEvent(new Event("wbs:search"))}
          >
            Search
            <kbd>⌘ K</kbd>
          </Button>
          {can.manageMembers && (
            <Button
              icon="users"
              onClick={() => navigate(`${base}/members?invite=1`)}
            >
              Invite members
            </Button>
          )}
          {(can.create || !workspace) && (
            <Button
              variant="primary"
              icon="plus"
              onClick={() => setCreating(workspace ? "project" : "workspace")}
            >
              {workspace ? "New project" : "New workspace"}
            </Button>
          )}
        </div>
      </div>
      <div className="workspace-summary">
        <div className="workspace-summary-intro">
          <span className="summary-mark">
            <Icon name="layers" size={24} />
          </span>
          <div>
            <strong>
              {workspace?.name || "Welcome to WBS"}
              {workspace && <RoleBadge role={role} />}
            </strong>
            <span>
              {workspace?.description ||
                "Create a workspace to bring your ideas together."}
            </span>
            {workspace && (
              <span className="summary-links">
                <Link to={`${base}/documents`}>
                  <Icon name="file" size={12} />
                  Shared documents
                </Link>
                <Link to={`${base}/members`}>
                  <Icon name="users" size={12} />
                  People
                </Link>
                {can.manageWorkspace && (
                  <Link to={`${base}/settings?tab=Workspace`}>
                    <Icon name="settings" size={12} />
                    Workspace settings
                  </Link>
                )}
              </span>
            )}
          </div>
        </div>
        {loading ? (
          <div className="summary-loading">
            <LoadingState variant="stats" label="Loading workspace totals" />
          </div>
        ) : (
          <>
            <Link className="summary-stat" to={`${base}/projects`}>
              <strong>{projects.length.toString().padStart(2, "0")}</strong>
              <span>Projects</span>
            </Link>
            <Link className="summary-stat" to={`${base}/rooms`}>
              <strong>{rooms.length.toString().padStart(2, "0")}</strong>
              <span>Rooms</span>
            </Link>
            <Link className="summary-stat" to={`${base}/members`}>
              <strong>{members.length.toString().padStart(2, "0")}</strong>
              <span>Members</span>
            </Link>
          </>
        )}
      </div>
      <section className="continue-section">
        <div className="section-heading">
          <div>
            <Heading>Pick up where you left off</Heading>
            <p>Recently opened rooms, right where you left them.</p>
          </div>
          <Link className="text-link" to={`${base}/rooms`}>
            All rooms
            <Icon name="arrow" size={15} />
          </Link>
        </div>
        {loading ? (
          <LoadingState variant="cards" label="Loading rooms" />
        ) : rooms.length ? (
          <div className="room-grid">
            {recentRooms.slice(0, 3).map(({ room, project }, i) => (
              <RoomCard key={room.id} room={room} project={project} index={i} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="frame"
            title="A blank canvas. A fresh start."
            description={
              can.create
                ? "Create your first project, then add a room to start creating together."
                : "Rooms shared with you will appear here."
            }
            action={
              can.create ? (
                <Button
                  icon="plus"
                  onClick={() =>
                    setCreating(projects.length ? "room" : "project")
                  }
                >
                  {projects.length ? "Create room" : "Create project"}
                </Button>
              ) : undefined
            }
          />
        )}
      </section>
      <div className="overview-lower">
        <section className="projects-section">
          <div className="section-heading">
            <Heading>Projects</Heading>
            <Link className="text-link" to={`${base}/projects`}>
              View all
              <Icon name="arrow" size={15} />
            </Link>
          </div>
          <div className="table-panel">
            <div className="project-table-head">
              <span>PROJECT NAME</span>
              <span>MEMBERS</span>
              <span>ROOMS</span>
              <span>CREATED</span>
              <span />
            </div>
            {loading && <LoadingState variant="rows" label="Loading projects" />}
            {projects.slice(0, 4).map((p, i) => (
              <Link
                className="project-table-row"
                key={p.id}
                to={`${base}/projects/${p.id}`}
              >
                <div className="project-name">
                  <span className={`project-symbol tone-${i % 3}`}>
                    <Icon name="folder" size={19} />
                  </span>
                  <div>
                    <strong>{p.name}</strong>
                    <small>{p.description || "A space for shared work."}</small>
                  </div>
                </div>
                <Avatars
                  names={members.slice(i, i + 3).map((m) => m.fullName)}
                />
                <span className="room-number">{p.rooms.length} rooms</span>
                <span className="muted small-text">
                  {p.createdAt
                    ? new Date(p.createdAt).toLocaleDateString("en", {
                        month: "short",
                        day: "numeric",
                      })
                    : "—"}
                </span>
                <Icon name="chevron" size={15} />
              </Link>
            ))}
            {!loading && projects.length === 0 && (
              <div className="compact-empty">
                Your projects will appear here.
              </div>
            )}
            {can.create && (
              <Button
                variant="ghost"
                className="table-create"
                icon="plus"
                onClick={() => setCreating("project")}
              >
                Create a new project
              </Button>
            )}
          </div>
          <div className="section-heading recent-docs-heading">
            <Heading>Recently edited documents</Heading>
            <Link className="text-link" to={`${base}/documents`}>
              All documents
              <Icon name="arrow" size={15} />
            </Link>
          </div>
          <div className="recent-docs table-panel">
            {recentDocs.map((d) => (
              <Link
                key={d.id}
                className="recent-doc-row"
                to={`${base}/documents/${d.id}`}
              >
                <span className="document-icon">
                  <Icon name="file" size={18} />
                </span>
                <span className="recent-doc-copy">
                  <strong>{d.title}</strong>
                  <small>{location(d.projectId, d.roomId)}</small>
                </span>
                <span className="recent-doc-meta">
                  <Avatar name={d.author} size="small" />
                  <span>
                    <small>{d.author.split(" ")[0]}</small>
                    <time>{shortDate(d.updatedAt)}</time>
                  </span>
                </span>
                <Icon name="chevron" size={15} />
              </Link>
            ))}
            {!recentDocs.length && (
              <div className="compact-empty recent-docs-empty">
                <Icon name="file" size={16} />
                {can.create
                  ? "Documents you write will appear here."
                  : "Documents shared with you will appear here."}
              </div>
            )}
          </div>
          <div className="quick-actions">
            {quickActions.map((a) =>
              a.to ? (
                <Link key={a.key} to={a.to}>
                  <span className="quick-icon">
                    <Icon name={a.icon} />
                  </span>
                  <span>
                    <strong>{a.title}</strong>
                    <small>{a.detail}</small>
                  </span>
                  <Icon name="arrow" size={15} />
                </Link>
              ) : (
                <Button key={a.key} variant="ghost" onClick={a.onClick}>
                  <span className="quick-icon">
                    <Icon name={a.icon} />
                  </span>
                  <span>
                    <strong>{a.title}</strong>
                    <small>{a.detail}</small>
                  </span>
                  <Icon name="arrow" size={15} />
                </Button>
              ),
            )}
          </div>
        </section>
        <section className="activity-section">
          <div className="section-heading">
            <Heading>Recent activity</Heading>
            <Link
              to={`${base}/activity`}
              className="text-link"
              aria-label="View all activity"
            >
              <Icon name="diagonal" size={16} />
            </Link>
          </div>
          <div className="activity-list">
            {activity.slice(0, 5).map((a, i) => (
              <Link
                key={a.id}
                className="activity-item"
                to={`${base}${a.path}`}
              >
                <span className="activity-avatar">
                  <Avatar name={a.actor} tone={i} size="small" />
                  <span>
                    <Icon name={a.icon} size={9} />
                  </span>
                </span>
                <div>
                  <p>
                    <strong>{a.actor}</strong> {a.action}
                    <br />
                    <b>{a.target}</b>
                  </p>
                  <time>{a.time}</time>
                </div>
              </Link>
            ))}
            {!activity.length && (
              <p className="compact-empty">
                Workspace actions will appear here as you work.
              </p>
            )}
          </div>
          <div className="workspace-note">
            <div>
              <span className="note-grid">
                <Icon name="grid" size={17} />
              </span>
              <Badge tone="neutral">
                {demo ? "SAMPLE WORKSPACE" : "WORK BETTER, TOGETHER"}
              </Badge>
            </div>
            <Heading level={3}>
              Big ideas.
              <br />
              Shared space.
            </Heading>
            <p>
              {demo
                ? "Explore the tools. Make something your own. Nothing here changes live team data."
                : "One place for your team to think, create, and move forward."}
            </p>
            <Link
              to={demo ? "/login" : `${base}/members`}
              className="text-link"
            >
              {demo ? "Make it your workspace" : "Bring your team together"}
              <Icon name="arrow" size={15} />
            </Link>
          </div>
        </section>
      </div>
      <footer className="page-footer">
        <span>
          <span className="status-dot" />
          {demo
            ? "Demo data · Changes stay in this session"
            : "Your shared workspace"}
        </span>
        <span>
          {documents.filter((d) => d.workspaceId === workspace?.id).length}{" "}
          documents · Built for better together.
        </span>
      </footer>
      {creating && (
        <ResourceDialog kind={creating} onClose={() => setCreating(null)} />
      )}
    </div>
  );
};
