import { useState } from "react";
import { Link } from "react-router-dom";
import { useWorkspace } from "../context/WorkspaceContext";
import {
  Avatar,
  Badge,
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
} from "../components/ui";
import { Icon } from "../components/Icon";
import { errorMessage } from "../services/workspace";
import type { Member } from "../types/workspace";

export function Members() {
  const { members, setMembers, addMember, demo, canManage, workspace } =
    useWorkspace();
  const [query, setQuery] = useState("");
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);
  const filtered = members.filter((m) =>
    `${m.fullName} ${m.email}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">GREAT WORK IS A TEAM EFFORT</div>
          <Heading level={1}>
            Your people<span className="blue-text">.</span>
          </Heading>
          <p>
            The people who make {workspace?.name || "your workspace"} what it
            is.
          </p>
        </div>
        <Button
          variant="primary"
          icon="plus"
          disabled={!canManage || !workspace}
          onClick={() => setInviting(true)}
        >
          {demo ? "Add sample member" : "Add existing user"}
        </Button>
      </div>
      <Notice>
        {demo
          ? "Sample members. Role changes and removals affect this demo session only; no invitations are sent."
          : "The current backend supports adding registered users and reading Owner, Admin, and Member roles. Role updates, removal, invitation status, and last-active tracking are not yet available."}
      </Notice>
      <div className="list-toolbar">
        <div className="search-input">
          <Icon name="search" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people…"
            aria-label="Search members"
          />
        </div>
        <span className="muted">{members.length} members</span>
      </div>
      <div className="members-table table-panel">
        <div className="members-table-head">
          <span>MEMBER</span>
          <span>ROLE</span>
          <span>STATUS</span>
          <span>LAST ACTIVE</span>
          <span />
        </div>
        {filtered.map((m, i) => (
          <div className="members-table-row" key={m.userId}>
            <div className="member-name">
              <Avatar name={m.fullName} tone={i} />
              <span>
                <strong>{m.fullName}</strong>
                <small>{m.email}</small>
              </span>
            </div>
            {demo && m.role !== "OWNER" ? (
              <Select
                aria-label={`Role for ${m.fullName}`}
                value={m.role}
                onChange={(e) =>
                  setMembers((prev) =>
                    prev.map((member) =>
                      member.userId === m.userId
                        ? { ...member, role: e.target.value as Member["role"] }
                        : member,
                    ),
                  )
                }
              >
                <option value="ADMIN">Admin</option>
                <option value="EDITOR">Editor</option>
                <option value="VIEWER">Viewer</option>
              </Select>
            ) : (
              <Badge>
                {m.role === "MEMBER" ? "Member" : m.role.toLowerCase()}
              </Badge>
            )}
            <span className="member-status">
              <i />
              {demo ? "Sample member" : "Member"}
            </span>
            <span className="muted small-text">Not tracked</span>
            <IconButton
              icon="trash"
              label={`Remove ${m.fullName}`}
              disabled={!demo || m.role === "OWNER"}
              onClick={() => setRemoving(m)}
            />
          </div>
        ))}
      </div>
      {!filtered.length && (
        <EmptyState
          icon="users"
          title="No members found"
          description="Try another name or email address."
        />
      )}
      {inviting && (
        <Modal
          title={demo ? "Add a sample member" : "Add an existing WBS user"}
          onClose={() => setInviting(false)}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await addMember(email.trim());
                setInviting(false);
                setEmail("");
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Notice>
              {demo
                ? "This adds a sample person locally. No invitation is sent."
                : "Enter the email or username of an already registered user. The backend adds them with the Member role; it does not send an email."}
            </Notice>
            {error && <Notice tone="error">{error}</Notice>}
            <Field label={demo ? "Email address" : "Username or email"}>
              <Input
                required
                type={demo ? "email" : "text"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@company.com"
              />
            </Field>
            <div className="modal-actions">
              <Button onClick={() => setInviting(false)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={busy}>
                {busy ? "Adding…" : "Add member"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {removing && (
        <Confirm
          title={`Remove ${removing.fullName}?`}
          description="This removes the sample member from this demo session only."
          onClose={() => setRemoving(null)}
          onConfirm={() => {
            setMembers((prev) =>
              prev.filter((m) => m.userId !== removing.userId),
            );
            setRemoving(null);
          }}
        />
      )}
    </div>
  );
}
export function Tasks() {
  const { tasks, setTasks, demo, workspace } = useWorkspace();
  const [filter, setFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [project, setProject] = useState(workspace?.projects[0]?.name || "");
  const [due, setDue] = useState("");
  const items = tasks.filter(
    (t) => filter === "all" || (filter === "open" ? !t.done : t.done),
  );
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">A LITTLE FOCUS GOES A LONG WAY</div>
          <Heading level={1}>
            My tasks<span className="blue-text">.</span>
          </Heading>
          <p>Small steps. Meaningful progress.</p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>
          Add {demo ? "demo " : "local "}task
        </Button>
      </div>
      <Notice>
        {demo
          ? "Sample task list. Changes are local to this demo session."
          : "Tasks are local to this session. There is no task persistence or assignment API in the current backend."}
      </Notice>
      <div className="tabs">
        {["all", "open", "completed"].map((f) => (
          <Button
            key={f}
            variant="ghost"
            className={f === filter ? "active" : ""}
            onClick={() => setFilter(f)}
          >
            {f[0].toUpperCase() + f.slice(1)}
            <span className="tab-count">
              {
                tasks.filter(
                  (t) => f === "all" || (f === "open" ? !t.done : t.done),
                ).length
              }
            </span>
          </Button>
        ))}
      </div>
      <div className="task-list">
        {items.map((t) => (
          <div className={`task-row ${t.done ? "done" : ""}`} key={t.id}>
            <Input
              type="checkbox"
              aria-label={`Complete ${t.title}`}
              checked={t.done}
              onChange={() =>
                setTasks((prev) =>
                  prev.map((task) =>
                    task.id === t.id ? { ...task, done: !task.done } : task,
                  ),
                )
              }
            />
            <div>
              <strong>{t.title}</strong>
              <small>{t.project || "Personal task"}</small>
            </div>
            <span
              className={
                t.due === "Today"
                  ? "warning-text small-text"
                  : "muted small-text"
              }
            >
              {t.due}
            </span>
            <IconButton
              icon="trash"
              label={`Delete ${t.title}`}
              onClick={() =>
                setTasks((prev) => prev.filter((task) => task.id !== t.id))
              }
            />
          </div>
        ))}
      </div>
      {!items.length && (
        <EmptyState
          icon="check"
          title="A clear head. A clean slate."
          description="Add a task or switch the filter to see completed work."
        />
      )}
      {adding && (
        <Modal title="Add a local task" onClose={() => setAdding(false)}>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              setTasks((prev) => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  workspaceId: workspace?.id,
                  title: title.trim(),
                  project,
                  due: due || "No due date",
                  done: false,
                },
              ]);
              setTitle("");
              setAdding(false);
            }}
          >
            <Field label="What needs to happen?">
              <Input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label="Project">
              <Select
                value={project}
                onChange={(e) => setProject(e.target.value)}
              >
                <option value="">Personal</option>
                {workspace?.projects.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Due date">
              <Input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </Field>
            <div className="modal-actions">
              <Button type="submit" variant="primary">
                Add task
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
export function Notifications() {
  const { notifications, setNotifications, demo, base } = useWorkspace();
  const [filter, setFilter] = useState("all");
  const items = notifications.filter((n) => filter !== "unread" || !n.read);
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">STAY IN THE LOOP</div>
          <Heading level={1}>
            Notifications<span className="blue-text">.</span>
          </Heading>
          <p>The updates that matter, without the noise.</p>
        </div>
        <Button
          icon="check"
          disabled={!notifications.some((n) => !n.read)}
          onClick={() =>
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
          }
        >
          Mark all as read
        </Button>
      </div>
      {!demo && (
        <Notice>
          Notification delivery is not integrated with the current backend. Live
          room chat remains available inside each room.
        </Notice>
      )}
      <div className="tabs">
        {["all", "unread"].map((f) => (
          <Button
            key={f}
            variant="ghost"
            className={filter === f ? "active" : ""}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All updates" : "Unread"}
          </Button>
        ))}
      </div>
      <div className="notification-list">
        {items.map((n) => (
          <div
            className={`notification-row ${n.read ? "" : "unread"}`}
            key={n.id}
          >
            <span className="notification-icon">
              <Icon
                name={
                  n.type === "mention"
                    ? "chat"
                    : n.type === "document"
                      ? "file"
                      : "users"
                }
              />
            </span>
            <Link
              to={`${base}${n.path}`}
              onClick={() =>
                setNotifications((prev) =>
                  prev.map((item) =>
                    item.id === n.id ? { ...item, read: true } : item,
                  ),
                )
              }
            >
              <strong>{n.title}</strong>
              <p>{n.detail}</p>
              <small>
                {n.time}
                {demo ? " · Sample notification" : ""}
              </small>
            </Link>
            <IconButton
              icon={n.read ? "refresh" : "check"}
              label={n.read ? "Mark unread" : "Mark as read"}
              onClick={() =>
                setNotifications((prev) =>
                  prev.map((item) =>
                    item.id === n.id ? { ...item, read: !item.read } : item,
                  ),
                )
              }
            />
            {!n.read && <span className="unread-dot" />}
          </div>
        ))}
      </div>
      {!items.length && (
        <EmptyState
          icon="bell"
          title="You’re all caught up"
          description={
            demo
              ? "No unread updates. A little room to focus."
              : "No notification service is connected yet."
          }
        />
      )}
    </div>
  );
}
export function ActivityFeed() {
  const { activity, demo, base } = useWorkspace();
  const [query, setQuery] = useState("");
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">PROGRESS, IN PERSPECTIVE</div>
          <Heading level={1}>
            Workspace activity<span className="blue-text">.</span>
          </Heading>
          <p>
            {demo
              ? "Sample team activity and changes from this session."
              : "Actions performed in this browser session. A server audit trail is not yet available."}
          </p>
        </div>
      </div>
      <div className="list-toolbar">
        <div className="search-input">
          <Icon name="search" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search activity"
            placeholder="Find an update…"
          />
        </div>
      </div>
      <div className="activity-feed">
        {activity
          .filter((a) =>
            `${a.actor} ${a.target} ${a.action}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((a, i) => (
            <Link key={a.id} to={`${base}${a.path}`}>
              <Avatar name={a.actor} tone={i} />
              <div>
                <strong>{a.actor}</strong> {a.action} <b>{a.target}</b>
                <small>{a.time}</small>
              </div>
              <Icon name={a.icon} />
            </Link>
          ))}
      </div>
      {!activity.length && (
        <EmptyState
          icon="clock"
          title="Your story starts here"
          description="Create a project or a room to see your session activity."
        />
      )}
    </div>
  );
}
