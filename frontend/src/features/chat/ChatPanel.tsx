import { useEffect, useRef, useState } from "react";
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
  PlannedBadge,
  SecurityStatus,
  StatusIndicator,
  connectionSecurity,
} from "../../components/patterns";

export interface ChatMessage {
  id?: string;
  senderUsername: string;
  message: string;
  timestamp: string;
  replyTo?: string;
  pinned?: boolean;
  edited?: boolean;
  reactions?: { icon: string; users: string[] }[];
  attachment?: { name: string; url: string; type: string };
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
const API_ENDPOINT = "http://localhost:8080";
const now = () =>
  new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
/** Live replies are encoded as "↳ user: quote\n body" in the existing payload. */
function parseReply(m: ChatMessage) {
  if (m.replyTo || !m.message.startsWith("↳ ") || !m.message.includes("\n"))
    return { reply: m.replyTo, body: m.message };
  const [first, ...rest] = m.message.split("\n");
  return { reply: first.slice(2), body: rest.join("\n") };
}

export function ChatPanel({
  messages,
  setMessages,
  connected,
  connection,
  onSend,
}: {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  connected: boolean;
  connection: "connecting" | "connected" | "reconnecting" | "failed";
  onSend: (message: string) => boolean | Promise<boolean>;
}) {
  const { demo, members, can } = useWorkspace();
  const { user } = useAuth();
  const username = demo ? "alex" : user?.username;
  const canPost = can.edit;
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
  const file = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const live = demo || connected;
  const security = connectionSecurity(API_ENDPOINT);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages.length]);
  const nameFor = (u: string) =>
    members.find((p) => p.username === u)?.fullName || u || "Member";
  const update = (index: number, patch: Partial<ChatMessage>) =>
    setMessages((prev) =>
      prev.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    );
  const deliver = async (index: number, body: string) => {
    if (demo) {
      setTimeout(() => update(index, { status: undefined }), 450);
      return;
    }
    if (!(await onSend(body))) update(index, { status: "failed" });
  };
  const send = () => {
    if ((!text.trim() && !attachment) || !canPost) return;
    if (editing !== null) {
      update(editing, { message: text, edited: true });
      setEditing(null);
      setText("");
      return;
    }
    if (!demo && !connected) {
      toast("Chat is disconnected. Your draft has not been sent.", true);
      return;
    }
    const body = demo
      ? text
      : reply
        ? `↳ ${reply.senderUsername}: ${parseReply(reply).body}\n${text}`
        : text;
    const index = messages.length;
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        senderUsername: username || "you",
        message: body,
        timestamp: now(),
        replyTo: demo && reply ? parseReply(reply).body : undefined,
        attachment,
        status: "sending",
      },
    ]);
    void deliver(index, body);
    setText("");
    setReply(null);
    setAttachment(undefined);
  };
  const toggleReaction = (index: number, icon: string) =>
    setMessages((prev) =>
      prev.map((msg, i) => {
        if (i !== index) return msg;
        const me = username || "alex";
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
  const filtered = messages
    .map((m, index) => ({ ...m, index }))
    .filter(
      (m) =>
        (!query || (!m.system && m.message.toLowerCase().includes(query.toLowerCase()))) &&
        (!showPins || m.pinned),
    );
  const onlineSample = demo ? ["sarah", "mia"] : [];
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
            <strong>Chat</strong>
            <PlannedBadge label="Beta" />
          </div>
          <p>
            <Icon name="check" size={12} />
            Encrypted live send, receive and 50-message history
          </p>
          <p className="planned">
            <Icon name="clock" size={12} />
            Edits, reactions, pins, files and typing status are planned
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
                <StatusIndicator state="local" label="Sample conversation" compact />
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
          <div className="chat-date-separator">
            <span>
              {demo ? "SAMPLE CONVERSATION · TODAY" : "CURRENT SESSION"}
            </span>
          </div>
          {!demo && (
            <div className="chat-module-note">
              <Icon name="info" size={14} />
              Room messages are encrypted in the browser with AES-256-GCM and
              the latest 50 messages load from server history.
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
            const own = m.senderUsername === username;
            const { reply: replyText, body } = parseReply(m);
            const isImage = m.attachment?.type.startsWith("image/");
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
                        {m.pinned && <Icon name="pin" size={12} />}
                      </div>
                    )}
                    {replyText && (
                      <div className="message-reply-preview">
                        <Icon name="reply" size={13} />
                        {replyText}
                      </div>
                    )}
                    <p>
                      {body}
                      {m.edited && <em className="message-edited">(edited)</em>}
                    </p>
                    {m.attachment &&
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
                    {m.reactions?.length ? (
                      <div className="message-reactions">
                        {m.reactions.map((r) => (
                          <button
                            type="button"
                            key={r.icon}
                            className={`reaction ${r.users.includes(username || "alex") ? "mine" : ""}`}
                            aria-label={`${REACTIONS.find((x) => x.icon === r.icon)?.label || "Reaction"}, ${r.users.length}`}
                            disabled={!demo}
                            onClick={() => toggleReaction(m.index, r.icon)}
                          >
                            <Icon name={r.icon} size={12} />
                            {r.users.length}
                          </button>
                        ))}
                      </div>
                    ) : null}
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
                            update(m.index, { status: "sending" });
                            void deliver(m.index, m.message);
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
                  {!m.status && (
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
                          label={
                            demo
                              ? "React to message"
                              : "Reactions require backend support"
                          }
                          disabled={!demo || !canPost}
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
                        label="Pin message (demo only)"
                        disabled={!demo || !canPost}
                        onClick={() => update(m.index, { pinned: !m.pinned })}
                      />
                      {own && (
                        <>
                          <IconButton
                            icon="edit"
                            label="Edit message (demo only)"
                            disabled={!demo}
                            onClick={() => {
                              setEditing(m.index);
                              setText(m.message);
                            }}
                          />
                          <IconButton
                            icon="trash"
                            label="Delete message (demo only)"
                            disabled={!demo}
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
                  <span>Editing message · local demo</span>
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
                    <small>Local attachment · not uploaded</small>
                  </span>
                  <IconButton
                    icon="close"
                    label="Remove attachment"
                    onClick={() => {
                      URL.revokeObjectURL(attachment.url);
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
                    setText(e.target.value);
                    setMention(e.target.value.endsWith("@"));
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
                    label={
                      demo ? "Attach local file" : "Attachments are planned"
                    }
                    disabled={!demo}
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
                    disabled={!live || (!text.trim() && !attachment)}
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
                onChange={(e) => {
                  const chosen = e.target.files?.[0];
                  if (chosen) {
                    if (chosen.size > 20 * 1024 * 1024) {
                      toast("Attachments must be smaller than 20 MB.", true);
                      return;
                    }
                    setAttachment({
                      name: chosen.name,
                      type: chosen.type,
                      url: URL.createObjectURL(chosen),
                    });
                  }
                  e.target.value = "";
                }}
              />
              {text && (
                <span className="typing-status">
                  You are writing a {demo ? "local demo message" : "draft"}…
                </span>
              )}
            </>
          )}
        </div>
      </section>
      {deleting !== null && (
        <Confirm
          title="Delete this message?"
          description="The message will be removed from this demo conversation."
          confirmLabel="Delete message"
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            setMessages((prev) => prev.filter((_, i) => i !== deleting));
            setDeleting(null);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
