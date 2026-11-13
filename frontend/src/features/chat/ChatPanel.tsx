import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useAuth } from "../../context/AuthContext";
import {
  Avatar,
  Button,
  Confirm,
  DownloadLink,
  EmptyState,
  IconButton,
  Input,
  Spinner,
  Textarea,
  useToast,
} from "../../components/ui";
import { Icon } from "../../components/Icon";
import {
  SecurityStatus,
  StatusIndicator,
  connectionSecurity,
} from "../../components/patterns";
import { errorMessage } from "../../services/workspace";

export interface ChatMessage {
  id?: string;
  clientMessageId?: string;
  senderUsername: string;
  message: string;
  timestamp: string;
  replyToId?: string;
  replyTo?: string;
  pinned?: boolean;
  edited?: boolean;
  deleted?: boolean;
  reactions?: { icon: string; users: string[] }[];
  attachment?: { id?: string; name: string; url: string; type: string };
  attachmentUrl?: string;
  /** Local delivery state; absent once the server echo arrives. */
  status?: "sending" | "failed";
  /** System notices such as "Sarah created this room". */
  system?: boolean;
  /** Render the "New messages" divider before this message. */
  unreadBoundary?: boolean;
}

const REACTIONS = [
  { icon: "heart", label: "Love" },
  { icon: "check", label: "Agree" },
  { icon: "star", label: "Important" },
];

export const API_ENDPOINT =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:8080";

const now = () =>
  new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });

function parseReply(m: ChatMessage) {
  if (m.replyTo || !m.message.startsWith("↳ ") || !m.message.includes("\n"))
    return { reply: m.replyTo, body: m.message };
  const [first, ...rest] = m.message.split("\n");
  return { reply: first.slice(2), body: rest.join("\n") };
}

export interface ChatPanelProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  connected: boolean;
  connection: "connecting" | "connected" | "reconnecting" | "failed";
  onSend: (
    message: string,
    options?: {
      clientMessageId?: string;
      replyToId?: string;
      attachmentFileId?: string;
    },
  ) => boolean | Promise<boolean>;
  onEdit?: (messageId: string, newPlainText: string) => void | Promise<void>;
  onDelete?: (messageId: string) => void | Promise<void>;
  onPin?: (messageId: string, pinned: boolean) => void | Promise<void>;
  onReact?: (messageId: string, icon: string) => void | Promise<void>;
  onLoadMore?: () => void | Promise<void>;
  hasMore?: boolean;
  loadingMore?: boolean;
  typingUsers?: string[];
  onTyping?: (isTyping: boolean) => void;
  readOnly?: boolean;
  role?: string;
}

