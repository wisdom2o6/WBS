import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import {
  Avatar,
  Badge,
  Button,
  Confirm,
  Field,
  Heading,
  Input,
  Notice,
  Select,
  Textarea,
  useToast,
} from "../components/ui";
import { Icon } from "../components/Icon";
import { PermissionNote, RoleBadge } from "../components/patterns";
import { errorMessage } from "../services/workspace";
import {
  readCanvasPrefs,
  writeCanvasPrefs,
} from "../features/canvas/types";

export default function Settings() {
  const { workspace } = useWorkspace();
  return <SettingsForm key={workspace?.id || "no-workspace"} />;
}
function SettingsForm() {
  const { user, logout } = useAuth();
  const { workspace, update, remove, demo, base, can, role } = useWorkspace();
  const canManage = can.manageWorkspace;
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "Profile";
  const setTab = (t: string) => setParams(t === "Profile" ? {} : { tab: t });
  const [canvasPrefs, setCanvasPrefs] = useState(readCanvasPrefs);
  const [name, setName] = useState(workspace?.name || "");
  const [description, setDescription] = useState(workspace?.description || "");
  const [fullName, setFullName] = useState(
    demo ? "Alex Morgan" : user?.fullName || "",
  );
  const [theme, setTheme] = useState(
    localStorage.getItem("wbs:theme") || "light",
  );
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  return (
    <div className="page settings-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">MAKE YOURSELF AT HOME</div>
          <Heading level={1}>
            Settings<span className="blue-text">.</span>
          </Heading>
          <p>A workspace that works the way you do.</p>
        </div>
      </div>
      <div className="settings-layout">
        <nav className="settings-nav">
          <span className="eyebrow settings-nav-label">ACCOUNT</span>
          {["Profile", "Preferences", "Security", "Workspace"].map((t) => (
            <Button
              key={t}
              variant="ghost"
              className={`${tab === t ? "active" : ""} ${t === "Workspace" ? "settings-nav-workspace" : ""}`}
              aria-current={tab === t ? "page" : undefined}
              icon={
                {
                  Profile: "users",
                  Workspace: "folder",
                  Security: "shield",
                  Preferences: "sun",
                }[t]
              }
              onClick={() => setTab(t)}
            >
              {t}
            </Button>
          ))}
        </nav>
        <div className="settings-content">
          {tab === "Profile" && (
            <>
              <Heading>Personal information</Heading>
              <p className="muted">The details that make this space yours.</p>
              <div className="account-avatar">
                <Avatar name={fullName || "You"} />
                <div>
                  <strong>{fullName}</strong>
                  <small>{demo ? "Demo account" : user?.email}</small>
                </div>
              </div>
              <form
                className="form-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  toast(
                    "Sample account label updated locally. Server profile updates are not supported.",
                  );
                }}
              >
                <Notice>
                  {demo
                    ? "Demo profile fields can be explored locally. No account data is changed on a server."
                    : "Profile and avatar updates are not supported by this backend. Your current account details are shown read-only."}
                </Notice>
                <Field label="Full name">
                  <Input
                    disabled={!demo}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </Field>
                <Field label="Username">
                  <Input
                    readOnly
                    value={demo ? "alexmorgan" : user?.username || ""}
                  />
                </Field>
                <Field label="Email">
                  <Input
                    readOnly
                    value={
                      demo ? "alex@studionorth.example" : user?.email || ""
                    }
                  />
                </Field>
                {demo && (
                  <Button type="submit" variant="primary">
                    Update demo label
                  </Button>
                )}
              </form>
            </>
          )}
          {tab === "Workspace" && (
            <>
              <Heading>Workspace details</Heading>
              <p className="muted">
                A name and a little context for your shared space.
              </p>
              <div className="settings-role-row">
                <span className="workspace-avatar">
                  {workspace?.name.slice(0, 1) || "W"}
                </span>
                <div>
                  <strong>{workspace?.name || "No workspace"}</strong>
                  <small>Your role in this workspace</small>
                </div>
                <RoleBadge role={role} />
              </div>
              {!canManage && (
                <PermissionNote role={role}>
                  Only workspace owners can change workspace details or delete
                  the workspace.
                </PermissionNote>
              )}
              <form
                className="form-stack"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!workspace) return;
                  setBusy(true);
                  try {
                    await update(
                      "workspace",
                      workspace.id,
                      name.trim(),
                      description,
                    );
                  } catch (err) {
                    toast(errorMessage(err), true);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Field label="Workspace name">
                  <Input
                    required
                    disabled={!canManage}
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
                <Field label="Description">
                  <Textarea
                    disabled={!canManage}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </Field>
                <div className="settings-permissions">
                  <Icon name="users" />
                  <div>
                    <strong>Members & permissions</strong>
                    <p className="muted small-text">
                      Manage access in one place.
                    </p>
                  </div>
                  <Link className="text-link" to={`${base}/members`}>
                    Manage
                    <Icon name="arrow" size={14} />
                  </Link>
                </div>
                <Field label="Default permission">
                  <Select disabled defaultValue="member">
                    <option value="member">Member · defined by backend</option>
                  </Select>
                </Field>
                {canManage && (
                  <Button
                    variant="primary"
                    type="submit"
                    loading={busy}
                    disabled={!workspace}
                  >
                    {busy ? "Saving…" : "Save workspace"}
                  </Button>
                )}
              </form>
              {canManage && (
              <div className="danger-zone">
                <Heading level={3}>Delete workspace</Heading>
                <p>
                  Permanently remove this workspace, its projects, rooms, and
                  canvas data.
                </p>
                <Button
                  variant="danger"
                  disabled={!canManage || !workspace}
                  onClick={() => setDeleting(true)}
                >
                  Delete workspace
                </Button>
              </div>
              )}
            </>
          )}
          {tab === "Security" && (
            <>
              <Heading>Account & workspace security</Heading>
              <Notice>
                Encryption status is unavailable. The current backend does not
                confirm encryption at rest or end-to-end encryption.
              </Notice>
              <div className="security-item">
                <Icon name="shield" />
                <div>
                  <strong>Transport connection</strong>
                  <p>
                    {demo
                      ? "Demo mode does not connect to the WBS backend."
                      : "The configured API uses HTTP on localhost. Secure transport is not confirmed."}
                  </p>
                </div>
                <Badge tone="warning">Not verified</Badge>
              </div>
              <div className="security-item">
                <Icon name="lock" />
                <div>
                  <strong>Password management</strong>
                  <p>
                    Password reset and password-change endpoints are not
                    available.
                  </p>
                </div>
              </div>
              <div className="security-item">
                <Icon name="panel" />
                <div>
                  <strong>Current browser session</strong>
                  <p>
                    {demo
                      ? "Sample session · Not authenticated"
                      : "JWT session in this browser. Other sessions and connected devices cannot be enumerated."}
                  </p>
                </div>
              </div>
              <Button
                icon="logout"
                onClick={() => {
                  if (!demo) logout();
                  navigate("/login");
                }}
              >
                {demo ? "Go to sign in" : "Sign out of this browser"}
              </Button>
            </>
          )}
          {tab === "Preferences" && (
            <>
              <Heading>Make it feel like home</Heading>
              <p className="muted">
                Choose the appearance that helps you focus.
              </p>
              <div className="theme-options">
                {["light", "dark", "system"].map((t) => (
                  <Button
                    key={t}
                    className={`theme-option ${theme === t ? "active" : ""}`}
                    onClick={() => {
                      setTheme(t);
                      localStorage.setItem("wbs:theme", t);
                      window.dispatchEvent(new Event("wbs:theme"));
                    }}
                  >
                    <div className={`theme-preview theme-${t}`}>
                      <i />
                      <span>
                        <b />
                        <b />
                        <b />
                      </span>
                    </div>
                    <span>
                      <Icon
                        name={
                          t === "light"
                            ? "sun"
                            : t === "dark"
                              ? "moon"
                              : "panel"
                        }
                        size={16}
                      />
                      {t[0].toUpperCase() + t.slice(1)}
                      {theme === t && <Icon name="check" size={15} />}
                    </span>
                  </Button>
                ))}
              </div>
              <Notice>
                Appearance is saved on this browser. Canvas object colors remain
                unchanged.
              </Notice>
              <div className="settings-section">
                <Heading level={3}>Canvas defaults</Heading>
                <p className="muted small-text">
                  Applied when you open a room canvas on this browser.
                </p>
                {(
                  [
                    ["grid", "Show grid", "Display the dot grid behind objects."],
                    ["snap", "Snap to grid", "Align objects to the grid while moving and drawing."],
                    ["layers", "Open layers panel", "Show the layers panel on wide screens."],
                  ] as const
                ).map(([key, label, hint]) => (
                  <label className="settings-toggle" key={key}>
                    <span>
                      <strong>{label}</strong>
                      <small>{hint}</small>
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      className="switch"
                      checked={canvasPrefs[key]}
                      onChange={(e) => {
                        writeCanvasPrefs({ [key]: e.target.checked });
                        setCanvasPrefs(readCanvasPrefs());
                        toast("Canvas preference saved.");
                      }}
                    />
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      {deleting && (
        <Confirm
          title={`Delete ${workspace?.name}?`}
          confirmLabel="Delete workspace"
          requireText={workspace?.name}
          description="All projects, rooms and canvas data in this workspace will be removed. This cannot be undone."
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            if (!workspace) return;
            try {
              await remove("workspace", workspace.id);
              setDeleting(false);
              navigate(`${base}/workspace`);
            } catch (err) {
              toast(errorMessage(err), true);
            }
          }}
        />
      )}
    </div>
  );
}
