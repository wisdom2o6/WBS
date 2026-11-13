export interface Room {
  id: string;
  projectId?: string;
  name: string;
  description?: string;
  createdAt?: string;
  createdByName?: string;
  /** Human-readable last activity, when known (demo or session). */
  lastActivity?: { actor: string; time: string };
}
export interface Project {
  id: string;
  workspaceId?: string;
  name: string;
  description?: string;
  rooms: Room[];
  createdAt?: string;
  createdByName?: string;
}
export interface Workspace {
  id: string;
  name: string;
  slug?: string;
  description: string;
  projects: Project[];
  ownerName?: string;
  currentUserRole?: Member["role"];
  createdAt?: string;
}
export interface Member {
  userId: string;
  username: string;
  fullName: string;
  email: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "EDITOR" | "VIEWER";
  /** Not returned by the current backend DTO; shown when available. */
  joinedAt?: string;
}
export interface Activity {
  id: string;
  workspaceId?: string;
  actor: string;
  action: string;
  target: string;
  time: string;
  path: string;
  icon: string;
}
export interface Notification {
  id: string;
  workspaceId?: string;
  title: string;
  detail: string;
  path: string;
  read: boolean;
  type: string;
  time: string;
}
export interface Asset {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  workspaceId: string;
  projectId?: string;
  roomId?: string;
  attribution?: string;
}
export type BlockKind =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bullet"
  | "numbered"
  | "checklist"
  | "quote"
  | "code"
  | "image"
  | "table"
  | "divider"
  | "canvas";
export interface Block {
  id: string;
  kind: BlockKind;
  text: string;
  checked?: boolean;
  /** Code block language label. */
  language?: string;
}
export interface Document {
  id: string;
  title: string;
  description: string;
  workspaceId: string;
  projectId?: string;
  roomId?: string;
  blocks: Block[];
  updatedAt: string;
  author: string;
}
export interface Task {
  id: string;
  workspaceId?: string;
  title: string;
  done: boolean;
  project: string;
  due: string;
}
