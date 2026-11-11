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
  EmptyState,
  Heading,
  Skeleton,
  useToast,
} from "../components/ui";
import { Icon } from "../components/Icon";
import { ResourceDialog } from "../components/ResourceDialog";
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
}: {
  room: Room;
  project: Project;
  index?: number;
}) {
  const { base, members, demo } = useWorkspace();
  const navigate = useNavigate();
  const toast = useToast();
  return (
    <ContextMenu
      actions={
        <>
          <Button
            role="menuitem"
            variant="ghost"
            icon="frame"
            onClick={() => navigate(`${base}/room/${room.id}`)}
          >
            Open canvas
          </Button>
          <Button
            role="menuitem"
            variant="ghost"
            icon="chat"
            onClick={() => navigate(`${base}/room/${room.id}/chat`)}
          >
            Open conversation
          </Button>
          <Button
            role="menuitem"
            variant="ghost"
            icon="copy"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  `${window.location.origin}${base}/room/${room.id}`,
                );
                toast("Room link copied. Sharing does not grant access.");
              } catch {
                toast("Copy the room URL from your browser.");
              }
            }}
          >
            Copy room link
          </Button>
        </>
      }
    >
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
        <div className="room-card-footer">
          <span>
            <Icon name="frame" size={13} />
            Canvas
            {demo && index === 0 && (
              <span className="subtle-online">
                <i />2 exploring
              </span>
            )}
          </span>
          <Avatars
            names={members.slice(index, index + 3).map((m) => m.fullName)}
            limit={3}
          />
        </div>
      </Link>
    </ContextMenu>
  );
}
export const Dashboard = () => {
  const { workspace, members, base, loading, documents, activity, demo } =
    useWorkspace();
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
  const firstName = demo
    ? "Alex"
    : user?.fullName?.split(" ")[0] || user?.username || "there";
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
          <Button icon="users" onClick={() => navigate(`${base}/members`)}>
            Invite members
          </Button>
          <Button
            variant="primary"
            icon="plus"
            onClick={() => setCreating(workspace ? "project" : "workspace")}
          >
            {workspace ? "New project" : "New workspace"}
          </Button>
        </div>
      </div>
      <div className="workspace-summary">
        <div className="workspace-summary-intro">
          <span className="summary-mark">
            <Icon name="layers" size={24} />
          </span>
          <div>
            <strong>{workspace?.name || "Welcome to WBS"}</strong>
            <span>
              {workspace?.description ||
                "Create a workspace to bring your ideas together."}
            </span>
          </div>
        </div>
        <div className="summary-stat">
          <strong>{projects.length.toString().padStart(2, "0")}</strong>
          <span>Projects</span>
        </div>
        <div className="summary-stat">
          <strong>{rooms.length.toString().padStart(2, "0")}</strong>
          <span>Rooms</span>
        </div>
        <div className="summary-stat">
          <strong>{members.length.toString().padStart(2, "0")}</strong>
          <span>Members</span>
        </div>
      </div>
      <section className="continue-section">
        <div className="section-heading">
          <div>
            <Heading>Pick up where you left off</Heading>
            <p>Your ideas are right where you left them.</p>
          </div>
          <Link className="text-link" to={`${base}/rooms`}>
            All rooms
            <Icon name="arrow" size={15} />
          </Link>
        </div>
        {loading ? (
          <Skeleton />
        ) : rooms.length ? (
          <div className="room-grid">
            {recentRooms.slice(0, 3).map(({ room, project }, i) => (
              <RoomCard key={room.id} room={room} project={project} index={i} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="A blank canvas. A fresh start."
            description="Create your first project, then add a room to start creating together."
            action={
              <Button icon="plus" onClick={() => setCreating("project")}>
                Create project
              </Button>
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
            {projects.length === 0 && (
              <div className="compact-empty">
                Your projects will appear here.
              </div>
            )}
            <Button
              variant="ghost"
              className="table-create"
              icon="plus"
              onClick={() => setCreating("project")}
            >
              Create a new project
            </Button>
          </div>
          <div className="quick-actions">
            <Button variant="ghost" onClick={() => setCreating("room")}>
              <span className="quick-icon">
                <Icon name="frame" />
              </span>
              <span>
                <strong>Start a canvas</strong>
                <small>Think outside the page</small>
              </span>
              <Icon name="arrow" size={15} />
            </Button>
            <Link to={`${base}/documents?create=1`}>
              <span className="quick-icon">
                <Icon name="file" />
              </span>
              <span>
                <strong>Write a document</strong>
                <small>Give your ideas structure</small>
              </span>
              <Icon name="arrow" size={15} />
            </Link>
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
            {activity.slice(0, 4).map((a, i) => (
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
