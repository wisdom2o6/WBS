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
  Confirm,
  Dropdown,
  EmptyState,
  Heading,
  IconButton,
  Input,
  Select,
  Skeleton,
  useToast,
} from "../components/ui";
import { Icon } from "../components/Icon";
import { ResourceDialog } from "../components/ResourceDialog";
import { RoomCard } from "./Dashboard";
import { errorMessage } from "../services/workspace";
import type { Project, Room } from "../types/workspace";

export default function Projects() {
  const { workspace, members, base, loading, canManage } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const [create, setCreate] = useState(params.has("create"));
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("grid");
  const projects = (workspace?.projects || [])
    .filter(
      (p) =>
        p.name.toLowerCase().includes(query.toLowerCase()) &&
        (filter === "all" ||
          (filter === "rooms" ? p.rooms.length > 0 : p.rooms.length === 0)),
    )
    .toSorted((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : (b.createdAt || "").localeCompare(a.createdAt || ""),
    );
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
        <Button
          variant="primary"
          icon="plus"
          disabled={!canManage}
          onClick={() => setCreate(true)}
        >
          New project
        </Button>
      </div>
      <div className="list-toolbar">
        <div className="search-input">
          <Icon name="search" size={17} />
          <Input
            placeholder="Search projects…"
            aria-label="Search projects"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
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
        </Select>
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
        <Skeleton />
      ) : projects.length ? (
        <div
          className={`project-collection ${view === "list" ? "list-view" : ""}`}
        >
          {projects.map((p, i) => (
            <article className="project-card" key={p.id}>
              <div className="project-card-top">
                <span className={`project-symbol tone-${i % 3}`}>
                  <Icon name="folder" size={22} />
                </span>
                <ResourceActions kind="project" resource={p} />
              </div>
              <Link to={`${base}/projects/${p.id}`}>
                <Heading level={3}>{p.name}</Heading>
                <p>
                  {p.description ||
                    "A shared space to move your next idea forward."}
                </p>
              </Link>
              <div className="project-card-meta">
                <span>{p.rooms.length} rooms</span>
                <span>{p.createdByName || "Owner not available"}</span>
              </div>
              <div className="project-card-bottom">
                <Avatars
                  names={members.slice(i, i + 3).map((m) => m.fullName)}
                />
                <Link to={`${base}/projects/${p.id}`} className="text-link">
                  Open project
                  <Icon name="arrow" size={15} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title={query ? "No matching projects" : "Make room for a new project"}
          description="A project brings your rooms, documents, and team into one place."
          action={
            <Button icon="plus" onClick={() => setCreate(true)}>
              Create project
            </Button>
          }
        />
      )}
      {(create || params.has("create")) && (
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

export function ResourceActions({
  kind,
  resource,
}: {
  kind: "project" | "room";
  resource: Project | Room;
}) {
  const { remove, canManage } = useWorkspace();
  const [edit, setEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();
  return (
    <>
      <Dropdown
        label={
          <span aria-label={`${resource.name} actions`}>
            <Icon name="more" />
          </span>
        }
      >
        <Button
          variant="ghost"
          icon="edit"
          disabled={!canManage}
          onClick={() => setEdit(true)}
        >
          Rename {kind}
        </Button>
        <Button
          variant="ghost"
          icon="trash"
          disabled={!canManage}
          onClick={() => setDeleting(true)}
        >
          Delete {kind}
        </Button>
      </Dropdown>
      {edit && (
        <ResourceDialog
          kind={kind}
          resource={resource}
          onClose={() => setEdit(false)}
        />
      )}
      {deleting && (
        <Confirm
          title={`Delete ${resource.name}?`}
          description="This also removes its associated canvas data. This action cannot be undone."
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            try {
              await remove(kind, resource.id);
              setDeleting(false);
            } catch (err) {
              toast(errorMessage(err), true);
            }
          }}
        />
      )}
    </>
  );
}
export function ProjectDetail() {
  const { projectId } = useParams();
  const { workspace, base, members, documents, assets, activity, canManage } =
    useWorkspace();
  const project = workspace?.projects.find((p) => p.id === projectId);
  const [tab, setTab] = useState("Rooms");
  const [create, setCreate] = useState(false);
  const navigate = useNavigate();
  if (!project)
    return (
      <EmptyState
        title="Project not found"
        description="It may belong to another workspace. Select the correct workspace or return to projects."
        action={
          <Link className="btn btn-primary" to={`${base}/projects`}>
            Back to projects
          </Link>
        }
      />
    );
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <Link className="back-link" to={`${base}/projects`}>
            <Icon name="folder" size={14} />
            All projects
            <Icon name="chevron" size={12} />
          </Link>
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
          <Button icon="users" onClick={() => navigate(`${base}/members`)}>
            Manage members
          </Button>
          <Button
            variant="primary"
            icon="plus"
            onClick={() => setCreate(true)}
            disabled={!canManage}
          >
            Create room
          </Button>
        </div>
      </div>
      <div className="project-detail-meta">
        <Avatars names={members.map((m) => m.fullName)} />
        <span>{members.length} workspace members</span>
        <span>Created by {project.createdByName || "your team"}</span>
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
            {t === "Rooms" && (
              <span className="tab-count">{project.rooms.length}</span>
            )}
          </Button>
        ))}
      </div>
      {tab === "Rooms" && (
        <>
          <div className="section-heading">
            <Heading>Spaces to create together</Heading>
            <span className="muted small-text">
              {project.rooms.length} rooms
            </span>
          </div>
          <div className="room-grid">
            {project.rooms.map((r, i) => (
              <div className="room-with-actions" key={r.id}>
                <RoomCard room={r} project={project} index={i} />
                <div className="room-actions-overlay">
                  <ResourceActions kind="room" resource={r} />
                </div>
              </div>
            ))}
            <Button
              className="create-room-tile"
              variant="ghost"
              onClick={() => setCreate(true)}
            >
              <Icon name="plus" size={26} />
              <strong>Create a room</strong>
              <span>A canvas for your next idea.</span>
            </Button>
          </div>
        </>
      )}
      {tab === "Documents" && (
        <div className="resource-list">
          {documents
            .filter((d) => d.projectId === project.id)
            .map((d) => (
              <Link key={d.id} to={`${base}/documents/${d.id}`}>
                <Icon name="file" />
                <span>
                  <strong>{d.title}</strong>
                  <small>{d.description}</small>
                </span>
                <Badge>Local draft</Badge>
                <Icon name="chevron" />
              </Link>
            ))}
          <Button
            icon="plus"
            onClick={() =>
              navigate(`${base}/documents?create=1&project=${project.id}`)
            }
          >
            Create document
          </Button>
        </div>
      )}
      {tab === "Files" && (
        <div className="resource-list">
          {assets
            .filter((a) => a.projectId === project.id)
            .map((a) => (
              <Link key={a.id} to={`${base}/media`}>
                <Icon name="image" />
                <span>{a.name}</span>
                <Icon name="chevron" />
              </Link>
            ))}
          <Button
            icon="upload"
            onClick={() => navigate(`${base}/media?project=${project.id}`)}
          >
            Upload asset
          </Button>
        </div>
      )}
      {tab === "Members" && (
        <>
          <p className="section-description">
            Workspace membership is shown below. Project-specific permissions
            are not supported by the current backend.
          </p>
          <div className="resource-list">
            {members.map((m, i) => (
              <div key={m.userId}>
                <Avatar name={m.fullName} tone={i} />
                <span>
                  <strong>{m.fullName}</strong>
                  <small>{m.email}</small>
                </span>
                <Badge>{m.role.toLowerCase()}</Badge>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === "Activity" && (
        <div className="resource-list">
          {activity
            .filter(
              (a) =>
                a.target === project.name ||
                a.path.includes(project.id) ||
                project.rooms.some((r) => a.path.includes(r.id)),
            )
            .map((a) => (
              <Link to={`${base}${a.path}`} key={a.id}>
                <Icon name={a.icon} />
                <span>
                  {a.actor} {a.action} {a.target}
                </span>
                <small>{a.time}</small>
              </Link>
            ))}
        </div>
      )}
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
  const { workspace } = useWorkspace();
  const [query, setQuery] = useState("");
  const [create, setCreate] = useState(false);
  const rooms =
    workspace?.projects
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
        <Button variant="primary" icon="plus" onClick={() => setCreate(true)}>
          Create room
        </Button>
      </div>
      <div className="list-toolbar">
        <div className="search-input">
          <Icon name="search" />
          <Input
            placeholder="Find a room…"
            aria-label="Find a room"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <span className="muted">{rooms.length} rooms</span>
      </div>
      <div className="room-grid">
        {rooms.map(({ room, project }, i) => (
          <RoomCard key={room.id} room={room} project={project} index={i} />
        ))}
      </div>
      {!rooms.length && (
        <EmptyState
          title="No rooms yet"
          description="Create a room inside a project to get started."
        />
      )}
      {create && (
        <ResourceDialog kind="room" onClose={() => setCreate(false)} />
      )}
    </div>
  );
}
