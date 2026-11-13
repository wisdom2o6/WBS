import { lazy, Suspense, useEffect } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useWorkspace } from "../context/WorkspaceContext";
import {
  Avatars,
  Badge,
  EmptyState,
  Heading,
  Skeleton,
} from "../components/ui";
import { Icon } from "../components/Icon";
import { PlannedBadge, RoleBadge } from "../components/patterns";
import { RoomCanvas } from "./RoomCanvas";
import { recordRecentRoom } from "../services/recentRooms";
const Documents = lazy(() => import("./Documents"));
const Media = lazy(() => import("./Media"));

export default function RoomWorkspace() {
  const { roomId } = useParams();
  const { workspace, base, members, demo, role } = useWorkspace();
  const { pathname } = useLocation();
  const project = workspace?.projects.find((p) =>
    p.rooms.some((r) => r.id === roomId),
  );
  const room = project?.rooms.find((r) => r.id === roomId);
  useEffect(() => {
    if (room?.id && workspace?.id)
      recordRecentRoom(workspace.id, room.id, demo);
  }, [room?.id, workspace?.id, demo]);
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
          <Avatars names={members.map((m) => m.fullName)} />
          <RoleBadge role={role} />
          <Badge>{demo ? "Demo room" : "Live room"}</Badge>
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
            {t.key === "chat" && <PlannedBadge label="Beta" />}
          </Link>
        ))}
        <span>
          {demo ? "Demo data · Session only" : "One room. Shared context."}
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
        />
      </div>
      <Suspense fallback={<Skeleton />}>
        {active === "documents" && <Documents roomId={roomId} />}
        {active === "files" && <Media roomId={roomId} />}
      </Suspense>
    </div>
  );
}
