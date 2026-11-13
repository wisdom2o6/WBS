import { Link } from "react-router-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";
import { Avatar, Button, Input, Spinner } from "./ui";
import type { Member } from "../types/workspace";

/* ------------------------------------------------------------------ */
/* Status indicator — one vocabulary for save / sync / connection state */
/* ------------------------------------------------------------------ */
export type SyncState =
  | "connected"
  | "connecting"
  | "saved"
  | "saving"
  | "local"
  | "offline"
  | "reconnecting"
  | "failed"
  | "readonly";
const syncConfig: Record<
  SyncState,
  { icon?: string; spin?: boolean; tone: string; label: string }
> = {
  connected: { tone: "success", label: "Live" },
  connecting: { spin: true, tone: "muted", label: "Connecting…" },
  saved: { icon: "cloud-check", tone: "success", label: "Saved" },
  saving: { spin: true, tone: "muted", label: "Saving…" },
  local: { tone: "muted", label: "Saved locally" },
  offline: { icon: "wifi-off", tone: "warning", label: "Offline" },
  reconnecting: { spin: true, tone: "warning", label: "Reconnecting…" },
  failed: { icon: "alert", tone: "danger", label: "Save failed" },
  readonly: { icon: "eye", tone: "muted", label: "View only" },
};
export function StatusIndicator({
  state,
  label,
  detail,
  compact = false,
}: {
  state: SyncState;
  label?: string;
  detail?: string;
  compact?: boolean;
}) {
  const c = syncConfig[state];
  return (
    <span
      className={`status-indicator tone-${c.tone} ${compact ? "compact" : ""}`}
      role="status"
      title={detail || label || c.label}
    >
      {c.spin ? (
        <Spinner size={10} />
      ) : c.icon ? (
        <Icon name={c.icon} size={13} />
      ) : (
        <span className="status-indicator-dot" />
      )}
      <span className="status-indicator-label">{label || c.label}</span>
      {detail && !compact && (
        <span className="status-indicator-detail">{detail}</span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Security status — never claims a guarantee that is not implemented */
/* ------------------------------------------------------------------ */
export type SecurityState = "secure" | "transit" | "e2ee" | "setup";
export function connectionSecurity(endpoint: string): SecurityState {
  return /^(https|wss):/.test(endpoint) && location.protocol === "https:"
    ? "transit"
    : "setup";
}
export function SecurityStatus({
  state,
  e2eeVerified = false,
  compact = false,
}: {
  state: SecurityState;
  /** End-to-end encryption may only render as active when verified. */
  e2eeVerified?: boolean;
  compact?: boolean;
}) {
  const resolved =
    state === "e2ee" && !e2eeVerified ? "e2ee-unavailable" : state;
  const config = {
    secure: {
      icon: "shield",
      tone: "success",
      label: "Secure connection",
      detail: "TLS connection to the WBS server.",
    },
    transit: {
      icon: "lock",
      tone: "success",
      label: "Encrypted in transit",
      detail: "Messages travel over an encrypted connection.",
    },
    e2ee: {
      icon: "shield",
      tone: "success",
      label: "End-to-end encrypted",
      detail: "Only room members hold the keys.",
    },
    "e2ee-unavailable": {
      icon: "shield",
      tone: "muted",
      label: "End-to-end encryption · not available",
      detail: "Planned. Not implemented or verified yet.",
    },
    setup: {
      icon: "alert",
      tone: "warning",
      label: "Encryption setup required",
      detail: "The configured endpoint is not using TLS.",
    },
  }[resolved];
  return (
    <span
      className={`security-status tone-${config.tone} ${compact ? "compact" : ""}`}
      title={config.detail}
    >
      <Icon name={config.icon} size={14} />
      <span>
        <strong>{config.label}</strong>
        {!compact && <small>{config.detail}</small>}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Presence and roles                                                  */
/* ------------------------------------------------------------------ */
export function Presence({
  people,
  limit = 3,
  label,
  sample = false,
}: {
  people: { name: string; color?: string }[];
  limit?: number;
  label?: string;
  sample?: boolean;
}) {
  if (!people.length) return null;
  return (
    <span
      className="presence"
      title={`${people.map((p) => p.name).join(", ")}${sample ? " (sample presence)" : ""}`}
    >
      <span className="presence-stack">
        {people.slice(0, limit).map((p, i) => (
          <span
            className="presence-avatar"
            key={p.name}
            style={p.color ? { boxShadow: `0 0 0 2px ${p.color}` } : undefined}
          >
            <Avatar name={p.name} tone={i + 1} size="small" />
          </span>
        ))}
        {people.length > limit && (
          <span className="avatar small">+{people.length - limit}</span>
        )}
      </span>
      <span className="presence-label">
        <i />
        {label || `${people.length} here`}
      </span>
    </span>
  );
}
const roleLabels: Record<Member["role"], string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  EDITOR: "Member",
  VIEWER: "Viewer",
};
export const roleLabel = (role?: Member["role"]) =>
  role ? roleLabels[role] : "Member";
export function RoleBadge({ role }: { role: Member["role"] }) {
  return (
    <span className={`role-badge role-${role.toLowerCase()}`}>
      {role === "OWNER" && <Icon name="star" size={10} />}
      {role === "VIEWER" && <Icon name="eye" size={10} />}
      {roleLabel(role)}
    </span>
  );
}
export function PlannedBadge({ label = "Planned" }: { label?: string }) {
  return (
    <span className="planned-badge" title="Designed, not yet implemented">
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Navigation, search, loading, menus                                  */
/* ------------------------------------------------------------------ */
export function Breadcrumbs({
  items,
}: {
  items: { label: string; to?: string; icon?: string }[];
}) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`}>
            {item.to && i < items.length - 1 ? (
              <Link to={item.to}>
                {item.icon && <Icon name={item.icon} size={13} />}
                {item.label}
              </Link>
            ) : (
              <span aria-current={i === items.length - 1 ? "page" : undefined}>
                {item.icon && <Icon name={item.icon} size={13} />}
                {item.label}
              </span>
            )}
            {i < items.length - 1 && <Icon name="chevron" size={11} />}
          </li>
        ))}
      </ol>
    </nav>
  );
}
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={`search-input search-field ${className}`}>
      <Icon name="search" size={17} />
      <Input
        placeholder={placeholder}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.stopPropagation();
            onChange("");
          }
        }}
      />
      {value && (
        <button
          type="button"
          className="search-clear"
          aria-label="Clear search"
          onClick={() => onChange("")}
        >
          <Icon name="close" size={13} />
        </button>
      )}
    </div>
  );
}
export function LoadingState({
  variant = "rows",
  count = 3,
  label = "Loading",
}: {
  variant?: "rows" | "cards" | "stats";
  count?: number;
  label?: string;
}) {
  return (
    <div
      className={`loading-state loading-${variant}`}
      role="status"
      aria-label={label}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="loading-item">
          {variant !== "stats" && <span className="loading-block" />}
          <span className="loading-line" />
          <span className="loading-line short" />
        </div>
      ))}
    </div>
  );
}
export function MenuItem({
  icon,
  children,
  danger = false,
  shortcut,
  badge,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: string;
  danger?: boolean;
  shortcut?: string;
  badge?: ReactNode;
}) {
  return (
    <Button
      {...props}
      role="menuitem"
      variant="ghost"
      icon={icon}
      className={`menu-item ${danger ? "menu-danger" : ""} ${props.className || ""}`}
    >
      <span className="menu-item-label">{children}</span>
      {badge}
      {shortcut && <kbd>{shortcut}</kbd>}
    </Button>
  );
}
export function MenuDivider() {
  return <div className="menu-divider" role="separator" />;
}
/** Calm, inline permission explanation that replaces hidden actions. */
export function PermissionNote({
  children,
  role,
}: {
  children: ReactNode;
  role?: Member["role"];
}) {
  return (
    <div className="permission-note" role="note">
      <Icon name="lock" size={14} />
      <span>{children}</span>
      {role && <RoleBadge role={role} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Notification item — shared by the bell popover and the full page   */
/* ------------------------------------------------------------------ */
const notificationIcons: Record<string, string> = {
  mention: "at",
  document: "file",
  workspace: "home",
  member: "users",
  canvas: "frame",
};
export function NotificationItem({
  title,
  detail,
  time,
  type,
  read,
  to,
  onOpen,
  compact = false,
}: {
  title: string;
  detail: string;
  time: string;
  type: string;
  read: boolean;
  to: string;
  onOpen?: () => void;
  compact?: boolean;
}) {
  return (
    <Link
      to={to}
      onClick={onOpen}
      className={`notification-item ${read ? "" : "unread"} ${compact ? "compact" : ""}`}
    >
      <span className="notification-item-icon">
        <Icon name={notificationIcons[type] || "bell"} size={15} />
      </span>
      <span className="notification-item-copy">
        <strong>{title}</strong>
        <small>{detail}</small>
        <time>{time}</time>
      </span>
      {!read && <span className="unread-dot" aria-label="Unread" />}
    </Link>
  );
}
