import { useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useWorkspace } from "../context/WorkspaceContext";
import {
  Avatar,
  Avatars,
  Badge,
  Button,
  ContextMenu,
  EmptyState,
  Heading,
  IconButton,
  Select,
} from "../components/ui";
import { Icon } from "../components/Icon";
import { ResourceDialog } from "../components/ResourceDialog";
import {
  ResourceActions,
  useResourceActions,
} from "../components/ResourceActions";
import {
  Breadcrumbs,
  LoadingState,
  PermissionNote,
  RoleBadge,
  SearchField,
} from "../components/patterns";
import { RoomCard } from "./Dashboard";
import type { Project } from "../types/workspace";

export { ResourceActions };

function formatDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en", { month: "short", day: "numeric" });
}

/** Workspace identity strip shown above project management. */
function WorkspaceHeader() {
  const { workspace, members, base, role, can, documents } = useWorkspace();
  if (!workspace) return null;
  const rooms = workspace.projects.reduce((n, p) => n + p.rooms.length, 0);
  const docs = documents.filter((d) => d.workspaceId === workspace.id).length;
  return (
    <section className="workspace-header" aria-label="Workspace">
      <span className="workspace-avatar">{workspace.name.slice(0, 1)}</span>
      <div className="workspace-header-copy">
        <div>
          <strong>{workspace.name}</strong>
          <RoleBadge role={role} />
        </div>
        <p>{workspace.description || "No description yet."}</p>
      </div>
      <div className="workspace-header-stats">
        <span>
          <strong>{workspace.projects.length}</strong> projects
        </span>
        <span>
          <strong>{rooms}</strong> rooms
        </span>
        <Link to={`${base}/members`} className="workspace-header-members">
          <Avatars names={members.map((m) => m.fullName)} limit={4} />
          <span>
            <strong>{members.length}</strong> members
          </span>
        </Link>
      </div>
      <div className="workspace-header-links">
        <Link to={`${base}/documents`} className="btn btn-ghost">
          <Icon name="file" size={15} />
          Shared documents
          <span className="tab-count">{docs}</span>
        </Link>
        {can.manageWorkspace && (
          <Link
            to={`${base}/settings?tab=Workspace`}
            className="btn btn-secondary"
          >
            <Icon name="settings" size={15} />
            Workspace settings
          </Link>
        )}
      </div>
    </section>
  );
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const { base, members } = useWorkspace();
  const { items, dialogs } = useResourceActions("project", project);
  return (
    <>
      <ContextMenu actions={items}>
        <article className="project-card">
          <div className="project-card-top">
            <span className={`project-symbol tone-${index % 3}`}>
              <Icon name="folder" size={22} />
            </span>
            <ResourceActions kind="project" resource={project} />
          </div>
          <Link to={`${base}/projects/${project.id}`}>
            <Heading level={3}>{project.name}</Heading>
            <p>
              {project.description ||
                "A shared space to move your next idea forward."}
            </p>
          </Link>
          {project.rooms.length > 0 && (
            <div className="project-card-rooms">
              {project.rooms.slice(0, 2).map((r) => (
                <Link key={r.id} to={`${base}/room/${r.id}`}>
                  <Icon name="frame" size={12} />
                  {r.name}
                </Link>
              ))}
              {project.rooms.length > 2 && (
                <span>+{project.rooms.length - 2}</span>
              )}
            </div>
          )}
          <div className="project-card-meta">
            <span>
              <Icon name="frame" size={12} />
              {project.rooms.length} rooms
            </span>
            <span>
              {project.createdByName || "Owner not available"} ·{" "}
              {formatDate(project.createdAt)}
            </span>
          </div>
          <div className="project-card-bottom">
            <Avatars
              names={members.slice(index, index + 3).map((m) => m.fullName)}
            />
            <Link to={`${base}/projects/${project.id}`} className="text-link">
              Open project
              <Icon name="arrow" size={15} />
            </Link>
          </div>
        </article>
      </ContextMenu>
      {dialogs}
    </>
  );
}

