import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import {
  Avatar,
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
  useToast,
} from "../components/ui";
import {
  PermissionNote,
  RoleBadge,
  SearchField,
  roleLabel,
} from "../components/patterns";
import { roleDescriptions } from "../services/permissions";
import { Icon } from "../components/Icon";
import { errorMessage } from "../services/workspace";
import type { Member } from "../types/workspace";

const API_BASE = (
  import.meta.env.VITE_API_URL || "https://wbs-s6f8.onrender.com"
).replace(/\/$/, "");

function getAuthToken(): string {
  const direct =
    localStorage.getItem("accessToken") ||
    sessionStorage.getItem("accessToken") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("wbs_token") ||
    localStorage.getItem("auth_token");
  if (direct) return direct;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const val = localStorage.getItem(key) || "";
    if (val.startsWith("eyJ")) return val;
    try {
      const parsed = JSON.parse(val);
      if (typeof parsed?.token === "string") return parsed.token;
      if (typeof parsed?.accessToken === "string") return parsed.accessToken;
    } catch {
      // ignore non-JSON storage values
    }
  }
  return "";
}

async function projectMemberRequest<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = `Lỗi ${res.status}`;
    try {
      const data = await res.json();
      msg = data?.message || data?.error || msg;
    } catch {
      // ignore empty error body
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function Members() {
  const {
    members,
    setMembers,
    addMember,
    demo,
    can,
    role,
    workspace,
  } = useWorkspace();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [inviting, setInviting] = useState(params.has("invite"));
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Member["role"]>("MEMBER");
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [assigningMember, setAssigningMember] = useState<Member | null>(null);
  const toast = useToast();
  const me = demo ? "alex" : user?.username;
  const group = (r: Member["role"]) =>
    r === "ADMIN" ? "OWNER" : r === "EDITOR" ? "MEMBER" : r;
  const filtered = members.filter(
    (m) =>
      `${m.fullName} ${m.email} ${m.username}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (roleFilter === "ALL" || group(m.role) === roleFilter),
  );
  const count = (r: string) =>
    r === "ALL" ? members.length : members.filter((m) => group(m.role) === r).length;
  const closeInvite = () => {
    setInviting(false);
    setEmail("");
    setError("");
    setEmailError("");
    if (params.has("invite")) setParams({});
  };
  return (
    <div className="page members-page">
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
        {can.manageMembers && workspace && (
          <Button
            variant="primary"
            icon="plus"
            onClick={() => setInviting(true)}
          >
            {demo ? "Invite member" : "Add existing user"}
          </Button>
        )}
      </div>
      {can.manageMembers ? (
        <Notice>
          {demo
            ? "Sample members. Invitations, role changes and removals affect this demo session only; no email is sent."
            : "Sau khi thêm thành viên vào Workspace, bấm nút Phân công ở từng thành viên để cấp quyền (Member hoặc Viewer) trong từng Project."}
        </Notice>
      ) : (
        <PermissionNote role={role}>
          Only workspace owners can invite, remove or change the role of
          members. You can view who belongs to this workspace.
        </PermissionNote>
      )}
      <div className="members-layout">
        <div className="members-main">
          <div className="list-toolbar">
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Search by name or email…"
              label="Search members"
            />
            <div className="segmented" role="tablist" aria-label="Filter by role">
              {["ALL", "OWNER", "MEMBER", "VIEWER"].map((r) => (
                <button
                  key={r}
                  type="button"
                  role="tab"
                  aria-selected={roleFilter === r}
                  className={roleFilter === r ? "active" : ""}
                  onClick={() => setRoleFilter(r)}
                >
                  {r === "ALL" ? "All" : roleLabel(r as Member["role"])}
                  <span>{count(r)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="members-table table-panel">
            <div className="members-table-head">
              <span>MEMBER</span>
              <span>ROLE</span>
              <span>JOINED</span>
              <span />
            </div>
            {filtered.map((m, i) => {
              const self = m.username === me;
              const editable =
                can.manageMembers && demo && m.role !== "OWNER" && !self;
              const assignable =
                can.manageMembers && !demo && m.role !== "OWNER" && !self && !!workspace;
              return (
                <div className="members-table-row" key={m.userId}>
                  <div className="member-name">
                    <Avatar name={m.fullName} tone={i} />
                    <span>
                      <strong>
                        {m.fullName}
                        {self && <em className="you-tag">You</em>}
                      </strong>
                      <small>{m.email}</small>
                    </span>
                  </div>
                  {editable ? (
                    <Select
                      aria-label={`Role for ${m.fullName}`}
                      value={group(m.role)}
                      onChange={(e) => {
                        setMembers((prev) =>
                          prev.map((member) =>
                            member.userId === m.userId
                              ? {
                                  ...member,
                                  role: e.target.value as Member["role"],
                                }
                              : member,
                          ),
                        );
                        toast(
                          `${m.fullName} is now ${roleLabel(e.target.value as Member["role"]).toLowerCase()}.`,
                        );
                      }}
                    >
                      <option value="MEMBER">Member</option>
                      <option value="VIEWER">Viewer</option>
                    </Select>
                  ) : (
                    <span>
                      <RoleBadge role={m.role} />
                    </span>
                  )}
                  <span className="muted small-text">
                    {m.joinedAt
                      ? new Date(m.joinedAt).toLocaleDateString("en", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                  </span>
                  {editable ? (
                    <IconButton
                      icon="trash"
                      label={`Remove ${m.fullName}`}
                      onClick={() => setRemoving(m)}
                    />
                  ) : assignable ? (
                    <Button onClick={() => setAssigningMember(m)}>
                      Phân công
                    </Button>
                  ) : (
                    <span />
                  )}
                </div>
              );
            })}
            {!filtered.length && (
              <div className="members-empty">
                <EmptyState
                  icon="users"
                  title="No members found"
                  description="Try another name, email address or role."
                  action={
                    <Button
                      onClick={() => {
                        setQuery("");
                        setRoleFilter("ALL");
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              </div>
            )}
          </div>
        </div>
        <aside className="roles-panel" aria-label="Roles and permissions">
          <span className="eyebrow">ROLES & PERMISSIONS</span>
          {(["OWNER", "MEMBER", "VIEWER"] as const).map((r) => (
            <div
              key={r}
              className={`role-card ${group(role) === r ? "current" : ""}`}
            >
              <div>
                <RoleBadge role={r} />
                {group(role) === r && <small>Your role</small>}
              </div>
              <strong>{roleDescriptions[r].summary}</strong>
              <ul>
                {roleDescriptions[r].abilities.map((a) => (
                  <li key={a} className={a.startsWith("Cannot") ? "denied" : ""}>
                    <Icon name={a.startsWith("Cannot") ? "close" : "check"} size={12} />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </aside>
      </div>
      {inviting && can.manageMembers && (
        <Modal
          title={demo ? "Invite a member" : "Add an existing WBS user"}
          onClose={closeInvite}
        >
          <form
            className="form-stack"
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              const value = email.trim();
              if (!value) {
                setEmailError("Enter an email address.");
                return;
              }
              if (demo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                setEmailError("Enter a valid email address.");
                return;
              }
              if (members.some((m) => m.email === value || m.username === value)) {
                setEmailError("This person is already a member.");
                return;
              }
              setBusy(true);
              setError("");
              try {
                await addMember(value, demo ? inviteRole : "MEMBER");
                closeInvite();
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="dialog-intro">
              {demo
                ? "Add a teammate to Studio North and choose what they can do."
                : "Enter the username or email of someone who already has a WBS account."}
            </p>
            {error && <Notice tone="error">{error}</Notice>}
            <Field
              label={demo ? "Email address" : "Username or email"}
              error={emailError}
            >
              <Input
                autoFocus
                type={demo ? "email" : "text"}
                value={email}
                aria-invalid={!!emailError}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError("");
                }}
                placeholder="teammate@company.com"
              />
            </Field>
            {demo && (
              <Field
                label="Role"
                hint={
                  roleDescriptions[inviteRole === "VIEWER" ? "VIEWER" : "MEMBER"].summary
                }
              >
                <div className="role-picker" role="radiogroup" aria-label="Role">
                  {(["MEMBER", "VIEWER"] as const).map((r) => (
                    <button
                      type="button"
                      key={r}
                      role="radio"
                      aria-checked={inviteRole === r}
                      className={inviteRole === r ? "active" : ""}
                      onClick={() => setInviteRole(r)}
                    >
                      <Icon name={r === "VIEWER" ? "eye" : "users"} size={15} />
                      <span>
                        <strong>{roleLabel(r)}</strong>
                        <small>{roleDescriptions[r].summary}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </Field>
            )}
            <Notice>
              {demo
                ? "No email is sent. The person is added to this demo session only."
                : "Sau khi thêm vào Workspace, bạn có thể bấm Phân công để cấp quyền Member hoặc Viewer cho từng Project."}
            </Notice>
            <div className="modal-actions">
              <Button onClick={closeInvite}>Cancel</Button>
              <Button type="submit" variant="primary" loading={busy}>
                {busy ? "Adding…" : "Add member"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {removing && (
        <Confirm
          title={`Remove ${removing.fullName}?`}
          description={`${removing.fullName} will lose access to ${workspace?.name || "this workspace"}, its projects and rooms. In the demo this affects this session only.`}
          confirmLabel="Remove member"
          onClose={() => setRemoving(null)}
          onConfirm={() => {
            setMembers((prev) =>
              prev.filter((m) => m.userId !== removing.userId),
            );
            toast(`${removing.fullName} was removed.`);
            setRemoving(null);
          }}
        />
      )}
      {assigningMember && (
        <MemberProjectAssignModal
          member={assigningMember}
          projects={workspace?.projects || []}
          onClose={() => setAssigningMember(null)}
        />
      )}
    </div>
  );
}

interface WorkspaceProjectSummary {
  id: string;
  name: string;
  description?: string;
}

function MemberProjectAssignModal({
  member,
  projects,
  onClose,
}: {
  member: Member;
  projects: WorkspaceProjectSummary[];
  onClose: () => void;
}) {
  const toast = useToast();
  const [assignments, setAssignments] = useState<
    Record<string, "MEMBER" | "VIEWER">
  >({});
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [assignRole, setAssignRole] = useState<"MEMBER" | "VIEWER">("MEMBER");
  const [loadingInit, setLoadingInit] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadAssignments = async () => {
    setLoadingInit(true);
    setError("");
    try {
      const results = await Promise.all(
        projects.map(async (p) => {
          const list = await projectMemberRequest<
            { userId: string; role?: string }[]
          >(`/api/v1/projects/${p.id}/members`);
          const found = list.find((item) => item.userId === member.userId);
          if (!found) return null;
          const normalizedRole: "MEMBER" | "VIEWER" =
            found.role?.toUpperCase() === "VIEWER" ? "VIEWER" : "MEMBER";
          return [p.id, normalizedRole] as const;
        }),
      );
      const next: Record<string, "MEMBER" | "VIEWER"> = {};
      for (const entry of results) {
        if (entry) next[entry[0]] = entry[1];
      }
      setAssignments(next);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingInit(false);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, [member.userId]);

  const assignedIds = Object.keys(assignments);
  const unassignedProjects = projects.filter(
    (p) => !assignedIds.includes(p.id),
  );
  const assignedProjects = projects.filter((p) => assignedIds.includes(p.id));

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    setBusy(true);
    setError("");
    try {
      await projectMemberRequest(
        `/api/v1/projects/${selectedProjectId}/members`,
        {
          method: "POST",
          body: JSON.stringify({
            userId: member.userId,
            email: member.email,
            role: assignRole,
          }),
        },
      );
      const proj = projects.find((p) => p.id === selectedProjectId);
      setAssignments((prev) => ({ ...prev, [selectedProjectId]: assignRole }));
      setSelectedProjectId("");
      toast(
        `Đã phân công ${member.fullName} (${assignRole === "VIEWER" ? "Viewer" : "Member"}) vào ${proj?.name || "Project"}.`,
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleChangeProjectRole = async (
    projectId: string,
    nextRole: "MEMBER" | "VIEWER",
  ) => {
    setBusy(true);
    setError("");
    try {
      await projectMemberRequest(
        `/api/v1/projects/${projectId}/members/${member.userId}/role`,
        {
          method: "PATCH",
          body: JSON.stringify({ role: nextRole }),
        },
      );
      const proj = projects.find((p) => p.id === projectId);
      setAssignments((prev) => ({ ...prev, [projectId]: nextRole }));
      toast(
        `Đã chuyển ${member.fullName} sang quyền ${nextRole === "VIEWER" ? "Viewer (chỉ xem)" : "Member"} trong ${proj?.name || "Project"}.`,
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleUnassign = async (projectId: string) => {
    setBusy(true);
    setError("");
    try {
      await projectMemberRequest(
        `/api/v1/projects/${projectId}/members/${member.userId}`,
        { method: "DELETE" },
      );
      const proj = projects.find((p) => p.id === projectId);
      setAssignments((prev) => {
        const copy = { ...prev };
        delete copy[projectId];
        return copy;
      });
      toast(`Đã hủy phân công khỏi ${proj?.name || "Project"}.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Phân công Project · ${member.fullName}`}
      onClose={onClose}
    >
      <div className="form-stack">
        <p className="dialog-intro">
          Chọn Project và vai trò (<strong>Member</strong> hoặc{" "}
          <strong>Viewer</strong>) cho <strong>{member.email}</strong>, hoặc
          bấm <strong>Hủy</strong> khi thành viên hoàn thành công việc.
        </p>

        {error && <Notice tone="error">{error}</Notice>}

        <form onSubmit={handleAssign} className="form-stack">
          <Field label="Thêm vào Project">
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <Select
                aria-label="Chọn Project"
                value={selectedProjectId}
                disabled={busy || loadingInit || unassignedProjects.length === 0}
                style={{ flex: "1 1 180px" }}
                onChange={(e) => setSelectedProjectId(e.target.value)}
              >
                <option value="">
                  {unassignedProjects.length === 0
                    ? "Đã được phân công vào tất cả Project"
                    : "-- Chọn Project --"}
                </option>
                {unassignedProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Chọn vai trò trong Project"
                value={assignRole}
                disabled={busy || loadingInit || unassignedProjects.length === 0}
                style={{ width: "auto", minWidth: 112 }}
                onChange={(e) =>
                  setAssignRole(e.target.value as "MEMBER" | "VIEWER")
                }
              >
                <option value="MEMBER">Member</option>
                <option value="VIEWER">Viewer</option>
              </Select>
              <Button
                type="submit"
                variant="primary"
                disabled={!selectedProjectId || busy || loadingInit}
              >
                Phân công
              </Button>
            </div>
          </Field>
        </form>

        <Field label={`Đang tham gia (${assignedProjects.length} Project)`}>
          {loadingInit ? (
            <p className="muted small-text">Đang tải danh sách phân công…</p>
          ) : assignedProjects.length === 0 ? (
            <Notice>
              Thành viên này chưa được phân công vào Project nào nên chưa thấy phòng làm việc.
            </Notice>
          ) : (
            <div className="task-list">
              {assignedProjects.map((p) => (
                <div className="task-row" key={p.id}>
                  <div>
                    <strong>{p.name}</strong>
                    {p.description && <small>{p.description}</small>}
                  </div>
                  <Select
                    aria-label={`Vai trò trong ${p.name}`}
                    value={assignments[p.id] || "MEMBER"}
                    disabled={busy}
                    style={{ width: "auto", minWidth: 112 }}
                    onChange={(e) =>
                      handleChangeProjectRole(
                        p.id,
                        e.target.value as "MEMBER" | "VIEWER",
                      )
                    }
                  >
                    <option value="MEMBER">Member</option>
                    <option value="VIEWER">Viewer</option>
                  </Select>
                  <Button
                    disabled={busy}
                    onClick={() => handleUnassign(p.id)}
                  >
                    Hủy
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Field>

        <div className="modal-actions">
          <Button onClick={onClose}>Đóng</Button>
        </div>
      </div>
    </Modal>
  );
}

// Modal tái sử dụng nếu muốn gắn nút "Phân công" trực tiếp trong trang chi tiết từng Project
export function ProjectMembersModal({
  projectId,
  projectName,
  onClose,
}: {
  projectId: string;
  projectName: string;
  onClose: () => void;
}) {
  const { members, can } = useWorkspace();
  const toast = useToast();
  const [assigned, setAssigned] = useState<
    { userId: string; fullName: string; email: string; role?: string }[]
  >([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"MEMBER" | "VIEWER">(
    "MEMBER",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadAssigned = async () => {
    try {
      const list = await projectMemberRequest<
        { userId: string; fullName: string; email: string; role?: string }[]
      >(`/api/v1/projects/${projectId}/members`);
      setAssigned(list);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  useEffect(() => {
    loadAssigned();
  }, [projectId]);

  const available = members.filter(
    (m) =>
      m.role !== "OWNER" && !assigned.some((a) => a.userId === m.userId),
  );

  return (
    <Modal title={`Thành viên Project · ${projectName}`} onClose={onClose}>
      <div className="form-stack">
        {error && <Notice tone="error">{error}</Notice>}

        {can.manageMembers && (
          <Field label="Phân công thành viên từ Workspace">
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <Select
                aria-label="Chọn thành viên"
                value={selectedUserId}
                disabled={busy || available.length === 0}
                style={{ flex: "1 1 180px" }}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                <option value="">-- Chọn thành viên --</option>
                {available.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.fullName} ({m.email})
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Chọn vai trò"
                value={selectedRole}
                disabled={busy || available.length === 0}
                style={{ width: "auto", minWidth: 112 }}
                onChange={(e) =>
                  setSelectedRole(e.target.value as "MEMBER" | "VIEWER")
                }
              >
                <option value="MEMBER">Member</option>
                <option value="VIEWER">Viewer</option>
              </Select>
              <Button
                variant="primary"
                disabled={!selectedUserId || busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await projectMemberRequest(
                      `/api/v1/projects/${projectId}/members`,
                      {
                        method: "POST",
                        body: JSON.stringify({
                          userId: selectedUserId,
                          role: selectedRole,
                        }),
                      },
                    );
                    setSelectedUserId("");
                    await loadAssigned();
                    toast("Đã phân công thành viên vào Project.");
                  } catch (err) {
                    setError(errorMessage(err));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Phân công
              </Button>
            </div>
          </Field>
        )}

        <Field label={`Đang hoạt động (${assigned.length})`}>
          {assigned.length === 0 ? (
            <Notice>Chưa có thành viên nào được phân công vào Project này.</Notice>
          ) : (
            <div className="task-list">
              {assigned.map((a, i) => (
                <div className="task-row" key={a.userId}>
                  <div className="member-name">
                    <Avatar name={a.fullName} tone={i} />
                    <span>
                      <strong>{a.fullName}</strong>
                      <small>{a.email}</small>
                    </span>
                  </div>
                  {can.manageMembers ? (
                    <Select
                      aria-label={`Vai trò của ${a.fullName}`}
                      value={
                        a.role?.toUpperCase() === "VIEWER" ? "VIEWER" : "MEMBER"
                      }
                      disabled={busy}
                      style={{ width: "auto", minWidth: 112 }}
                      onChange={async (e) => {
                        const nextRole = e.target.value as "MEMBER" | "VIEWER";
                        setBusy(true);
                        setError("");
                        try {
                          await projectMemberRequest(
                            `/api/v1/projects/${projectId}/members/${a.userId}/role`,
                            {
                              method: "PATCH",
                              body: JSON.stringify({ role: nextRole }),
                            },
                          );
                          await loadAssigned();
                          toast(`Đã cập nhật vai trò của ${a.fullName}.`);
                        } catch (err) {
                          setError(errorMessage(err));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <option value="MEMBER">Member</option>
                      <option value="VIEWER">Viewer</option>
                    </Select>
                  ) : (
                    <RoleBadge
                      role={
                        a.role?.toUpperCase() === "VIEWER" ? "VIEWER" : "MEMBER"
                      }
                    />
                  )}
                  {can.manageMembers && (
                    <Button
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        setError("");
                        try {
                          await projectMemberRequest(
                            `/api/v1/projects/${projectId}/members/${a.userId}`,
                            { method: "DELETE" },
                          );
                          await loadAssigned();
                          toast(`Đã hủy phân công ${a.fullName}.`);
                        } catch (err) {
                          setError(errorMessage(err));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Hủy
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Field>

        <div className="modal-actions">
          <Button onClick={onClose}>Đóng</Button>
        </div>
      </div>
    </Modal>
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
            {f[0].toUpperCase() + f.slice(1)}
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