export function ChatPanel({
  messages,
  setMessages,
  connected,
  connection,
  onSend,
  onEdit,
  onDelete,
  onPin,
  onReact,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
  typingUsers = [],
  onTyping,
  readOnly,
}: ChatPanelProps) {
  const { roomId } = useParams<{ roomId: string }>();
  const { demo, members, can } = useWorkspace();
  const { user, token } = useAuth();
  const username = demo ? "alex" : user?.username;
  const displayName = demo ? "Alex" : user?.fullName || user?.username;
  const canPost = readOnly !== undefined ? !readOnly : can.edit;

  const [query, setQuery] = useState("");
  const [text, setText] = useState("");
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [reacting, setReacting] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [showPins, setShowPins] = useState(false);
  const [mention, setMention] = useState(false);
  const [attachment, setAttachment] = useState<ChatMessage["attachment"]>();
  const [uploadingFile, setUploadingFile] = useState(false);

  const file = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const toast = useToast();

  const live = demo || connected;
  const security = connectionSecurity(API_ENDPOINT);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  const notifyTyping = (active: boolean) => {
    if (demo || !onTyping) return;
    if (active) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        onTyping(true);
      }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        isTypingRef.current = false;
        onTyping(false);
      }, 2500);
    } else {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (isTypingRef.current) {
        isTypingRef.current = false;
        onTyping(false);
      }
    }
  };

  const nameFor = (u: string) =>
    members.find((p) => p.username === u || p.fullName === u)?.fullName ||
    u ||
    "Member";

  const update = (index: number, patch: Partial<ChatMessage>) =>
    setMessages((prev) =>
      prev.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    );

  const deliver = async (
    clientMessageId: string,
    body: string,
    options?: { replyToId?: string; attachmentFileId?: string },
  ) => {
    if (demo) {
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMessageId === clientMessageId
              ? { ...m, status: undefined }
              : m,
          ),
        );
      }, 450);
      return;
    }
    const ok = await onSend(body, {
      clientMessageId,
      replyToId: options?.replyToId,
      attachmentFileId: options?.attachmentFileId,
    });
    if (!ok) {
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === clientMessageId
            ? { ...m, status: "failed" }
            : m,
        ),
      );
    }
  };

  const send = () => {
    if ((!text.trim() && !attachment) || !canPost || uploadingFile) return;

    // 1. Chế độ chỉnh sửa tin nhắn
    if (editing !== null) {
      const target = messages[editing];
      const trimmed = text.trim();
      if (!trimmed) return;
      update(editing, { message: trimmed, edited: true });
      if (!demo && target?.id && onEdit) {
        void onEdit(target.id, trimmed);
      }
      setEditing(null);
      setText("");
      notifyTyping(false);
      return;
    }

    if (!demo && !connected) {
      toast("Chat is disconnected. Your draft has not been sent.", true);
      return;
    }

    const body = text.trim() || (attachment ? `Shared ${attachment.name}` : "");
    const clientMessageId = crypto.randomUUID();
    const replyPreview = reply
      ? `${nameFor(reply.senderUsername)}: ${parseReply(reply).body}`
      : undefined;
    const replyToId = reply?.id;
    const attachmentFileId = attachment?.id;

    setMessages((prev) => [
      ...prev,
      {
        id: clientMessageId,
        clientMessageId,
        senderUsername: displayName || username || "you",
        message: body,
        timestamp: now(),
        replyToId,
        replyTo: replyPreview,
        attachment,
        status: "sending",
      },
    ]);

    void deliver(clientMessageId, body, { replyToId, attachmentFileId });
    setText("");
    setReply(null);
    setAttachment(undefined);
    notifyTyping(false);
  };

  const toggleReaction = (index: number, icon: string) => {
    const target = messages[index];
    if (!target || target.deleted) return;

    const me = displayName || username || "alex";
    setMessages((prev) =>
      prev.map((msg, i) => {
        if (i !== index) return msg;
        const list = msg.reactions ? [...msg.reactions] : [];
        const r = list.find((x) => x.icon === icon);
        if (!r) list.push({ icon, users: [me] });
        else if (r.users.includes(me))
          r.users = r.users.filter((u) => u !== me);
        else r.users = [...r.users, me];
        return {
          ...msg,
          reactions: list
            .map((x) => ({ ...x }))
            .filter((x) => x.users.length),
        };
      }),
    );

    if (!demo && target.id && onReact) {
      void onReact(target.id, icon);
    }
  };

  const handlePinToggle = (index: number) => {
    const target = messages[index];
    if (!target || target.deleted) return;
    const nextPinned = !target.pinned;
    update(index, { pinned: nextPinned });
    if (!demo && target.id && onPin) {
      void onPin(target.id, nextPinned);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0];
    e.target.value = "";
    if (!chosen) return;
    if (chosen.size > 20 * 1024 * 1024) {
      toast("Attachments must be smaller than 20 MB.", true);
      return;
    }

    if (demo) {
      setAttachment({
        name: chosen.name,
        type: chosen.type || "application/octet-stream",
        url: URL.createObjectURL(chosen),
      });
      return;
    }

    if (!token || !roomId) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", chosen);
      const res = await axios.post(
        `${API_ENDPOINT}/api/rooms/${roomId}/files`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      setAttachment({
        id: res.data?.id ? String(res.data.id) : undefined,
        name: res.data?.fileName || res.data?.name || chosen.name,
        type:
          res.data?.fileType ||
          res.data?.type ||
          chosen.type ||
          "application/octet-stream",
        url: res.data?.fileUrl || res.data?.url,
      });
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setUploadingFile(false);
    }
  };

  const filtered = messages
    .map((m, index) => ({ ...m, index }))
    .filter(
      (m) =>
        (!query ||
          (!m.system &&
            m.message.toLowerCase().includes(query.toLowerCase()))) &&
        (!showPins || m.pinned),
    );

  const onlineSample = demo ? ["sarah", "mia"] : [];
  const pinnedCount = messages.filter((m) => m.pinned && !m.deleted).length;

  return (
    <div className="chat-workspace">
      <aside className="chat-sidebar">
        <span className="eyebrow">ROOM CONVERSATIONS</span>
        <Button
          variant="ghost"
          className={!showPins ? "active" : ""}
          icon="chat"
          onClick={() => setShowPins(false)}
        >
          Team conversation
          <span className="tab-count">
            {messages.filter((m) => !m.system).length}
          </span>
        </Button>
        <Button
          variant="ghost"
          className={showPins ? "active" : ""}
          icon="pin"
          onClick={() => setShowPins(true)}
        >
          Pinned messages
          {pinnedCount > 0 && <span className="tab-count">{pinnedCount}</span>}
        </Button>
        <div className="chat-sidebar-members">
          <span className="eyebrow">
            MEMBERS{demo ? " · SAMPLE PRESENCE" : ""}
          </span>
          {members.map((m, i) => (
            <div key={m.userId}>
              <span className="chat-member-avatar">
                <Avatar name={m.fullName} tone={i} size="small" />
                {onlineSample.includes(m.username) && <i title="Active" />}
              </span>
              <span>{m.fullName}</span>
              {m.username === username && <small>you</small>}
            </div>
          ))}
        </div>
        <div className="chat-security-stack">
          <span className="eyebrow">CONNECTION SECURITY</span>
          <SecurityStatus state={security} />
          <SecurityStatus state="e2ee" e2eeVerified={!demo} />
        </div>
        <div className="chat-module-status">
          <div>
            <strong>End-to-End Encrypted</strong>
          </div>
          <p>
            <Icon name="check" size={12} />
            Live chat, replies, reactions, pins &amp; history active
          </p>
        </div>
      </aside>
      <section className="chat-main">
        <div className="chat-heading">
          <div>
            <strong>
              {showPins ? "Pinned messages" : "Team conversation"}
            </strong>
            <span>
              {demo ? (
                <StatusIndicator
                  state="local"
                  label="Sample conversation"
                  compact
                />
              ) : (
                <StatusIndicator
                  compact
                  state={
                    connection === "connected"
                      ? "connected"
                      : connection === "failed"
                        ? "failed"
                        : connection === "connecting"
                          ? "connecting"
                          : "reconnecting"
                  }
                  label={
                    connection === "connected"
                      ? "Connected · live delivery"
                      : connection === "failed"
                        ? "Connection rejected"
                        : undefined
                  }
                />
              )}
            </span>
          </div>
          <SecurityStatus state={security} compact />
          <div className="search-input">
            <Icon name="search" size={15} />
            <Input
              placeholder="Find in this conversation…"
              aria-label="Search loaded chat messages"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        {!demo && connection === "reconnecting" && (
          <div className="chat-banner warning" role="status">
            <Spinner size={12} />
            Connection lost. Reconnecting… Messages you send now will fail.
          </div>
        )}
        {!demo && connection === "failed" && (
          <div className="chat-banner error" role="alert">
            <Icon name="wifi-off" size={14} />
            The room connection was rejected. Messages can’t be delivered.
          </div>
        )}
        <div className="chat-timeline">
          {!demo && hasMore && onLoadMore && !showPins && !query && (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <Button
                variant="ghost"
                disabled={loadingMore}
                onClick={() => void onLoadMore()}
              >
                {loadingMore ? "Loading older messages…" : "Load older messages"}
              </Button>
            </div>
          )}
          <div className="chat-date-separator">
            <span>
              {demo ? "SAMPLE CONVERSATION · TODAY" : "CURRENT SESSION"}
            </span>
          </div>
          {!demo && (
            <div className="chat-module-note">
              <Icon name="info" size={14} />
              Room messages are encrypted in the browser with AES-256-GCM before
              leaving your device.
            </div>
          )}
          {filtered.map((m, i) => {
            if (m.system)
              return (
                <div className="chat-system" key={m.id || m.index}>
                  <Icon name="info" size={12} />
                  <span>{m.message}</span>
                  <time>{m.timestamp}</time>
                </div>
              );
            const prev = filtered[i - 1];
            const grouped =
              !!prev &&
              !prev.system &&
              prev.senderUsername === m.senderUsername &&
              !m.unreadBoundary &&
              !query &&
              !showPins;
            const own =
              m.senderUsername === username ||
              m.senderUsername === displayName;
            const { reply: replyText, body } = parseReply(m);
            const isImage = m.attachment?.type?.startsWith("image/");
            return (
              <div key={m.id || m.index}>
                {m.unreadBoundary && !query && !showPins && (
                  <div className="chat-unread-divider">
                    <span>NEW MESSAGES</span>
                  </div>
                )}
                <div
                  className={`chat-message ${grouped ? "grouped" : ""} ${selected === m.index ? "selected" : ""} ${m.status ? `status-${m.status}` : ""} ${own ? "own" : ""}`}
                  tabIndex={0}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button,a")) return;
                    setSelected(selected === m.index ? null : m.index);
                  }}
                >
                  {grouped ? (
                    <span className="message-gutter">
                      <time>{m.timestamp}</time>
                    </span>
                  ) : (
                    <Avatar name={nameFor(m.senderUsername)} tone={i} />
                  )}
                  <div className="message-content">
                    {!grouped && (
                      <div className="message-author">
                        <strong>{nameFor(m.senderUsername)}</strong>
                        {own && <span>you</span>}
                        <time>{m.timestamp}</time>
                        {m.pinned && !m.deleted && <Icon name="pin" size={12} />}
                      </div>
                    )}
                    {replyText && !m.deleted && (
                      <div className="message-reply-preview">
                        <Icon name="reply" size={13} />
                        {replyText}
                      </div>
                    )}
                    <p style={m.deleted ? { opacity: 0.6, fontStyle: "italic" } : undefined}>
                      {body}
                      {m.edited && !m.deleted && (
                        <em className="message-edited">(edited)</em>
                      )}
                    </p>
                    {!m.deleted &&
                      m.attachment &&
                      (isImage ? (
                        <a
                          className="message-image"
                          href={m.attachment.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img src={m.attachment.url} alt={m.attachment.name} />
                          <span>
                            <Icon name="image" size={12} />
                            {m.attachment.name}
                          </span>
                        </a>
                      ) : (
                        <DownloadLink
                          className="message-attachment"
                          href={m.attachment.url}
                          download={m.attachment.name}
                        >
                          <Icon name="paperclip" size={15} />
                          {m.attachment.name}
                          <Icon name="download" size={14} />
                        </DownloadLink>
                      ))}
                    {!m.deleted && m.reactions?.length ? (
                      <div className="message-reactions">
                        {m.reactions.map((r) => {
                          const me = displayName || username || "alex";
                          return (
                            <button
                              type="button"
                              key={r.icon}
                              className={`reaction ${r.users.includes(me) || (username && r.users.includes(username)) ? "mine" : ""}`}
                              aria-label={`${REACTIONS.find((x) => x.icon === r.icon)?.label || "Reaction"}, ${r.users.length}`}
                              disabled={!canPost}
                              onClick={() => toggleReaction(m.index, r.icon)}
                            >
                              <Icon name={r.icon} size={12} />
                              {r.users.length}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                    {!m.deleted &&
                      m.attachment &&
                      (isImage ? (
                        <a
                          className="message-image"
                          href={m.attachment.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img src={m.attachment.url} alt={m.attachment.name} />
                          <span>
                            <Icon name="image" size={12} />
                            {m.attachment.name}
                          </span>
                        </a>
                      ) : (
                        <DownloadLink
                          className="message-attachment"
                          href={m.attachment.url}
                          download={m.attachment.name}
                        >
                          <Icon name="paperclip" size={15} />
                          {m.attachment.name}
                          <Icon name="download" size={14} />
                        </DownloadLink>
                      ))}
                    {!m.deleted && !m.attachment && m.attachmentUrl && (
                      <span
                        className="message-edited"
                        style={{ display: "block", marginTop: 4 }}
                      >
                        [Tệp đính kèm đã bị xóa khỏi phòng]
                      </span>
                    )}
                    {m.status === "sending" && (
                      <span className="message-status">
                        <Spinner size={9} />
                        Sending…
                      </span>
                    )}
                    {m.status === "failed" && (
                      <span className="message-status failed">
                        <Icon name="alert" size={12} />
                        Not sent.
                        <button
                          type="button"
                          onClick={() => {
                            const cid =
                              m.clientMessageId || crypto.randomUUID();
                            update(m.index, {
                              status: "sending",
                              clientMessageId: cid,
                            });
                            void deliver(cid, m.message, {
                              replyToId: m.replyToId,
                              attachmentFileId: m.attachment?.id,
                            });
                          }}
                        >
                          Retry
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setMessages((list) =>
                              list.filter((_, idx) => idx !== m.index),
                            )
                          }
                        >
                          Discard
                        </button>
                      </span>
                    )}
                  </div>
                  {!m.status && !m.deleted && (
                    <div className="message-actions">
                      {canPost && (
                        <IconButton
                          icon="reply"
                          label="Reply to message"
                          onClick={() => setReply(m)}
                        />
                      )}
                      <div className="reaction-picker-wrap">
                        <IconButton
                          icon="heart"
                          label="React to message"
                          disabled={!canPost}
                          onClick={() =>
                            setReacting(reacting === m.index ? null : m.index)
                          }
                        />
                        {reacting === m.index && (
                          <div className="reaction-picker" role="menu">
                            {REACTIONS.map((r) => (
                              <IconButton
                                key={r.icon}
                                icon={r.icon}
                                label={r.label}
                                onClick={() => {
                                  toggleReaction(m.index, r.icon);
                                  setReacting(null);
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      <IconButton
                        icon="pin"
                        label={m.pinned ? "Unpin message" : "Pin message"}
                        disabled={!canPost}
                        onClick={() => handlePinToggle(m.index)}
                      />
                      {own && canPost && (
                        <>
                          <IconButton
                            icon="edit"
                            label="Edit message"
                            onClick={() => {
                              setEditing(m.index);
                              setText(m.message);
                            }}
                          />
                          <IconButton
                            icon="trash"
                            label="Delete message"
                            onClick={() => setDeleting(m.index)}
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {!filtered.some((m) => !m.system) && (
            <EmptyState
              icon="chat"
              title={
                showPins
                  ? "Nothing pinned yet"
                  : query
                    ? "No matching messages"
                    : "Start the conversation"
              }
              description={
                showPins
                  ? "Keep important messages within easy reach."
                  : query
                    ? "Only messages loaded in this session are searchable."
                    : "Good ideas often begin with a simple hello."
              }
            />
          )}
          <div ref={bottom} />
        </div>
        <div className="chat-composer-area">
          {!canPost ? (
            <div className="composer-readonly">
              <Icon name="eye" size={14} />
              You have view-only access to this conversation.
            </div>
          ) : (
            <>
              {reply && (
                <div className="composer-context reply">
                  <Icon name="reply" size={14} />
                  <span>
                    Replying to <strong>{nameFor(reply.senderUsername)}</strong>
                    <small>{parseReply(reply).body.slice(0, 90)}</small>
                  </span>
                  <IconButton
                    icon="close"
                    label="Cancel reply"
                    onClick={() => setReply(null)}
                  />
                </div>
              )}
              {editing !== null && (
                <div className="composer-context">
                  <Icon name="edit" size={14} />
                  <span>Editing message</span>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditing(null);
                      setText("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
              {attachment && (
                <div className="composer-attachment">
                  {attachment.type.startsWith("image/") ? (
                    <img src={attachment.url} alt="" />
                  ) : (
                    <span className="composer-file-icon">
                      <Icon name="file" size={18} />
                    </span>
                  )}
                  <span>
                    <strong>{attachment.name}</strong>
                    <small>
                      {demo ? "Local attachment" : "Uploaded attachment"}
                    </small>
                  </span>
                  <IconButton
                    icon="close"
                    label="Remove attachment"
                    onClick={() => {
                      if (demo) URL.revokeObjectURL(attachment.url);
                      setAttachment(undefined);
                    }}
                  />
                </div>
              )}
              <div className={`chat-composer ${!live ? "disabled" : ""}`}>
                <Textarea
                  aria-label="Message"
                  placeholder={
                    !live
                      ? "Reconnect to send messages…"
                      : demo
                        ? "Message your team… (local demo)"
                        : "Message this room…"
                  }
                  rows={2}
                  value={text}
                  onChange={(e) => {
                    const val = e.target.value;
                    setText(val);
                    setMention(val.endsWith("@"));
                    notifyTyping(val.trim().length > 0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                    if (e.key === "Escape") {
                      setReply(null);
                      setMention(false);
                    }
                  }}
                />
                <div className="composer-tools">
                  <IconButton
                    icon="paperclip"
                    label={uploadingFile ? "Uploading…" : "Attach file"}
                    disabled={!live || uploadingFile}
                    onClick={() => file.current?.click()}
                  />
                  <IconButton
                    icon="at"
                    label="Mention a member"
                    onClick={() => setMention(!mention)}
                  />
                  <span>Enter to send · Shift + Enter for a new line</span>
                  <Button
                    variant="primary"
                    icon="send"
                    disabled={
                      !live || uploadingFile || (!text.trim() && !attachment)
                    }
                    onClick={send}
                  >
                    {editing !== null ? "Save edit" : "Send"}
                  </Button>
                </div>
              </div>
              {mention && (
                <div className="mention-menu">
                  {members.map((m) => (
                    <Button
                      variant="ghost"
                      key={m.userId}
                      onClick={() => {
                        setText(
                          (prev) =>
                            `${prev.endsWith("@") ? prev.slice(0, -1) : prev} @${m.username} `,
                        );
                        setMention(false);
                      }}
                    >
                      {m.fullName}
                      <small>@{m.username}</small>
                    </Button>
                  ))}
                </div>
              )}
              <Input
                className="sr-only"
                type="file"
                ref={file}
                tabIndex={-1}
                onChange={handleFileSelect}
              />
              {typingUsers.length > 0 && (
                <span className="typing-status">
                  {typingUsers.join(", ")}{" "}
                  {typingUsers.length === 1 ? "is" : "are"} typing…
                </span>
              )}
            </>
          )}
        </div>
      </section>
      {deleting !== null && (
        <Confirm
          title="Delete this message?"
          description="This message will be marked as deleted for everyone in the room."
          confirmLabel="Delete message"
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            const target = messages[deleting];
            if (demo) {
              setMessages((prev) => prev.filter((_, i) => i !== deleting));
            } else {
              update(deleting, {
                deleted: true,
                message: "[Tin nhắn đã bị xóa]",
                reactions: [],
              });
              if (target?.id && onDelete) {
                void onDelete(target.id);
              }
            }
            setDeleting(null);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}