import { useEffect, useMemo, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import {
  Avatar,
  Button,
  Dropdown,
  EmptyState,
  IconButton,
  Input,
  Logo,
  Modal,
  Notice,
} from "../components/ui";
import { Icon } from "../components/Icon";
import { ResourceDialog } from "../components/ResourceDialog";
import {
  Breadcrumbs,
  MenuDivider,
  MenuItem,
  NotificationItem,
  PlannedBadge,
  roleLabel,
} from "../components/patterns";
import { roleDescriptions } from "../services/permissions";
import type { Role } from "../services/permissions";

const navItems = [
  { path: "/workspace", label: "Overview", icon: "home" },
  { path: "/projects", label: "Projects", icon: "folder" },
  { path: "/tasks", label: "My tasks", icon: "tasks" },
  { path: "/rooms", label: "Recent rooms", icon: "clock" },
  { path: "/media", label: "Media library", icon: "image" },
  { path: "/documents", label: "Shared documents", icon: "file" },
  { path: "/members", label: "Members", icon: "users" },
];
export function WorkspaceLayout() {
  const {
    workspace,
    workspaces,
    selectWorkspace,
    demo,
    base,
    notifications,
    tasks,
    error,
    refresh,
    role,
    setPreviewRole,
    setNotifications,
  } = useWorkspace();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileState, setMobileState] = useState({
    path: location.pathname,
    open: false,
  });
  const mobile = mobileState.path === location.pathname && mobileState.open;
  const setMobile = (open: boolean) =>
    setMobileState({ path: location.pathname, open });
  const [searchOpen, setSearchOpen] = useState(false);
  const [createWorkspace, setCreateWorkspace] = useState(false);
  const [expanded, setExpanded] = useState<string[]>(["brand"]);
  const [help, setHelp] = useState(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === "Escape")
        setMobileState((prev) => ({ ...prev, open: false }));
    };
    const openSearch = () => setSearchOpen(true);
    window.addEventListener("keydown", key);
    window.addEventListener("wbs:search", openSearch);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("wbs:search", openSearch);
    };
  }, []);
  const current =
    navItems.find((n) => location.pathname.includes(n.path))?.label ||
    (location.pathname.includes("/room/")
      ? "Room workspace"
      : location.pathname.includes("/settings")
        ? "Settings"
        : location.pathname.includes("/notifications")
          ? "Notifications"
          : location.pathname.includes("/activity")
            ? "Activity"
            : location.pathname.includes("/system")
              ? "Design system"
              : "Project");
  const crumbs = useMemo(() => {
    const items: { label: string; to?: string; icon?: string }[] = [
      { label: workspace?.name || "Workspace", to: `${base}/workspace` },
    ];
    const path = location.pathname.replace(/^\/demo/, "");
    const roomMatch = path.match(/^\/room\/([^/]+)/);
    const projectMatch = path.match(/^\/projects\/([^/]+)/);
    if (roomMatch) {
      const project = workspace?.projects.find((p) =>
        p.rooms.some((r) => r.id === roomMatch[1]),
      );
      const room = project?.rooms.find((r) => r.id === roomMatch[1]);
      items.push({ label: "Projects", to: `${base}/projects` });
      if (project)
        items.push({ label: project.name, to: `${base}/projects/${project.id}` });
      items.push({ label: room?.name || "Room" });
    } else if (projectMatch) {
      const project = workspace?.projects.find((p) => p.id === projectMatch[1]);
      items.push({ label: "Projects", to: `${base}/projects` });
      items.push({ label: project?.name || "Project" });
    } else if (path.startsWith("/documents/")) {
      items.push({ label: "Shared documents", to: `${base}/documents` });
      items.push({ label: "Document" });
    } else items.push({ label: current });
    return items;
  }, [location.pathname, workspace, base, current]);
  const unread = notifications.filter((n) => !n.read).length;
  const displayName = demo
    ? "Alex Morgan"
    : user?.fullName || user?.username || "Your account";
  const projects = workspace?.projects || [];
  return (
    <div
      className={`app-shell ${collapsed ? "sidebar-collapsed" : ""} ${mobile ? "mobile-nav-open" : ""}`}
    >
      {mobile && (
        <div className="sidebar-scrim" onClick={() => setMobile(false)} />
      )}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Link
            to={`${base}/workspace`}
            aria-label={collapsed ? "Expand sidebar" : "WBS workspace"}
            title={collapsed ? "Expand sidebar" : "WBS workspace"}
            onClick={(e) => {
              if (collapsed) {
                e.preventDefault();
                setCollapsed(false);
              }
            }}
          >
            <Logo />
          </Link>
          <IconButton
            icon="panel"
            label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed(!collapsed)}
          />
        </div>
        <div className="workspace-switcher">
          <Dropdown
            label={
              <>
                <span className="workspace-monogram">
                  {workspace?.name.slice(0, 1) || "W"}
                </span>
                <span className="workspace-name">
                  <strong>{workspace?.name || "Your workspace"}</strong>
                  <small>{demo ? "Demo workspace" : "Team workspace"}</small>
                </span>
                <Icon name="down" size={15} />
              </>
            }
          >
            <span className="menu-label">YOUR WORKSPACES</span>
            {workspaces.map((w) => (
              <Button
                key={w.id}
                variant="ghost"
                onClick={() => {
                  selectWorkspace(w.id);
                  navigate(`${base}/workspace`);
                }}
              >
                <span className="workspace-monogram small">{w.name[0]}</span>
                {w.name}
                {workspace?.id === w.id && <Icon name="check" size={14} />}
              </Button>
            ))}
            <div className="menu-divider" />
            <Button
              variant="ghost"
              icon="plus"
              onClick={() => setCreateWorkspace(true)}
            >
              Create workspace
            </Button>
          </Dropdown>
        </div>
        <div className="sidebar-scroll">
          <div className="nav-label">WORKSPACE</div>
          <nav aria-label="Workspace navigation">
            {navItems.map((item, i) => (
              <NavLink
                key={item.path}
                to={`${base}${item.path}`}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `nav-item ${isActive ? "active" : ""} ${i === 4 ? "nav-section-start" : ""}`
                }
              >
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
                {item.path === "/media" && <PlannedBadge label="Beta" />}
                {item.path === "/tasks" &&
                  tasks.filter((t) => !t.done).length > 0 && (
                    <small className="nav-count">
                      {tasks.filter((t) => !t.done).length}
                    </small>
                  )}
              </NavLink>
            ))}
          </nav>
          <div className="nav-label project-nav-label">
            <span>YOUR PROJECTS</span>
            <IconButton
              icon="plus"
              label="Create project"
              onClick={() => navigate(`${base}/projects?create=1`)}
            />
          </div>
          <div className="project-tree">
            {projects.map((p, i) => (
              <div key={p.id}>
                <div className="project-tree-row">
                  <Button
                    variant="ghost"
                    className="tree-expand"
                    aria-label={`${expanded.includes(p.id) ? "Collapse" : "Expand"} ${p.name}`}
                    aria-expanded={expanded.includes(p.id)}
                    onClick={() =>
                      setExpanded((prev) =>
                        prev.includes(p.id)
                          ? prev.filter((id) => id !== p.id)
                          : [...prev, p.id],
                      )
                    }
                  >
                    <Icon
                      name={expanded.includes(p.id) ? "down" : "chevron"}
                      size={13}
                    />
                  </Button>
                  <Link to={`${base}/projects/${p.id}`}>
                    <span className={`project-dot tone-${i % 3}`} />
                    <span>{p.name}</span>
                  </Link>
                </div>
                {expanded.includes(p.id) && (
                  <div className="project-tree-rooms">
                    {p.rooms.map((r) => (
                      <NavLink key={r.id} to={`${base}/room/${r.id}`}>
                        <Icon name="frame" size={13} />
                        <span>{r.name}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="sidebar-bottom">
          <Button variant="ghost" icon="help" onClick={() => setHelp(true)}>
            <span>Help & getting started</span>
            <Icon name="diagonal" size={14} />
          </Button>
          <NavLink className="nav-item" to={`${base}/settings`}>
            <Icon name="settings" />
            <span>Settings</span>
          </NavLink>
        </div>
        <div className="sidebar-profile">
          <Dropdown
            label={
              <>
                <Avatar name={displayName} />
                <span className="profile-name">
                  <strong>{displayName}</strong>
                  <small>{demo ? "Demo account" : user?.email}</small>
                </span>
                <Icon name="down" size={14} />
              </>
            }
          >
            <Button
              variant="ghost"
              icon="settings"
              onClick={() => navigate(`${base}/settings`)}
            >
              Account settings
            </Button>
            <Button
              variant="ghost"
              icon="logout"
              onClick={() => {
                if (!demo) logout();
                navigate("/login");
              }}
            >
              {demo ? "Sign in to WBS" : "Sign out"}
            </Button>
          </Dropdown>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <IconButton
            icon="menu"
            label="Open navigation"
            className="mobile-menu"
            onClick={() => setMobile(!mobile)}
          />
          <div className="breadcrumb">
            <Breadcrumbs items={crumbs} />
          </div>
          <div className="topbar-actions">
            {demo && (
              <Dropdown
                className="demo-role-switch"
                ariaLabel="Demo workspace options"
                label={
                  <span className="demo-tag">
                    <span className="status-dot" />
                    Demo · {roleLabel(role)}
                    <Icon name="down" size={12} />
                  </span>
                }
              >
                <span className="menu-label">PREVIEW PERMISSIONS AS</span>
                {(["OWNER", "MEMBER", "VIEWER"] as Role[]).map((r) => (
                  <MenuItem
                    key={r}
                    icon={r === "OWNER" ? "star" : r === "VIEWER" ? "eye" : "users"}
                    onClick={() => setPreviewRole(r)}
                    badge={role === r ? <Icon name="check" size={14} /> : undefined}
                  >
                    <span className="role-option">
                      <strong>{roleLabel(r)}</strong>
                      <small>
                        {roleDescriptions[r as "OWNER"].summary}
                      </small>
                    </span>
                  </MenuItem>
                ))}
                <MenuDivider />
                <MenuItem icon="logout" onClick={() => navigate("/login")}>
                  Sign in to WBS
                </MenuItem>
              </Dropdown>
            )}
            <Button
              variant="ghost"
              className="global-search"
              onClick={() => setSearchOpen(true)}
            >
              <Icon name="search" size={17} />
              <span>Search anything…</span>
              <kbd>⌘ K</kbd>
            </Button>
            <Dropdown
              className="notification-popover"
              menuClassName="notification-menu"
              ariaLabel={`Notifications, ${unread} unread`}
              label={
                <span className="notification-button">
                  <Icon name="bell" size={19} />
                  {unread > 0 && <i />}
                </span>
              }
            >
              <div
                className="notification-menu-head"
                onClick={(e) => e.stopPropagation()}
              >
                <strong>Notifications</strong>
                {unread > 0 && <span className="tab-count">{unread}</span>}
                <Button
                  variant="ghost"
                  disabled={!unread}
                  onClick={() =>
                    setNotifications((prev) =>
                      prev.map((n) => ({ ...n, read: true })),
                    )
                  }
                >
                  Mark all read
                </Button>
              </div>
              <div className="notification-menu-list">
                {notifications.slice(0, 5).map((n) => (
                  <NotificationItem
                    key={n.id}
                    compact
                    {...n}
                    to={`${base}${n.path}`}
                    onOpen={() =>
                      setNotifications((prev) =>
                        prev.map((item) =>
                          item.id === n.id ? { ...item, read: true } : item,
                        ),
                      )
                    }
                  />
                ))}
                {!notifications.length && (
                  <p className="compact-empty">
                    {demo
                      ? "You’re all caught up."
                      : "No notification service is connected yet."}
                  </p>
                )}
              </div>
              <Link
                className="notification-menu-footer"
                to={`${base}/notifications`}
              >
                View all notifications
                <Icon name="arrow" size={14} />
              </Link>
            </Dropdown>
            <div className="topbar-divider" />
            <Dropdown label={<Avatar name={displayName} size="small" />}>
              <Button
                variant="ghost"
                onClick={() => navigate(`${base}/settings`)}
              >
                My account
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (!demo) logout();
                  navigate("/login");
                }}
              >
                {demo ? "Sign in" : "Sign out"}
              </Button>
            </Dropdown>
          </div>
        </header>
        {error && (
          <div className="connection-notice">
            <Notice tone="error">
              {error}{" "}
              <Button variant="ghost" onClick={refresh}>
                Retry connection
              </Button>
            </Notice>
          </div>
        )}
        <main id="main-content">
          <Outlet />
        </main>
      </div>
      {searchOpen && <CommandSearch onClose={() => setSearchOpen(false)} />}
      {createWorkspace && (
        <ResourceDialog
          kind="workspace"
          onClose={() => setCreateWorkspace(false)}
        />
      )}
      {help && (
        <Modal
          title="A little space to do great work."
          onClose={() => setHelp(false)}
        >
          <div className="form-stack">
            <p>
              Organize your work in workspaces, group it into projects, and
              bring ideas together in rooms.
            </p>
            <Notice>
              {demo
                ? "You are exploring sample data. Demo changes are local to this session; no messages, invitations, or uploads are sent to a server."
                : "Canvas, live chat and workspace management use your existing WBS backend. Other modules show their integration status in context."}
            </Notice>
            <p className="muted">
              Use Ctrl / ⌘ K to search. In the canvas, hold Space to pan and
              scroll to zoom.
            </p>
            <Link
              className="help-link"
              to={`${base}/system`}
              onClick={() => setHelp(false)}
            >
              <Icon name="layers" size={16} />
              <span>
                <strong>Design system & module status</strong>
                <small>
                  Components, interaction states and what is implemented today.
                </small>
              </span>
              <Icon name="arrow" size={14} />
            </Link>
            <Button
              variant="primary"
              onClick={() => {
                setHelp(false);
                navigate(`${base}/projects`);
              }}
            >
              Explore projects
              <Icon name="arrow" size={16} />
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CommandSearch({ onClose }: { onClose: () => void }) {
  const { workspace, workspaces, documents, assets, members, base } =
    useWorkspace();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem("wbs:searches") || "[]");
    } catch {
      return [];
    }
  });
  const navigate = useNavigate();
  const results = useMemo(
    () =>
      [
        ...workspaces.map((w) => ({
          title: w.name,
          type: "Workspace",
          icon: "home",
          path: "/workspace",
          workspaceId: w.id,
        })),
        ...(workspace?.projects || []).flatMap((p) => [
          {
            title: p.name,
            type: "Project",
            icon: "folder",
            path: `/projects/${p.id}`,
          },
          ...p.rooms.map((r) => ({
            title: r.name,
            type: "Room",
            icon: "frame",
            path: `/room/${r.id}`,
          })),
        ]),
        ...documents
          .filter((d) => d.workspaceId === workspace?.id)
          .map((d) => ({
            title: d.title,
            type: "Document",
            icon: "file",
            path: `/documents/${d.id}`,
          })),
        ...assets
          .filter((a) => a.workspaceId === workspace?.id)
          .map((a) => ({
            title: a.name,
            type: "File",
            icon: "image",
            path: "/media",
          })),
        ...members.map((m) => ({
          title: m.fullName,
          type: "Member",
          icon: "users",
          path: "/members",
        })),
      ]
        .filter((r) => r.title.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 12),
    [query, workspace, workspaces, documents, assets, members],
  );
  const { selectWorkspace } = useWorkspace();
  const go = (index: number) => {
    const item = results[index];
    if (!item) return;
    const values = [
      query || item.title,
      ...recent.filter((s) => s !== query),
    ].slice(0, 5);
    setRecent(values);
    sessionStorage.setItem("wbs:searches", JSON.stringify(values));
    if ("workspaceId" in item) selectWorkspace(item.workspaceId as string);
    navigate(`${base}${item.path}`);
    onClose();
  };
  return (
    <Modal title="Search your workspace" onClose={onClose} wide>
      <div className="command-search">
        <Icon name="search" />
        <Input
          autoFocus
          placeholder="Projects, rooms, documents, files, people…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((v) => Math.min(v + 1, results.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((v) => Math.max(v - 1, 0));
            }
            if (e.key === "Enter") go(active);
          }}
          aria-label="Search"
        />
      </div>
      {!query && recent.length > 0 && (
        <div className="recent-searches">
          <span className="eyebrow">RECENT SEARCHES</span>
          {recent.map((s) => (
            <Button
              key={s}
              variant="ghost"
              icon="clock"
              onClick={() => setQuery(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      )}
      <div className="search-results">
        {results.map((r, i) => (
          <Button
            key={`${r.type}-${r.title}`}
            variant="ghost"
            className={i === active ? "selected" : ""}
            onMouseEnter={() => setActive(i)}
            onClick={() => go(i)}
          >
            <Icon name={r.icon} />
            <span>{r.title}</span>
            <small>{r.type}</small>
            <Icon name="arrow" size={15} />
          </Button>
        ))}
      </div>
      {results.length === 0 && (
        <EmptyState
          icon="search"
          title="Nothing found"
          description="Try a different keyword or a resource name."
        />
      )}
      <div className="command-footer">
        <span>↑ ↓ to navigate · Enter to open</span>
        <span>Esc to close</span>
      </div>
    </Modal>
  );
}
