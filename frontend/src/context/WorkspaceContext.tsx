import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { useToast } from "../components/ui";
import {
  demoActivity,
  demoAssets,
  demoDocuments,
  demoMembers,
  demoNotifications,
  demoTasks,
  demoWorkspaces,
} from "../data/demo";
import { errorMessage, workspaceService } from "../services/workspace";
import type {
  Activity,
  Asset,
  Document,
  Member,
  Notification,
  Task,
  Workspace,
} from "../types/workspace";

interface WorkspaceState {
  demo: boolean;
  base: string;
  workspaces: Workspace[];
  workspace?: Workspace;
  members: Member[];
  loading: boolean;
  error: string;
  selectWorkspace: (id: string) => void;
  refresh: () => Promise<void>;
  create: (
    kind: "workspace" | "project" | "room",
    name: string,
    description: string,
    parentId?: string,
  ) => Promise<void>;
  update: (
    kind: "workspace" | "project" | "room",
    id: string,
    name: string,
    description?: string,
  ) => Promise<void>;
  remove: (kind: "workspace" | "project" | "room", id: string) => Promise<void>;
  addMember: (email: string) => Promise<void>;
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
  documents: Document[];
  setDocuments: React.Dispatch<React.SetStateAction<Document[]>>;
  assets: Asset[];
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  activity: Activity[];
  logActivity: (
    action: string,
    target: string,
    path: string,
    icon?: string,
  ) => void;
  canManage: boolean;
}
const Context = createContext<WorkspaceState | undefined>(undefined);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { token, user } = useAuth();
  const demo = pathname.startsWith("/demo");
  const toast = useToast();
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() =>
    demo ? structuredClone(demoWorkspaces) : [],
  );
  const [selectedId, setSelectedId] = useState("");
  const [liveMembers, setLiveMembers] = useState<{
    workspaceId?: string;
    items: Member[];
  }>({ items: [] });
  const [demoMemberships, setDemoMemberships] = useState<
    Record<string, Member[]>
  >((): Record<string, Member[]> =>
    demo
      ? {
          studio: structuredClone(demoMembers),
          personal: [structuredClone(demoMembers[0])],
        }
      : {},
  );
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState("");
  const [documents, setDocuments] = useState<Document[]>(() =>
    demo ? structuredClone(demoDocuments) : [],
  );
  const [assets, setAssets] = useState<Asset[]>(() =>
    demo ? structuredClone(demoAssets) : [],
  );
  const [tasks, setTasks] = useState<Task[]>(() =>
    demo
      ? structuredClone(demoTasks).map((t) => ({ ...t, workspaceId: "studio" }))
      : [],
  );
  const [notifications, setNotifications] = useState<Notification[]>(() =>
    demo
      ? structuredClone(demoNotifications).map((n) => ({
          ...n,
          workspaceId: "studio",
        }))
      : [],
  );
  const [activity, setActivity] = useState<Activity[]>(() =>
    demo
      ? structuredClone(demoActivity).map((a) => ({
          ...a,
          workspaceId: "studio",
        }))
      : [],
  );
  const workspace =
    workspaces.find((w) => w.id === selectedId) || workspaces[0];
  const workspaceId = workspace?.id;
  const members = demo
    ? demoMemberships[workspace?.id || ""] || []
    : liveMembers.workspaceId === workspaceId
      ? liveMembers.items
      : [];
  const setMembers: WorkspaceState["setMembers"] = (action) => {
    if (demo && workspace)
      setDemoMemberships((prev) => ({
        ...prev,
        [workspace.id]:
          typeof action === "function"
            ? action(prev[workspace.id] || [])
            : action,
      }));
    else
      setLiveMembers((prev) => ({
        workspaceId,
        items:
          typeof action === "function"
            ? action(prev.workspaceId === workspaceId ? prev.items : [])
            : action,
      }));
  };
  const refresh = useCallback(async () => {
    if (demo) return;
    setLoading(true);
    setError("");
    try {
      setWorkspaces(await workspaceService.list());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [demo]);
  useEffect(() => {
    if (demo || !token) return;
    let active = true;
    workspaceService
      .list()
      .then((data) => {
        if (active) {
          setWorkspaces(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(errorMessage(err));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [demo, token]);
  useEffect(() => {
    if (!workspaceId || demo) return;
    let active = true;
    workspaceService
      .members(workspaceId)
      .then((data) => {
        if (active) setLiveMembers({ workspaceId, items: data });
      })
      .catch((err) => {
        if (active) toast(errorMessage(err), true);
      });
    return () => {
      active = false;
    };
  }, [demo, workspaceId, toast]);
  const logActivity = (
    action: string,
    target: string,
    path: string,
    icon = "plus",
  ) =>
    setActivity((prev) => [
      {
        id: crypto.randomUUID(),
        workspaceId: workspace?.id,
        actor: demo ? "Alex Morgan" : user?.fullName || "You",
        action,
        target,
        path,
        time: "Just now",
        icon,
      },
      ...prev,
    ]);
  const create: WorkspaceState["create"] = async (
    kind,
    name,
    description,
    parentId,
  ) => {
    if (!name.trim()) throw new Error("Please enter a name.");
    if (kind !== "workspace" && !parentId)
      throw new Error(
        `Select a ${kind === "room" ? "project" : "workspace"} first.`,
      );
    if (demo) {
      const id = crypto.randomUUID();
      setWorkspaces((prev) =>
        kind === "workspace"
          ? [
              ...prev,
              { id, name, description, projects: [], currentUserRole: "OWNER" },
            ]
          : prev.map((w) => ({
              ...w,
              projects:
                kind === "project" && w.id === parentId
                  ? [
                      ...w.projects,
                      {
                        id,
                        workspaceId: w.id,
                        name,
                        description,
                        createdByName: "Alex Morgan",
                        createdAt: new Date().toISOString(),
                        rooms: [],
                      },
                    ]
                  : w.projects.map((p) =>
                      p.id === parentId
                        ? {
                            ...p,
                            rooms: [
                              ...p.rooms,
                              { id, projectId: p.id, name, description },
                            ],
                          }
                        : p,
                    ),
            })),
      );
      if (kind === "workspace") {
        setSelectedId(id);
        setDemoMemberships((prev) => ({
          ...prev,
          [id]: [structuredClone(demoMembers[0])],
        }));
      }
    } else {
      if (kind === "workspace")
        await workspaceService.createWorkspace(name, description);
      else if (kind === "project")
        await workspaceService.createProject(parentId!, name, description);
      else await workspaceService.createRoom(parentId!, name, description);
      await refresh();
    }
    logActivity(
      "created",
      name,
      kind === "workspace" ? "/workspace" : "/projects",
    );
    toast(
      `${kind[0].toUpperCase() + kind.slice(1)} created${demo ? " in demo" : ""}.`,
    );
  };
  const update: WorkspaceState["update"] = async (
    kind,
    id,
    name,
    description,
  ) => {
    if (!name.trim()) throw new Error("Name cannot be empty.");
    if (!demo) {
      await workspaceService.update(kind, id, name, description);
      await refresh();
    } else
      setWorkspaces((prev) =>
        prev.map((w) =>
          kind === "workspace" && w.id === id
            ? { ...w, name, description: description ?? w.description }
            : {
                ...w,
                projects: w.projects.map((p) =>
                  kind === "project" && p.id === id
                    ? { ...p, name }
                    : {
                        ...p,
                        rooms: p.rooms.map((r) =>
                          kind === "room" && r.id === id ? { ...r, name } : r,
                        ),
                      },
                ),
              },
        ),
      );
    toast("Changes saved.");
  };
  const remove: WorkspaceState["remove"] = async (kind, id) => {
    if (!demo) {
      await workspaceService.remove(kind, id);
      await refresh();
    } else
      setWorkspaces((prev) =>
        prev
          .filter((w) => kind !== "workspace" || w.id !== id)
          .map((w) => ({
            ...w,
            projects: w.projects
              .filter((p) => kind !== "project" || p.id !== id)
              .map((p) => ({
                ...p,
                rooms: p.rooms.filter((r) => kind !== "room" || r.id !== id),
              })),
          })),
      );
    toast(`${kind} deleted.`);
  };
  const addMember = async (email: string) => {
    if (!workspace) throw new Error("Select a workspace first.");
    if (demo)
      setMembers((prev) => [
        ...prev,
        {
          userId: crypto.randomUUID(),
          username: email.split("@")[0],
          fullName: email.split("@")[0],
          email,
          role: "EDITOR",
        },
      ]);
    else {
      await workspaceService.addMember(workspace.id, email);
      setMembers(await workspaceService.members(workspace.id));
    }
    toast(
      demo
        ? "Sample member added. No invitation was sent."
        : "Existing user added to workspace.",
    );
  };
  return (
    <Context.Provider
      value={{
        demo,
        base: demo ? "/demo" : "",
        workspaces,
        workspace,
        members,
        loading,
        error,
        selectWorkspace: setSelectedId,
        refresh,
        create,
        update,
        remove,
        addMember,
        setMembers,
        documents,
        setDocuments,
        assets,
        setAssets,
        tasks: tasks.filter((t) => t.workspaceId === workspace?.id),
        setTasks,
        notifications: notifications.filter(
          (n) => n.workspaceId === workspace?.id,
        ),
        setNotifications,
        activity: activity.filter((a) => a.workspaceId === workspace?.id),
        logActivity,
        canManage:
          demo ||
          workspace?.currentUserRole === "OWNER" ||
          workspace?.currentUserRole === "ADMIN",
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("WorkspaceProvider required");
  return value;
}
