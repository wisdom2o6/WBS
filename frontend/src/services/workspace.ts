import axios from "axios";
import api from "../utils/api";
import type { Member, Workspace } from "../types/workspace";

export const workspaceService = {
  list: async () => (await api.get<Workspace[]>("/workspaces")).data,
  members: async (id: string) =>
    (await api.get<Member[]>(`/workspaces/${id}/members`)).data,
  createWorkspace: async (name: string, description: string) => {
    const slugBase = (
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "workspace"
    ).slice(0, 80);
    return api.post("/workspaces", {
      name,
      description,
      slug: `${slugBase}-${Date.now().toString(36)}`,
    });
  },
  createProject: async (
    workspaceId: string,
    name: string,
    description: string,
  ) => api.post(`/workspaces/${workspaceId}/projects`, { name, description }),
  createRoom: async (projectId: string, name: string, description: string) =>
    api.post(`/projects/${projectId}/rooms`, { name, description }),
  update: async (
    kind: "workspace" | "project" | "room",
    id: string,
    name: string,
    description?: string,
  ) =>
    api.put(`/${kind}s/${id}`, {
      name,
      ...(description === undefined ? {} : { description }),
    }),
  remove: async (kind: "workspace" | "project" | "room", id: string) =>
    api.delete(`/${kind}s/${id}`),
  addMember: async (id: string, usernameOrEmail: string) =>
    api.post(`/workspaces/${id}/members`, { usernameOrEmail }),
  upload: async (file: File, onProgress?: (fraction: number) => void) => {
    const form = new FormData();
    form.append("file", file);
    return (
      await api.post<{ url: string }>("/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) =>
          onProgress?.(e.total ? e.loaded / e.total : 0),
      })
    ).data;
  },
};
export function errorMessage(error: unknown) {
  if (axios.isAxiosError(error))
    return typeof error.response?.data?.message === "string"
      ? error.response.data.message
      : error.response
        ? `The server returned ${error.response.status}. Please try again.`
        : "Unable to reach the WBS server. Check your backend connection and try again.";
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
// Only confirmed Spring contracts belong here. Documents, tasks, notifications,
// member-role updates and chat mutations have no server endpoints in this import.
export const capabilities = {
  passwordReset: false,
  emailVerification: false,
  documents: false,
  notifications: false,
  roleManagement: false,
  chatHistory: false,
  chatMutations: false,
  e2ee: false,
} as const;
