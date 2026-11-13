import type { Member } from "../types/workspace";

export type Role = Member["role"];
export interface Permissions {
  /** Edit workspace details, delete the workspace. */
  manageWorkspace: boolean;
  /** Invite and remove members, change roles. */
  manageMembers: boolean;
  /** Create projects, rooms and documents. */
  create: boolean;
  /** Edit canvas objects and documents, rename resources. */
  edit: boolean;
  /** Delete projects and rooms. */
  remove: boolean;
}
/**
 * WBS RBAC. OWNER (and the backend's ADMIN) manage the workspace,
 * MEMBER collaborates, VIEWER is read-only. EDITOR is a legacy demo
 * value treated as MEMBER.
 */
export function permissionsFor(role: Role | undefined): Permissions {
  const manager = role === "OWNER" || role === "ADMIN";
  const contributor = manager || role === "MEMBER" || role === "EDITOR";
  return {
    manageWorkspace: manager,
    manageMembers: manager,
    create: contributor,
    edit: contributor,
    remove: manager,
  };
}
export const roleDescriptions: Record<
  "OWNER" | "MEMBER" | "VIEWER",
  { summary: string; abilities: string[] }
> = {
  OWNER: {
    summary: "Full workspace management",
    abilities: [
      "Invite and remove members",
      "Change member roles",
      "Manage workspace settings",
      "Create, edit and delete projects and rooms",
    ],
  },
  MEMBER: {
    summary: "Create and collaborate",
    abilities: [
      "Create projects and rooms",
      "Collaborate on canvas",
      "Create and edit documents",
      "Cannot manage membership",
    ],
  },
  VIEWER: {
    summary: "Read-only access",
    abilities: [
      "View projects, rooms and documents",
      "Cannot modify canvas or documents",
      "Cannot perform management actions",
    ],
  },
};
