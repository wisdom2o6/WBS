import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useId,
  useCallback,
} from "react";
import type {
  ButtonHTMLAttributes,
  ComponentProps,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

export function Button({
  variant = "secondary",
  className = "",
  icon,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: string;
}) {
  return (
    <button
      type="button"
      className={`btn btn-${variant} ${className}`}
      {...props}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}
export function IconButton({
  icon,
  label,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string }) {
  return (
    <Button
      {...props}
      className={`icon-button ${props.className || ""}`}
      variant="ghost"
      aria-label={label}
      title={label}
    >
      <Icon name={icon} />
    </Button>
  );
}
export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`input ${props.className || ""}`} />;
}
export function DownloadLink(props: ComponentProps<"a">) {
  return <a {...props} />;
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`input textarea ${props.className || ""}`}
    />
  );
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`input select ${props.className || ""}`} />
  );
}
export function Heading({
  children,
  level = 2,
  className = "",
}: {
  children: ReactNode;
  level?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4";
  return <Tag className={className}>{children}</Tag>;
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <svg
        width="30"
        height="30"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3 5h6v15l7-8 7 8V5h6v24h-6l-7-8-7 8H3V5Z"
          fill="currentColor"
        />
      </svg>
      {!compact && (
        <span>
          wbs<span className="brand-dot">.</span>
        </span>
      )}
    </span>
  );
}
export function Avatar({
  name,
  tone = 0,
  size = "",
}: {
  name: string;
  tone?: number;
  size?: string;
}) {
  return (
    <span className={`avatar avatar-${tone % 5} ${size}`} title={name}>
      {name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()}
    </span>
  );
}
export function Avatars({
  names,
  limit = 3,
}: {
  names: string[];
  limit?: number;
}) {
  return (
    <span className="avatar-stack">
      {names.slice(0, limit).map((name, i) => (
        <Avatar key={name} name={name} tone={i} size="small" />
      ))}
      {names.length > limit && (
        <span className="avatar small">+{names.length - limit}</span>
      )}
    </span>
  );
}
export function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function EmptyState({
  icon = "folder",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={26} />
      </span>
      <Heading level={3}>{title}</Heading>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Notice({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <div
      className={`notice ${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon name={tone === "error" ? "info" : "shield"} size={16} />
      <div>{children}</div>
    </div>
  );
}
export function Skeleton() {
  return (
    <div className="skeleton-stack" aria-label="Loading" role="status">
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton" />
      ))}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = ref.current;
    const items = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, textarea, select, a[href], [tabindex="0"]',
        ) || [],
      );
    (
      panel?.querySelector<HTMLElement>(
        'input:not([type="checkbox"]), textarea',
      ) || items()[0]
    )?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const focusable = items(),
          first = focusable[0],
          last = focusable.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, []);
  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        ref={ref}
      >
        <div className="modal-header">
          <Heading level={3}>
            <span id={id}>{title}</span>
          </Heading>
          <IconButton icon="close" label="Close dialog" onClick={onClose} />
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
export function Dropdown({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", key);
    };
  }, []);
  return (
    <div className="dropdown" ref={ref}>
      <Button
        variant="ghost"
        className="dropdown-trigger"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {label}
      </Button>
      {open && (
        <div className="dropdown-menu" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}
const ToastContext = createContext<(message: string, error?: boolean) => void>(
  () => {},
);
export const useToast = () => useContext(ToastContext);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<
    { id: string; message: string; error: boolean }[]
  >([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const notify = useCallback((message: string, error = false) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, error }]);
    timers.current.push(
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        5000,
      ),
    );
  }, []);
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div className={`toast ${t.error ? "error" : ""}`} key={t.id}>
            <Icon name={t.error ? "info" : "check"} size={18} />
            <span>{t.message}</span>
            <IconButton
              icon="close"
              label="Dismiss notification"
              onClick={() =>
                setToasts((prev) => prev.filter((x) => x.id !== t.id))
              }
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export function Confirm({
  title,
  description,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted">{description}</p>
      <div className="modal-actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm}>
          Delete
        </Button>
      </div>
    </Modal>
  );
}

export function ContextMenu({
  children,
  actions,
}: {
  children: ReactNode;
  actions: ReactNode;
}) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!position) return;
    menu.current?.querySelector<HTMLElement>("button, a")?.focus();
    const close = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node)) setPosition(null);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPosition(null);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const items = Array.from(
          menu.current?.querySelectorAll<HTMLElement>("button, a") || [],
        );
        const index = items.indexOf(document.activeElement as HTMLElement);
        items[
          (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
            items.length
        ]?.focus();
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [position]);
  return (
    <div
      className="context-menu-target"
      onContextMenu={(event) => {
        event.preventDefault();
        setPosition({
          x: Math.min(event.clientX, window.innerWidth - 230),
          y: Math.min(event.clientY, window.innerHeight - 160),
        });
      }}
      onKeyDown={(event) => {
        if (event.shiftKey && event.key === "F10") {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          setPosition({
            x: Math.min(rect.x + 20, window.innerWidth - 230),
            y: Math.min(rect.y + 30, window.innerHeight - 160),
          });
        }
      }}
    >
      {children}
      {position &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            className="context-menu"
            style={{ left: position.x, top: position.y }}
            onClick={() => setPosition(null)}
          >
            {actions}
          </div>,
          document.body,
        )}
    </div>
  );
}
