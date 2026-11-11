import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useAuth } from "../../context/AuthContext";
import {
  Avatar,
  Button,
  DownloadLink,
  EmptyState,
  IconButton,
  Input,
  Notice,
  Textarea,
  useToast,
} from "../../components/ui";
import { Icon } from "../../components/Icon";

export interface ChatMessage {
  id?: string;
  senderUsername: string;
  message: string;
  timestamp: string;
  replyTo?: string;
  pinned?: boolean;
  reactions?: string[];
  attachment?: { name: string; url: string; type: string };
}
export function ChatPanel({
  messages,
  setMessages,
  connected,
  onSend,
}: {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  connected: boolean;
  onSend: (message: string) => void;
}) {
  const { demo, members } = useWorkspace();
  const { user } = useAuth();
  const username = demo ? "alex" : user?.username;
  const [query, setQuery] = useState("");
  const [text, setText] = useState("");
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [showPins, setShowPins] = useState(false);
  const [mention, setMention] = useState(false);
  const [attachment, setAttachment] = useState<ChatMessage["attachment"]>();
  const [security, setSecurity] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const toast = useToast();
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages.length]);
  const send = () => {
    if (!text.trim() && !attachment) return;
    if (demo) {
      if (editing !== null)
        setMessages((prev) =>
          prev.map((m, i) => (i === editing ? { ...m, message: text } : m)),
        );
      else
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            senderUsername: "alex",
            message: text,
            timestamp: new Date().toLocaleTimeString("en", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            replyTo: reply?.message,
            attachment,
          },
        ]);
    } else {
      if (!connected) {
        toast("Chat is disconnected. Your draft has not been sent.", true);
        return;
      }
      onSend(
        reply ? `↳ ${reply.senderUsername}: ${reply.message}\n${text}` : text,
      );
    }
    setText("");
    setReply(null);
    setEditing(null);
    setAttachment(undefined);
  };
  const filtered = messages
    .map((m, index) => ({ ...m, index }))
    .filter(
      (m) =>
        m.message.toLowerCase().includes(query.toLowerCase()) &&
        (!showPins || m.pinned),
    );
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
          Team conversation<span className="tab-count">{messages.length}</span>
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
          <span className="eyebrow">WORKSPACE MEMBERS</span>
          {members.map((m, i) => (
            <div key={m.userId}>
              <Avatar name={m.fullName} tone={i} size="small" />
              <span>{m.fullName}</span>
            </div>
          ))}
        </div>
        <div className="chat-security">
          <Icon name="shield" size={18} />
          <strong>Security, without assumptions.</strong>
          <p>End-to-end encryption is enabled for room messages.</p>
          <Button variant="ghost" onClick={() => setSecurity(!security)}>
            {security ? "Hide details" : "Learn more"}
            <Icon name="chevron" size={12} />
          </Button>
          {security && (
            <p>
              {demo
                ? "Demo messages never leave this session."
                : "Room messages are encrypted in the browser with AES-256-GCM before being sent. Legacy plaintext messages remain readable when encountered."}
            </p>
          )}
        </div>
      </aside>
      <section className="chat-main">
        <div className="chat-heading">
          <div>
            <strong>
              {showPins ? "Pinned messages" : "Team conversation"}
            </strong>
            <span>
              {demo
                ? "Local demo chat"
                : connected
                  ? "Connected · live delivery"
                  : "Disconnected · messages not sent"}
            </span>
          </div>
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
        <div className="chat-timeline">
          <div className="chat-date-separator">
            <span>
              {demo ? "SAMPLE CONVERSATION · TODAY" : "CURRENT SESSION"}
            </span>
          </div>
          <Notice>
            {demo
              ? "Sample conversation. Sending, replies, edits, pins, reactions and local attachments work only in this demo."
              : "Messages use the STOMP room channel and load the latest 50 messages from server history. Editing, deletion, reactions, pins, attachments and typing broadcasts are not supported."}
          </Notice>
          {filtered.map((m, i) => (
            <div className="chat-message" key={m.id || m.index}>
              <Avatar
                name={
                  members.find((p) => p.username === m.senderUsername)
                    ?.fullName ||
                  m.senderUsername ||
                  "Member"
                }
                tone={i}
              />
              <div className="message-content">
                <div className="message-author">
                  <strong>
                    {members.find((p) => p.username === m.senderUsername)
                      ?.fullName ||
                      m.senderUsername ||
                      "Member"}
                  </strong>
                  {m.senderUsername === username && <span>you</span>}
                  <time>{m.timestamp}</time>
                  {m.pinned && <Icon name="pin" size={12} />}
                </div>
                {m.replyTo && (
                  <div className="message-reply-preview">
                    <Icon name="reply" size={13} />
                    {m.replyTo}
                  </div>
                )}
                <p>{m.message}</p>
                {m.attachment && (
                  <DownloadLink
                    className="message-attachment"
                    href={m.attachment.url}
                    download={m.attachment.name}
                  >
                    <Icon name="paperclip" size={15} />
                    {m.attachment.name}
                    <Icon name="download" size={14} />
                  </DownloadLink>
                )}
                {m.reactions?.length ? (
                  <Button
                    variant="ghost"
                    className="reaction"
                    icon="heart"
                    onClick={() =>
                      setMessages((prev) =>
                        prev.map((msg, index) =>
                          index === m.index
                            ? {
                                ...msg,
                                reactions: msg.reactions?.includes(
                                  username || "alex",
                                )
                                  ? msg.reactions.filter(
                                      (n) => n !== (username || "alex"),
                                    )
                                  : [
                                      ...(msg.reactions || []),
                                      username || "alex",
                                    ],
                              }
                            : msg,
                        ),
                      )
                    }
                  >
                    {m.reactions.length}
                  </Button>
                ) : null}
              </div>
              <div className="message-actions">
                <IconButton
                  icon="reply"
                  label="Reply to message"
                  onClick={() => setReply(m)}
                />
                <IconButton
                  icon="heart"
                  label={
                    demo
                      ? "React to message"
                      : "Reactions require backend support"
                  }
                  disabled={!demo}
                  onClick={() =>
                    setMessages((prev) =>
                      prev.map((msg, index) =>
                        index === m.index
                          ? {
                              ...msg,
                              reactions: msg.reactions?.includes("alex")
                                ? msg.reactions.filter((n) => n !== "alex")
                                : [...(msg.reactions || []), "alex"],
                            }
                          : msg,
                      ),
                    )
                  }
                />
                <IconButton
                  icon="pin"
                  label="Pin message (demo only)"
                  disabled={!demo}
                  onClick={() =>
                    setMessages((prev) =>
                      prev.map((msg, index) =>
                        index === m.index
                          ? { ...msg, pinned: !msg.pinned }
                          : msg,
                      ),
                    )
                  }
                />
                {m.senderUsername === username && (
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
                      onClick={() =>
                        setMessages((prev) =>
                          prev.filter((_, index) => index !== m.index),
                        )
                      }
                    />
                  </>
                )}
              </div>
            </div>
          ))}
          {!filtered.length && (
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
                  : "Good ideas often begin with a simple hello."
              }
            />
          )}
          <div ref={bottom} />
        </div>
        <div className="chat-composer-area">
          {reply && (
            <div className="composer-context">
              <Icon name="reply" size={14} />
              <span>
                Replying to {reply.senderUsername}: {reply.message.slice(0, 80)}
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
              <span>Editing a local demo message</span>
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
            <div className="composer-context">
              <Icon name="paperclip" size={14} />
              <span>{attachment.name} · local attachment</span>
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
          <div className="chat-composer">
            <Textarea
              aria-label="Message"
              placeholder={
                demo ? "Message your team… (local demo)" : "Message this room…"
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
              }}
            />
            <div className="composer-tools">
              <IconButton
                icon="paperclip"
                label="Attach local file (demo only)"
                disabled={!demo}
                onClick={() => file.current?.click()}
              />
              <Button
                variant="ghost"
                onClick={() => setMention(!mention)}
                aria-label="Mention a member"
              >
                @
              </Button>
              <span>Enter to send · Shift + Enter for a new line</span>
              <Button
                variant="primary"
                icon="send"
                disabled={
                  (!demo && !connected) || (!text.trim() && !attachment)
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
        </div>
      </section>
    </div>
  );
}
