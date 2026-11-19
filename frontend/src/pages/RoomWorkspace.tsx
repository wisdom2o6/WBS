import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import {
  Avatars,
  Badge,
  EmptyState,
  Heading,
  Skeleton,
} from "../components/ui";
import { Icon } from "../components/Icon";
import { RoleBadge } from "../components/patterns";
import { RoomCanvas } from "./RoomCanvas";
import { recordRecentRoom } from "../services/recentRooms";
import type { Member } from "../types/workspace";

const Documents = lazy(() => import("./Documents"));
const Media = lazy(() => import("./Media"));

const API_BASE = (
  import.meta.env.VITE_API_URL || "https://wbs-s6f8.onrender.com"
).replace(/\/$/, "");

function getAuthToken(): string {
  return (
    localStorage.getItem("accessToken") ||
    sessionStorage.getItem("accessToken") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

export default function RoomWorkspace() {
  const { roomId } = useParams();
  const { workspace, base, members, demo, role } = useWorkspace();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const project = workspace?.projects.find((p) =>
    p.rooms.some((r) => r.id === roomId),
  );
  const room = project?.rooms.find((r) => r.id === roomId);

  const [projectRole, setProjectRole] = useState<Member["role"] | null>(null);
  const [projectMemberNames, setProjectMemberNames] = useState<string[]>([]);

  useEffect(() => {
    if (room?.id && workspace?.id)
      recordRecentRoom(workspace.id, room.id, demo);
  }, [room?.id, workspace?.id, demo]);

  useEffect(() => {
    if (!project?.id || demo) {
      setProjectRole(null);
      setProjectMemberNames(members.map((m) => m.fullName));
      return;
    }

    let cancelled = false;
    const ownerNames = members
      .filter(
        (m) =>
          m.role === "OWNER" ||
          (project.createdByName && m.fullName === project.createdByName),
      )
      .map((m) => m.fullName);

    (async () => {
      try {
        const token = getAuthToken();
        const res = await fetch(
          `${API_BASE}/api/v1/projects/${project.id}/members`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
        );
        if (!res.ok || cancelled) return;

        const list: Array<{
          userId?: string;
          email?: string;
          fullName?: string;
          role?: string;
        }> = await res.json();

        const names = [...ownerNames];
        for (const item of list) {
          const matched = members.find(
            (wm) =>
              (item.userId && wm.userId === item.userId) ||
              (item.email && wm.email === item.email),
          );
          const name = matched?.fullName || item.fullName;
          if (name && !names.includes(name)) names.push(name);
        }
        setProjectMemberNames(names);

        const me = list.find(
          (item) =>
            (user?.userId && item.userId === user.userId) ||
            (user?.id && item.userId === user.id) ||
            (user?.email && item.email === user.email),
        );
        if (me?.role) {
          setProjectRole(me.role.toUpperCase() as Member["role"]);
        } else {
          setProjectRole(null);
        }
      } catch {
        setProjectMemberNames(ownerNames);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [project?.id, project?.createdByName, members, user, demo]);

  const effectiveRole: Member["role"] =
    role === "OWNER" || role === "ADMIN"
      ? role
      : projectRole || role;

  const isReadOnly = effectiveRole === "VIEWER";

  const active = pathname.endsWith("/chat")
    ? "chat"
    : pathname.endsWith("/documents")
      ? "documents"
      : pathname.endsWith("/files")
        ? "files"
        : "canvas";

  if (!room && demo)
    return (
      <EmptyState
        title="Room not found"
        description="Choose a room from the current workspace."
        action={
          <Link className="btn btn-secondary" to={`${base}/rooms`}>
            All rooms
          </Link>
        }
      />
    );

  return (
    <div className="room-workspace">
      <header className="room-context-header">
        <div className="room-context-title">
          <div>
            <Link to={`${base}/projects/${project?.id || ""}`}>
              {project?.name || "Project"}
            </Link>
            <Icon name="chevron" size={12} />
            <span>Room</span>
          </div>
          <Heading level={2}>
            {room?.name || `Room ${roomId?.slice(0, 8)}`}
          </Heading>
        </div>
        <div className="room-context-members">
          <Avatars
            names={
              projectMemberNames.length
                ? projectMemberNames
                : members.map((m) => m.fullName)
            }
          />
          <RoleBadge role={effectiveRole} />
          <Badge>{demo ? "Demo room" : isReadOnly ? "Read-only" : "Live room"}</Badge>
        </div>
      </header>
      <nav className="room-tabs" aria-label="Room tools">
        {[
          { key: "canvas", label: "Canvas", icon: "frame" },
          { key: "chat", label: "Chat", icon: "chat" },
          { key: "documents", label: "Documents", icon: "file" },
          { key: "files", label: "Files", icon: "folder" },
        ].map((t) => (
          <Link
            aria-current={active === t.key ? "page" : undefined}
            className={active === t.key ? "active" : ""}
            key={t.key}
            to={`${base}/room/${roomId}${t.key === "canvas" ? "" : `/${t.key}`}`}
          >
            <Icon name={t.icon} size={15} />
            {t.label}
          </Link>
        ))}
        <span>
          {demo
            ? "Demo data · Session only"
            : isReadOnly
              ? "Chế độ chỉ xem (Viewer) · Không thể chỉnh sửa bảng vẽ"
              : "One room. Shared context."}
        </span>
      </nav>
      <div
        className={
          active === "canvas" || active === "chat"
            ? "room-engine-host"
            : "room-engine-hidden"
        }
      >
        <RoomCanvas
          key={`${demo}-${roomId}`}
          view={active === "chat" ? "chat" : "canvas"}
          isActive={active === "canvas" || active === "chat"}
          readOnly={isReadOnly}
        />
      </div>
      <Suspense fallback={<Skeleton />}>
        {active === "documents" && <Documents roomId={roomId} />}
        {active === "files" && <Media roomId={roomId} />}
      </Suspense>
    </div>
  );
}