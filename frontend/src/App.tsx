import { lazy, Suspense } from "react";
import type { ReactNode } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import { ToastProvider, Skeleton } from "./components/ui";
import { WorkspaceLayout } from "./layouts/WorkspaceLayout";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { AuthScreen } from "./pages/auth/AuthScreen";
import { useTheme } from "./hooks/useTheme";
const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const Projects = lazy(() => import("./pages/Projects"));
const ProjectDetail = lazy(() =>
  import("./pages/Projects").then((m) => ({ default: m.ProjectDetail })),
);
const Rooms = lazy(() =>
  import("./pages/Projects").then((m) => ({ default: m.Rooms })),
);
const RoomWorkspace = lazy(() => import("./pages/RoomWorkspace"));
const Documents = lazy(() => import("./pages/Documents"));
const Media = lazy(() => import("./pages/Media"));
const Members = lazy(() =>
  import("./pages/WorkspacePages").then((m) => ({ default: m.Members })),
);
const Tasks = lazy(() =>
  import("./pages/WorkspacePages").then((m) => ({ default: m.Tasks })),
);
const Notifications = lazy(() =>
  import("./pages/WorkspacePages").then((m) => ({ default: m.Notifications })),
);
const Activity = lazy(() =>
  import("./pages/WorkspacePages").then((m) => ({ default: m.ActivityFeed })),
);
const Settings = lazy(() => import("./pages/Settings"));
const System = lazy(() => import("./pages/System"));
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}
function WorkspaceRoutes() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  return (
    <WorkspaceProvider
      key={
        pathname.startsWith("/demo")
          ? "demo"
          : user?.userId || user?.id || "live"
      }
    >
      <WorkspaceLayout />
    </WorkspaceProvider>
  );
}
function Entry() {
  const { token } = useAuth();
  return <Navigate to={token ? "/workspace" : "/demo/workspace"} replace />;
}
function App() {
  useTheme();
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Suspense
            fallback={
              <div className="route-loading">
                <Skeleton />
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<Entry />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/forgot-password"
                element={<AuthScreen mode="forgot" />}
              />
              <Route
                path="/verify-email"
                element={<AuthScreen mode="verify" />}
              />
              <Route
                path="/dashboard"
                element={<Navigate to="/workspace" replace />}
              />
              {[false, true].map((demo) => (
                <Route
                  key={String(demo)}
                  path={demo ? "/demo" : undefined}
                  element={
                    demo ? (
                      <WorkspaceRoutes />
                    ) : (
                      <ProtectedRoute>
                        <WorkspaceRoutes />
                      </ProtectedRoute>
                    )
                  }
                >
                  {demo && (
                    <Route
                      index
                      element={<Navigate to="workspace" replace />}
                    />
                  )}
                  <Route path="workspace" element={<Dashboard />} />
                  <Route path="projects" element={<Projects />} />
                  <Route
                    path="projects/:projectId"
                    element={<ProjectDetail />}
                  />
                  <Route path="rooms" element={<Rooms />} />
                  <Route path="room/:roomId/*" element={<RoomWorkspace />} />
                  <Route path="documents" element={<Documents />} />
                  <Route path="documents/:documentId" element={<Documents />} />
                  <Route path="media" element={<Media />} />
                  <Route path="members" element={<Members />} />
                  <Route path="tasks" element={<Tasks />} />
                  <Route path="notifications" element={<Notifications />} />
                  <Route path="activity" element={<Activity />} />
                  <Route path="settings/*" element={<Settings />} />
                  <Route path="system" element={<System />} />
                </Route>
              ))}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
export default App;