export default function Projects() {
  const { workspace, loading, can, role } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const [create, setCreate] = useState(params.has("create"));
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("grid");
  const all = workspace?.projects || [];
  const projects = all
    .filter(
      (p) =>
        `${p.name} ${p.description || ""}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (filter === "all" ||
          (filter === "rooms" ? p.rooms.length > 0 : p.rooms.length === 0)),
    )
    .toSorted((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "rooms"
          ? b.rooms.length - a.rooms.length
          : (b.createdAt || "").localeCompare(a.createdAt || ""),
    );
  const filtered = query || filter !== "all";
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">A PLACE FOR EVERY AMBITION</div>
          <Heading level={1}>
            Projects<span className="blue-text">.</span>
          </Heading>
          <p>Bring the right people, rooms, and ideas together.</p>
        </div>
        {can.create && (
          <Button variant="primary" icon="plus" onClick={() => setCreate(true)}>
            New project
          </Button>
        )}
      </div>
      <WorkspaceHeader />
      {!can.create && workspace && (
        <PermissionNote role={role}>
          You have read-only access. Ask a workspace owner to create projects
          or change your role.
        </PermissionNote>
      )}
      <div className="list-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search projects…"
          label="Search projects"
        />
        <Select
          aria-label="Filter projects"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All projects</option>
          <option value="rooms">With rooms</option>
          <option value="empty">Without rooms</option>
        </Select>
        <Select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sort projects"
        >
          <option value="recent">Newest first</option>
          <option value="name">Name A–Z</option>
          <option value="rooms">Most rooms</option>
        </Select>
        <span className="list-count">
          {projects.length} of {all.length}
        </span>
        <div className="view-toggle">
          <IconButton
            icon="grid"
            label="Grid view"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          />
          <IconButton
            icon="list"
            label="List view"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          />
        </div>
      </div>
      {loading ? (
        <LoadingState variant="cards" label="Loading projects" />
      ) : projects.length ? (
        <div
          className={`project-collection ${view === "list" ? "list-view" : ""}`}
        >
          {projects.map((p, i) => (
            <ProjectCard key={p.id} project={p} index={i} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={filtered ? "search" : "folder"}
          title={filtered ? "No matching projects" : "Make room for a new project"}
          description={
            filtered
              ? "Try another keyword or clear the filters."
              : "A project brings your rooms, documents, and team into one place."
          }
          action={
            filtered ? (
              <Button
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Clear filters
              </Button>
            ) : can.create ? (
              <Button icon="plus" onClick={() => setCreate(true)}>
                Create project
              </Button>
            ) : undefined
          }
        />
      )}
      {(create || params.has("create")) && can.create && (
        <ResourceDialog
          kind="project"
          onClose={() => {
            setCreate(false);
            setParams({});
          }}
        />
      )}
    </div>
  );
}

export function ProjectDetail() {
  const { projectId } = useParams();
  const { workspace, base, members, documents, assets, activity, can, role } =
    useWorkspace();
  const [params, setParams] = useSearchParams();
  const project = workspace?.projects.find((p) => p.id === projectId);
  const tab = params.get("tab") || "Rooms";
  const setTab = (t: string) => setParams(t === "Rooms" ? {} : { tab: t });
  const [create, setCreate] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("activity");
  const navigate = useNavigate();
  if (!project)
    return (
      <div className="page">
        <EmptyState
          title="Project not found"
          description="It may belong to another workspace. Select the correct workspace or return to projects."
          action={
            <Link className="btn btn-primary" to={`${base}/projects`}>
              Back to projects
            </Link>
          }
        />
      </div>
    );
  const docs = documents.filter((d) => d.projectId === project.id);
  const files = assets.filter((a) => a.projectId === project.id);
  const events = activity.filter(
    (a) =>
      a.target === project.name ||
      a.path.includes(project.id) ||
      project.rooms.some((r) => a.path.includes(r.id)),
  );
  const rooms = project.rooms
    .filter((r) =>
      `${r.name} ${r.description || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .toSorted((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : events.findIndex((e) => e.path.includes(a.id)) === -1
          ? 1
          : events.findIndex((e) => e.path.includes(b.id)) === -1
            ? -1
            : events.findIndex((e) => e.path.includes(a.id)) -
              events.findIndex((e) => e.path.includes(b.id)),
    );
  const counts: Record<string, number> = {
    Rooms: project.rooms.length,
    Documents: docs.length,
    Files: files.length,
    Members: members.length,
    Activity: events.length,
  };
  return (
    <div className="page">
      <div className="page-heading project-heading">
        <div>
          <Breadcrumbs
            items={[
              { label: "All projects", to: `${base}/projects`, icon: "folder" },
              { label: project.name },
            ]}
          />
          <Heading level={1}>
            {project.name}
            <span className="blue-text">.</span>
          </Heading>
          <p>
            {project.description || "A shared space for your team to create."}
          </p>
        </div>
        <div className="page-heading-actions">
          <ResourceActions kind="project" resource={project} />
          {can.manageMembers && (
            <Button icon="users" onClick={() => navigate(`${base}/members`)}>
              Manage members
            </Button>
          )}
          {can.create && (
            <Button
              variant="primary"
              icon="plus"
              onClick={() => setCreate(true)}
            >
              Create room
            </Button>
          )}
        </div>
      </div>
      <div className="project-detail-meta">
        <Avatars names={members.map((m) => m.fullName)} />
        <span>{members.length} workspace members</span>
        <span>Created by {project.createdByName || "your team"}</span>
        <span>{formatDate(project.createdAt)}</span>
        <RoleBadge role={role} />
      </div>
      <div className="tabs" role="tablist">
        {["Rooms", "Documents", "Files", "Members", "Activity"].map((t) => (
          <Button
            variant="ghost"
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
            key={t}
          >
            {t}
            <span className="tab-count">{counts[t]}</span>
          </Button>
        ))}
      </div>
      {tab === "Rooms" && (
        <>
          <div className="list-toolbar">
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Search rooms in this project…"
              label="Search rooms"
            />
            <Select
              aria-label="Sort rooms"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="activity">Recent activity</option>
              <option value="name">Name A–Z</option>
            </Select>
            <span className="list-count">{rooms.length} rooms</span>
          </div>
          <div className="room-grid">
            {rooms.map((r) => (
              <RoomCard
                key={r.id}
                room={r}
                project={project}
                index={project.rooms.indexOf(r)}
                showActions
              />
            ))}
            {can.create && !query && (
              <Button
                className="create-room-tile"
                variant="ghost"
                onClick={() => setCreate(true)}
              >
                <Icon name="plus" size={26} />
                <strong>Create a room</strong>
                <span>A canvas, documents and conversation in one place.</span>
              </Button>
            )}
          </div>
          {!rooms.length && (query || !can.create) && (
            <EmptyState
              icon={query ? "search" : "frame"}
              title={query ? "No matching rooms" : "No rooms yet"}
              description={
                query
                  ? "Try another keyword."
                  : "Rooms created in this project will appear here."
              }
            />
          )}
        </>
      )}
      {tab === "Documents" && (
        <div className="resource-list">
          {docs.map((d) => (
            <Link key={d.id} to={`${base}/documents/${d.id}`}>
              <Icon name="file" />
              <span>
                <strong>{d.title}</strong>
                <small>
                  {d.description || "No description"} · {d.author}
                </small>
              </span>
              <Badge>Local draft</Badge>
              <Icon name="chevron" />
            </Link>
          ))}
          {!docs.length && (
            <div className="compact-empty">No documents in this project yet.</div>
          )}
          {can.create && (
            <Button
              icon="plus"
              onClick={() =>
                navigate(`${base}/documents?create=1&project=${project.id}`)
              }
            >
              Create document
            </Button>
          )}
        </div>
      )}
      {tab === "Files" && (
        <div className="resource-list">
          {files.map((a) => (
            <Link key={a.id} to={`${base}/media`}>
              <Icon name="image" />
              <span>{a.name}</span>
              <Icon name="chevron" />
            </Link>
          ))}
          {!files.length && (
            <div className="compact-empty">No files in this project yet.</div>
          )}
          {can.create && (
            <Button
              icon="upload"
              onClick={() => navigate(`${base}/media?project=${project.id}`)}
            >
              Upload asset
            </Button>
          )}
        </div>
      )}
      {tab === "Members" && (
        <>
          <p className="section-description">
            Workspace membership applies to every project. Project-specific
            permissions are planned and not supported by the current backend.
          </p>
          <div className="resource-list">
            {members.map((m, i) => (
              <div key={m.userId}>
                <Avatar name={m.fullName} tone={i} />
                <span>
                  <strong>{m.fullName}</strong>
                  <small>{m.email}</small>
                </span>
                <RoleBadge role={m.role} />
              </div>
            ))}
          </div>
        </>
      )}
      {tab === "Activity" &&
        (events.length ? (
          <div className="resource-list">
            {events.map((a) => (
              <Link to={`${base}${a.path}`} key={a.id}>
                <Icon name={a.icon} />
                <span>
                  {a.actor} {a.action} {a.target}
                </span>
                <small>{a.time}</small>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="clock"
            title="No activity yet"
            description="Changes to rooms and documents in this project will appear here."
          />
        ))}
      {create && (
        <ResourceDialog
          kind="room"
          parentId={project.id}
          onClose={() => setCreate(false)}
        />
      )}
    </div>
  );
}
export function Rooms() {
  const { workspace, can } = useWorkspace();
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("");
  const [create, setCreate] = useState(false);
  const rooms =
    workspace?.projects
      .filter((p) => !projectId || p.id === projectId)
      .flatMap((p) => p.rooms.map((r) => ({ room: r, project: p })))
      .filter(({ room }) =>
        room.name.toLowerCase().includes(query.toLowerCase()),
      ) || [];
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">SPACE TO THINK, TOGETHER</div>
          <Heading level={1}>
            Your rooms<span className="blue-text">.</span>
          </Heading>
          <p>Every conversation, canvas, and possibility. All in one place.</p>
        </div>
        {can.create && (
          <Button variant="primary" icon="plus" onClick={() => setCreate(true)}>
            Create room
          </Button>
        )}
      </div>
      <div className="list-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Find a room…"
          label="Find a room"
        />
        <Select
          aria-label="Filter by project"
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
        <span className="list-count">{rooms.length} rooms</span>
      </div>
      <div className="room-grid">
        {rooms.map(({ room, project }, i) => (
          <RoomCard
            key={room.id}
            room={room}
            project={project}
            index={i}
            showActions
          />
        ))}
      </div>
      {!rooms.length && (
        <EmptyState
          icon={query ? "search" : "frame"}
          title={query ? "No matching rooms" : "No rooms yet"}
          description={
            query
              ? "Try another keyword or project."
              : "Create a room inside a project to get started."
          }
        />
      )}
      {create && (
        <ResourceDialog kind="room" onClose={() => setCreate(false)} />
      )}
    </div>
  );
}
