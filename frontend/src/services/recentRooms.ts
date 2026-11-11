const key = (workspaceId: string, demo: boolean) =>
  `wbs:recent-rooms:${demo ? "demo" : "live"}:${workspaceId}`;
export function getRecentRooms(workspaceId: string, demo: boolean): string[] {
  try {
    const stored: unknown = JSON.parse(
      sessionStorage.getItem(key(workspaceId, demo)) || "null",
    );
    if (Array.isArray(stored))
      return stored.filter((id): id is string => typeof id === "string");
  } catch {
    /* Malformed browser metadata must not block navigation. */
  }
  return demo && workspaceId === "studio"
    ? ["brand-direction", "website-exploration", "product-roadmap"]
    : [];
}
export function recordRecentRoom(
  workspaceId: string,
  roomId: string,
  demo: boolean,
) {
  sessionStorage.setItem(
    key(workspaceId, demo),
    JSON.stringify(
      [
        roomId,
        ...getRecentRooms(workspaceId, demo).filter((id) => id !== roomId),
      ].slice(0, 20),
    ),
  );
}
