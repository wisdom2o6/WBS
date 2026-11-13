import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import axios from "axios";
import Konva from "konva";
import { useAuth } from "../context/AuthContext";
import {
  Stage,
  Layer,
  Rect,
  Circle,
  Ellipse,
  Line,
  Text,
  Group,
  Arrow,
  Transformer,
  Image as KonvaImage,
} from "react-konva";
import { useWorkspace } from "../context/WorkspaceContext";
import {
  Button,
  Confirm,
  Dropdown,
  Field,
  IconButton,
  Input,
  Modal,
  Notice,
  Spinner,
  useToast,
} from "../components/ui";
import { Icon } from "../components/Icon";
import {
  MenuDivider,
  MenuItem,
  PlannedBadge,
  Presence,
  RoleBadge,
  StatusIndicator,
} from "../components/patterns";
import type { SyncState } from "../components/patterns";
import { ChatPanel } from "../features/chat/ChatPanel";
import type { ChatMessage } from "../features/chat/ChatPanel";
import { errorMessage } from "../services/workspace";
import { decryptMessage, encryptMessage } from "../utils/cryptoUtils";
import type { AlignMode, Shape, Tool } from "../features/canvas/types";
import {
  GRID,
  NOTE_COLORS,
  readCanvasPrefs,
  shapeLabel,
  writeCanvasPrefs,
} from "../features/canvas/types";
import { CanvasLayers } from "../features/canvas/CanvasLayers";
import { CanvasInspector } from "../features/canvas/CanvasInspector";
import {
  CanvasToolOptions,
  CanvasToolRail,
} from "../features/canvas/CanvasToolRail";

interface HistoryEntry {
  shapes: Shape[];
  affectedIds: Set<string>;
}

interface UserCursor {
  username: string;
  x: number;
  y: number;
  color: string;
  lastActive?: number;
}

interface ChatApiMessage {
  id?: string | number;
  senderId?: string;
  senderName?: string;
  senderUsername?: string;
  content: string;
  timestamp?: string;
}

const isUUID = (value?: string) =>
  !!value &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );

async function toChatMessage(
  item: ChatApiMessage,
  roomId: string,
): Promise<ChatMessage> {
  let content = item.content;
  try {
    content = await decryptMessage(item.content, roomId);
  } catch {
    // Legacy plaintext messages remain readable.
  }
  const sender =
    [item.senderName, item.senderUsername].find((name) => name && !isUUID(name)) ||
    "Member";
  return {
    id: item.id === undefined ? undefined : String(item.id),
    senderUsername: sender,
    message: content,
    timestamp:
      item.timestamp ||
      new Date().toLocaleTimeString("en", {
        hour: "2-digit",
        minute: "2-digit",
      }),
  };
}

const API = "http://localhost:8080";
const PLEX = "IBM Plex Sans, sans-serif";

// Component phụ render Ảnh trên Konva Canvas (supports stretch / contain / cover)
const URLImage: React.FC<{ shape: Shape; common: any }> = ({
  shape,
  common,
}) => {
  const [image, setImage] = useState<HTMLImageElement | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!shape.imageUrl) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = shape.imageUrl;
    img.onload = () => setImage(img);
    img.onerror = () => setFailed(true);
  }, [shape.imageUrl]);

  const w = shape.width || 200,
    h = shape.height || 200;
  const base = {
    ...common,
    x: shape.x,
    y: shape.y,
    rotation: shape.rotation || 0,
    opacity: shape.opacity ?? 1,
  };
  if (!image)
    return (
      <Group {...base}>
        <Rect
          width={w}
          height={h}
          fill="#ecebe5"
          stroke={failed ? "#b4473f" : "#d9d8d0"}
          dash={[6, 4]}
        />
        <Text
          text={failed ? "Image unavailable" : "Loading image…"}
          width={w}
          y={h / 2 - 7}
          align="center"
          fontSize={12}
          fontFamily={PLEX}
          fill="#74766f"
          listening={false}
        />
      </Group>
    );
  if (shape.fit === "contain") {
    const r = Math.min(w / image.width, h / image.height);
    const iw = image.width * r,
      ih = image.height * r;
    return (
      <Group {...base}>
        <Rect width={w} height={h} fill="transparent" />
        <KonvaImage
          image={image}
          x={(w - iw) / 2}
          y={(h - ih) / 2}
          width={iw}
          height={ih}
          listening={false}
        />
      </Group>
    );
  }
  let crop: { x: number; y: number; width: number; height: number } | undefined;
  if (shape.fit === "cover") {
    const r = Math.max(w / image.width, h / image.height);
    const cw = w / r,
      ch = h / r;
    crop = {
      x: (image.width - cw) / 2,
      y: (image.height - ch) / 2,
      width: cw,
      height: ch,
    };
  }
  return (
    <KonvaImage {...base} image={image} width={w} height={h} crop={crop} />
  );
};

const demoCanvasCache: Record<string, Shape[]> = {};
const demoMessageCache: Record<string, ChatMessage[]> = {};
function initialDemoShapes(): Shape[] {
  return [
    {
      id: "demo-frame",
      type: "RECTANGLE",
      kind: "frame",
      x: 100,
      y: 90,
      width: 620,
      height: 420,
      color: "#bcc3b0",
      fill: "#fffefb",
      name: "01 — Brand exploration",
      locked: true,
    },
    {
      id: "demo-heading",
      type: "TEXT",
      x: 140,
      y: 140,
      text: "North®",
      fontSize: 82,
      color: "#37422f",
      name: "Wordmark / North",
    },
    {
      id: "demo-subheading",
      type: "TEXT",
      x: 147,
      y: 255,
      text: "Thoughtfully moving forward.",
      fontSize: 21,
      color: "#747e68",
      name: "Brand statement",
    },
    {
      id: "demo-label",
      type: "TEXT",
      x: 147,
      y: 115,
      text: "IDENTITY EXPLORATION / 01",
      fontSize: 10,
      color: "#939b86",
      name: "Artboard label",
    },
    {
      id: "demo-palette-1",
      type: "RECTANGLE",
      x: 148,
      y: 357,
      width: 88,
      height: 65,
      color: "#37422f",
      fill: "#37422f",
      name: "Forest / Primary",
    },
    {
      id: "demo-palette-2",
      type: "RECTANGLE",
      x: 248,
      y: 357,
      width: 88,
      height: 65,
      color: "#b5bda5",
      fill: "#b5bda5",
      name: "Sage / Secondary",
    },
    {
      id: "demo-palette-3",
      type: "RECTANGLE",
      x: 348,
      y: 357,
      width: 88,
      height: 65,
      color: "#e0e3cc",
      fill: "#e0e3cc",
      name: "Linen / Neutral",
    },
    {
      id: "demo-note",
      type: "STICKY_NOTE",
      x: 500,
      y: 280,
      width: 170,
      height: 170,
      text: "Make room for\nwhat’s next.\n\nA confident, quieter direction.",
      color: "#e8ebcc",
      rotation: -5,
      name: "Creative direction",
    },
    {
      id: "demo-caption",
      type: "TEXT",
      x: 148,
      y: 455,
      text: "LESS NOISE. MORE MEANING.",
      fontSize: 10,
      color: "#939b86",
      name: "Principle",
    },
  ];
}
export const RoomCanvas: React.FC<{
  view?: "canvas" | "chat";
  isActive?: boolean;
}> = ({ view = "canvas", isActive = true }) => {
  const { roomId } = useParams<{ roomId: string }>();
  const { token, user } = useAuth();
  const { demo, assets, workspace, can, role, members } = useWorkspace();
  const readOnly = !can.edit;
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [prefs] = useState(readCanvasPrefs);

  // State Pan & Zoom (Infinite Canvas)
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  const [tool, setToolState] = useState<Tool>("SELECT");
  const [shapeTool, setShapeTool] = useState<Tool>("RECTANGLE");
  const [color, setColor] = useState("#2455d6");
  const [noteColor, setNoteColor] = useState(NOTE_COLORS[0].value);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [shapes, setShapes] = useState<Shape[]>(() =>
    demo
      ? structuredClone(demoCanvasCache[roomId || ""] || initialDemoShapes())
      : [],
  );
  const [isMouseDown, setIsMouseDown] = useState(false);
  const drawingId = useRef<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(
    null,
  );
  const pendingNew = useRef<string | null>(null);
  // Mirrors `editing` so blur + stage mousedown cannot commit twice.
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    target: string | null;
    point: { x: number; y: number };
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);

  // Chat & File Upload State
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    demo
      ? structuredClone(
          demoMessageCache[roomId || ""] || [
            {
              id: "system-1",
              senderUsername: "system",
              system: true,
              message: "Sarah Chen created this room",
              timestamp: "09:30",
            },
            {
              id: "sample-1",
              senderUsername: "sarah",
              message:
                "A fresh space for the next chapter. I’ve added a first direction to the canvas — a little quieter, a little more confident.",
              timestamp: "09:41",
            },
            {
              id: "sample-2",
              senderUsername: "james",
              message:
                "Love the restraint. The sage palette feels really considered. Let’s keep the typography doing the heavy lifting.",
              timestamp: "09:44",
              reactions: [{ icon: "heart", users: ["sarah"] }],
            },
            {
              id: "sample-3",
              senderUsername: "sarah",
              message: "Uploaded a reference for the palette.",
              timestamp: "09:45",
              attachment: {
                name: "Light and structure.jpg",
                url: "/demo/light-and-structure.jpg",
                type: "image/jpeg",
              },
            },
            {
              id: "sample-4",
              senderUsername: "alex",
              message:
                "Agreed. I’ll pull together a few more references before our review.",
              timestamp: "09:46",
            },
            {
              id: "sample-5",
              senderUsername: "mia",
              message:
                "Joining late — could we try the wordmark at a slightly lighter weight?",
              timestamp: "09:52",
              unreadBoundary: true,
              replyTo: "Love the restraint. The sage palette feels really considered.",
            },
          ],
        )
      : [],
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stompClientRef = useRef<Client | null>(null);
  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);
  const overlayRef = useRef<any>(null);
  const sampleCursorRef = useRef<any>(null);

  const [cursors, setCursors] = useState<{ [key: string]: UserCursor }>({});
  const lastCursorSend = useRef<number>(0);
  const [connected, setConnected] = useState(false);
  const [conn, setConn] = useState<
    "connecting" | "connected" | "reconnecting" | "failed"
  >(demo ? "connected" : "connecting");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [queued, setQueued] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(!demo);
  const [canvasError, setCanvasError] = useState("");
  const [grid, setGridState] = useState(prefs.grid);
  const [snap, setSnapState] = useState(prefs.snap);
  const [showLayers, setShowLayers] = useState(
    () => prefs.layers && window.innerWidth > 1000,
  );
  const [showInspector, setShowInspector] = useState(
    () => window.innerWidth > 760,
  );
  const [clearOpen, setClearOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [multiIds, setMultiIds] = useState<string[]>([]);
  const pendingEvents = useRef<
    Map<string, { type: string; payload: Shape | { id: string } }>
  >(new Map());
  const past = useRef<HistoryEntry[]>([]);
  const future = useRef<HistoryEntry[]>([]);
  const replaying = useRef(false);
  const editedIds = useRef<Set<string>>(new Set());
  const [historyCounts, setHistoryCounts] = useState({ undo: 0, redo: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 550 });
  const selected = shapes.find((s) => s.id === selectedId);
  const selectionIds = multiIds.length
    ? multiIds
    : selectedId
      ? [selectedId]
      : [];
  const orderedShapes = shapes.toSorted(
    (a, b) => (a.order ?? shapes.indexOf(a)) - (b.order ?? shapes.indexOf(b)),
  );
  const setTool = (t: Tool) => {
    if (readOnly && t !== "SELECT" && t !== "HAND") return;
    setToolState(t);
    setSelectedId(null);
    setMultiIds([]);
    setHoverId(null);
  };
  const setGrid = (v: boolean) => {
    setGridState(v);
    writeCanvasPrefs({ grid: v });
  };
  const setSnap = (v: boolean) => {
    setSnapState(v);
    writeCanvasPrefs({ snap: v });
  };
  const setReadout = (text: string) => {
    if (readoutRef.current) readoutRef.current.textContent = text;
  };
  const recordHistory = () => {
    past.current = [
      ...past.current.slice(-49),
      { shapes: structuredClone(shapes), affectedIds: new Set() },
    ];
    future.current = [];
    setHistoryCounts({ undo: past.current.length, redo: 0 });
  };
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      if (rect.width && rect.height)
        setSize({ width: rect.width, height: rect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [view, showLayers, showInspector]);
  useEffect(() => {
    if (demo && roomId) demoCanvasCache[roomId] = structuredClone(shapes);
  }, [shapes, roomId, demo]);
  useEffect(() => {
    if (demo && roomId) demoMessageCache[roomId] = structuredClone(messages);
  }, [messages, roomId, demo]);
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  const getUserColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++)
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const c = (hash & 0x00ffffff).toString(16).toUpperCase();
    return "#" + "00000".substring(0, 6 - c.length) + c;
  };

  // Tính tọa độ con trỏ tương đối theo Pan & Zoom
  const getRelativePointerPosition = (stage: any) => {
    if (!stage) return { x: 0, y: 0 };
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    const pos = stage.getPointerPosition();
    return pos ? transform.point(pos) : { x: 0, y: 0 };
  };

  useEffect(() => {
    if (demo || !token || !roomId) return;

    const client = new Client({
      webSocketFactory: () => new SockJS(`${API}/ws-visual-workspace`),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true);
        setConn("connected");
        for (const event of pendingEvents.current.values())
          client.publish({
            destination: `/app/room.${roomId}.draw`,
            body: JSON.stringify({ roomId, ...event }),
          });
        if (pendingEvents.current.size) setSaveState("saving");
        pendingEvents.current.clear();
        setQueued(0);
        // 1. Subscribe nét vẽ
        client.subscribe(`/topic/room.${roomId}`, (message) => {
          const drawEvent = JSON.parse(message.body);
          if (drawEvent.payload?.id)
            editedIds.current.add(drawEvent.payload.id);
          if (drawEvent.senderUsername === user?.username) {
            setSaveState("saved");
            if (saveTimer.current) clearTimeout(saveTimer.current);
          }
          if (drawEvent.senderUsername !== user?.username) {
            if (drawEvent.type === "ERASER") {
              setShapes((prev) =>
                prev.filter((s) => s.id !== drawEvent.payload.id),
              );
            } else {
              setShapes((prev) =>
                prev.some((s) => s.id === drawEvent.payload.id)
                  ? prev.map((s) =>
                      s.id === drawEvent.payload.id ? drawEvent.payload : s,
                    )
                  : [...prev, drawEvent.payload],
              );
            }
          }
        });

        // 2. Subscribe con trỏ chuột
        client.subscribe(`/topic/room.${roomId}.cursors`, (message) => {
          const data = JSON.parse(message.body);
          if (data.username && data.username !== user?.username) {
            setCursors((prev) => ({
              ...prev,
              [data.username]: {
                username: data.username,
                x: data.x,
                y: data.y,
                color: getUserColor(data.username),
                lastActive: Date.now(),
              },
            }));
          }
        });

        // 3. Subscribe Presence (LEAVE)
        client.subscribe("/topic/presence", (message) => {
          const event = JSON.parse(message.body);
          if (event.type === "LEAVE" && event.username) {
            setCursors((prev) => {
              const next = { ...prev };
              delete next[event.username];
              return next;
            });
          }
        });

        // 4. Subscribe Room Chat — reconcile our own optimistic messages.
        client.subscribe(`/topic/room/${roomId}/chat`, (message) => {
          void (async () => {
            try {
              const chatMessage = await toChatMessage(
                JSON.parse(message.body) as ChatApiMessage,
                roomId,
              );
              setMessages((prev) => {
                const index = prev.findIndex(
                  (m) =>
                    m.status === "sending" &&
                    m.message === chatMessage.message,
                );
                if (index >= 0)
                  return prev.map((m, i) =>
                    i === index ? { ...chatMessage, replyTo: m.replyTo } : m,
                  );
                return [...prev, chatMessage];
              });
            } catch (error) {
              setCanvasError(errorMessage(error));
            }
          })();
        });
      },
      onWebSocketClose: () => {
        setConnected(false);
        setConn((prev) => (prev === "failed" ? prev : "reconnecting"));
        setMessages((prev) =>
          prev.map((m) =>
            m.status === "sending" ? { ...m, status: "failed" } : m,
          ),
        );
      },
      onStompError: () => {
        setConnected(false);
        setConn("failed");
        setCanvasError(
          "The room connection was rejected. Check your session and backend.",
        );
      },
    });

    client.activate();
    stompClientRef.current = client;
    return () => {
      client.deactivate();
    };
  }, [roomId, token, user?.username, demo]);

  // The backend keeps the latest room messages; decrypt them in the browser.
  useEffect(() => {
    if (demo || !roomId || !token) return;
    let active = true;
    axios
      .get(`${API}/api/rooms/${roomId}/messages?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(async (response) => {
        const data = Array.isArray(response.data)
          ? response.data
          : Array.isArray(response.data?.messages)
            ? response.data.messages
            : [];
        const history = await Promise.all(
          (data as ChatApiMessage[]).map((item) =>
            toChatMessage(item, roomId),
          ),
        );
        if (active) setMessages(history);
      })
      .catch((error) => {
        if (active) setCanvasError(errorMessage(error));
      });
    return () => {
      active = false;
    };
  }, [demo, roomId, token]);
  const retryConnection = async () => {
    const client = stompClientRef.current;
    if (!client) return;
    setConn("connecting");
    setCanvasError("");
    await client.deactivate();
    client.activate();
  };

  useEffect(() => {
    if (
      tool === "SELECT" &&
      selectedId &&
      transformerRef.current &&
      stageRef.current
    ) {
      const ids = multiIds.length ? multiIds : [selectedId];
      const selectedNodes = ids
        .filter((id) => !shapes.find((s) => s.id === id)?.locked)
        .map((id) => stageRef.current.findOne("#" + id))
        .filter(Boolean);
      transformerRef.current.nodes(selectedNodes);
      transformerRef.current.getLayer().batchDraw();
    }
  }, [selectedId, tool, shapes, multiIds]);

  // Cleanup con trỏ quá 5s không tương tác
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCursors((prev) => {
        let updated = false;
        const next = { ...prev };
        Object.keys(next).forEach((username) => {
          if (now - (next[username].lastActive || 0) > 5000) {
            delete next[username];
            updated = true;
          }
        });
        return updated ? next : prev;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Demo only: a clearly-labelled sample collaborator cursor drifts across the board.
  useEffect(() => {
    if (!demo || !isActive || view !== "canvas") return;
    const points = [
      [560, 230],
      [430, 420],
      [640, 380],
      [300, 190],
    ];
    let i = 0;
    const move = () => {
      const node = sampleCursorRef.current;
      if (!node) return;
      const [x, y] = points[i++ % points.length];
      node.to({ x, y, duration: 2.6, easing: Konva.Easings.EaseInOut });
    };
    move();
    const interval = setInterval(move, 3200);
    return () => clearInterval(interval);
  }, [demo, isActive, view]);

  // Tải lịch sử vẽ từ Database
  useEffect(() => {
    if (demo || !roomId || !token) return;

    let active = true;
    const fetchCanvasHistory = async () => {
      try {
        const res = await axios.get(`${API}/api/v1/rooms/${roomId}/canvas`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (active && Array.isArray(res.data)) {
          setShapes((prev) => [
            ...res.data.filter((s: Shape) => !editedIds.current.has(s.id)),
            ...prev.filter((s) => editedIds.current.has(s.id)),
          ]);
        }
      } catch (err) {
        if (active) setCanvasError(errorMessage(err));
      } finally {
        if (active) setHistoryLoading(false);
      }
    };

    fetchCanvasHistory();
    return () => {
      active = false;
    };
  }, [roomId, token, demo]);

  // Insert an asset handed over from the media library.
  const handledInsert = useRef<string | null>(null);
  useEffect(() => {
    const asset = (location.state as { insertAsset?: { url: string; name: string } } | null)
      ?.insertAsset;
    if (!asset || !isActive || handledInsert.current === location.key) return;
    handledInsert.current = location.key;
    if (!readOnly) insertImage(asset.url, asset.name);
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, isActive]);

  // Bắt phím Spacebar để Pan Canvas
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (view !== "canvas" || !isActive) return;
      if (
        (e.target as HTMLElement)?.closest(
          'input,textarea,select,[contenteditable], [role="dialog"]',
        )
      )
        return;
      if (e.code === "Space" && !isSpacePressed) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isSpacePressed, view, isActive]);

  // Context menu dismissal
  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector<HTMLElement>("button")?.focus();
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = Array.from(
          menuRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled)") ||
            [],
        );
        const index = items.indexOf(document.activeElement as HTMLElement);
        items[
          (index + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
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
  }, [menu]);

  // Viewport helpers
  const clampScale = (s: number) => Math.max(0.1, Math.min(5, s));
  const zoomTo = (
    scale: number,
    center = { x: size.width / 2, y: size.height / 2 },
  ) => {
    const next = clampScale(scale);
    const point = {
      x: (center.x - stagePos.x) / stageScale,
      y: (center.y - stagePos.y) / stageScale,
    };
    setStageScale(next);
    setStagePos({ x: center.x - point.x * next, y: center.y - point.y * next });
  };
  const resetView = () => {
    setStageScale(1);
    setStagePos({ x: 0, y: 0 });
  };
  const fitToScreen = (ids?: string[]) => {
    const stage = stageRef.current;
    if (!stage) return;
    const nodes = (ids ?? shapes.filter((s) => !s.hidden).map((s) => s.id))
      .map((id) => stage.findOne("#" + id))
      .filter(Boolean);
    if (!nodes.length) return resetView();
    const rects = nodes.map((n: any) => n.getClientRect({ relativeTo: stage }));
    const minX = Math.min(...rects.map((r: any) => r.x));
    const minY = Math.min(...rects.map((r: any) => r.y));
    const maxX = Math.max(...rects.map((r: any) => r.x + r.width));
    const maxY = Math.max(...rects.map((r: any) => r.y + r.height));
    const pad = 64;
    const scale = clampScale(
      Math.min(
        (size.width - pad * 2) / Math.max(1, maxX - minX),
        (size.height - pad * 2) / Math.max(1, maxY - minY),
        2,
      ),
    );
    setStageScale(scale);
    setStagePos({
      x: size.width / 2 - ((minX + maxX) / 2) * scale,
      y: size.height / 2 - ((minY + maxY) / 2) * scale,
    });
  };

  // Xử lý Wheel Zoom
  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = clampScale(
      e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy,
    );

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    setStageScale(newScale);
    setStagePos(newPos);
  };

  const broadcastEvent = (eventType: string, payload: any) => {
    if (payload.id) {
      editedIds.current.add(payload.id);
      if (!replaying.current) past.current.at(-1)?.affectedIds.add(payload.id);
    }
    if (demo) return;
    if (stompClientRef.current?.connected && roomId) {
      setSaveState("saving");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      // Without a server echo we fall back to "Live", never to "Saved".
      saveTimer.current = setTimeout(() => setSaveState("idle"), 6000);
      stompClientRef.current.publish({
        destination: `/app/room.${roomId}.draw`,
        body: JSON.stringify({ roomId, type: eventType, payload }),
      });
    } else if (payload.id) {
      pendingEvents.current.set(payload.id, { type: eventType, payload });
      setQueued(pendingEvents.current.size);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || !stompClientRef.current?.connected || !roomId)
      return false;
    const encrypted = await encryptMessage(message.trim(), roomId);
    stompClientRef.current.publish({
      destination: `/app/room/${roomId}/chat.send`,
      body: JSON.stringify({
        roomId,
        senderId: user?.id || user?.userId || user?.username || "",
        senderName: user?.fullName || user?.username || "Member",
        content: encrypted,
        timestamp: new Date().toISOString(),
      }),
    });
    return true;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || (!token && !demo)) return;
    if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) {
      toast("Choose an image smaller than 20 MB.", true);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = demo
        ? { data: { url: URL.createObjectURL(file) } }
        : await axios.post(`${API}/api/v1/upload`, formData, {
            headers: {
              "Content-Type": "multipart/form-data",
              Authorization: `Bearer ${token}`,
            },
          });

      const imageUrl = res.data.url;
      const newId = `shape-${crypto.randomUUID()}`;
      const imgShape: Shape = {
        id: newId,
        type: "IMAGE",
        x: (size.width / 2 - 125 - stagePos.x) / stageScale,
        y: (size.height / 2 - 125 - stagePos.y) / stageScale,
        width: 250,
        height: 250,
        imageUrl: imageUrl,
        name: file.name,
        color: "transparent",
      };

      recordHistory();
      setShapes((prev) => [...prev, imgShape]);
      broadcastEvent("IMAGE", imgShape);
      setToolState("SELECT");
      setSelectedId(newId);
      e.target.value = "";
    } catch (err) {
      toast(errorMessage(err), true);
    }
  };

  const findShapeId = (node: any): string | null => {
    let n = node;
    while (n && n !== stageRef.current) {
      const id = n.id?.();
      if (id && shapes.some((s) => s.id === id)) return id;
      n = n.getParent?.();
    }
    return null;
  };

  const executeErase = (targetNode: any) => {
    if (!targetNode || tool !== "ERASER") return;
    const idToDelete = findShapeId(targetNode);
    if (idToDelete) {
      if (shapes.find((s) => s.id === idToDelete)?.locked) return;
      setShapes((prev) => prev.filter((s) => s.id !== idToDelete));
      broadcastEvent("ERASER", { id: idToDelete });
    }
  };

  const startEditing = (s: Shape) => {
    if (readOnly || s.locked || (s.type !== "TEXT" && s.type !== "STICKY_NOTE"))
      return;
    setToolState("SELECT");
    setSelectedId(s.id);
    setMultiIds([]);
    setHoverId(null);
    setEditing({ id: s.id, value: s.text || "" });
  };
  const commitEditing = (cancel = false) => {
    const current = editingRef.current;
    if (!current) return;
    editingRef.current = null;
    const s = shapes.find((x) => x.id === current.id);
    const isNew = pendingNew.current === current.id;
    pendingNew.current = null;
    setEditing(null);
    if (!s) return;
    const value = cancel ? s.text || "" : current.value;
    if (s.type === "TEXT" && !value.trim()) {
      setShapes((prev) => prev.filter((x) => x.id !== s.id));
      if (!isNew) broadcastEvent("ERASER", { id: s.id });
      setSelectedId(null);
      return;
    }
    if (!isNew && value === s.text) return;
    if (!isNew) recordHistory();
    const next = { ...s, text: value };
    setShapes((prev) => prev.map((x) => (x.id === s.id ? next : x)));
    broadcastEvent(isNew ? s.type : "UPDATE", next);
  };

  const handleMouseDown = (e: any) => {
    if (editingRef.current) {
      commitEditing();
      return;
    }
    if (e.evt?.button === 2) return;
    if (isSpacePressed || tool === "HAND") return;

    setIsMouseDown(true);
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) {
      setSelectedId(null);
      setMultiIds([]);
    }
    if (readOnly) return;

    if (tool === "ERASER") {
      recordHistory();
      if (!clickedOnEmpty) executeErase(e.target);
      return;
    }

    if (tool === "SELECT") return;
    recordHistory();

    const pos = getRelativePointerPosition(stageRef.current);
    const snapPos = snap
      ? { x: Math.round(pos.x / GRID) * GRID, y: Math.round(pos.y / GRID) * GRID }
      : pos;
    const newId = `shape-${crypto.randomUUID()}`;
    drawingId.current = newId;

    if (tool === "FREEHAND") {
      setShapes((prev) => [
        ...prev,
        {
          id: newId,
          type: "FREEHAND",
          points: [pos.x, pos.y],
          color,
          strokeWidth,
        },
      ]);
    } else if (tool === "RECTANGLE" || tool === "FRAME" || tool === "SECTION") {
      setShapes((prev) => [
        ...prev,
        {
          id: newId,
          type: "RECTANGLE",
          x: snapPos.x,
          y: snapPos.y,
          width: 0,
          height: 0,
          color: tool === "RECTANGLE" ? color : "#bcc3b0",
          strokeWidth: tool === "RECTANGLE" ? strokeWidth : 1,
          ...(tool === "FRAME" || tool === "SECTION"
            ? {
                kind:
                  tool === "FRAME" ? ("frame" as const) : ("section" as const),
                fill: tool === "FRAME" ? "#fffefb" : "#ecebe566",
                name: `${tool === "FRAME" ? "Frame" : "Section"} ${shapes.filter((s) => s.kind === (tool === "FRAME" ? "frame" : "section")).length + 1}`,
              }
            : {}),
        },
      ]);
    } else if (tool === "CIRCLE") {
      setShapes((prev) => [
        ...prev,
        {
          id: newId,
          type: "CIRCLE",
          x: snapPos.x,
          y: snapPos.y,
          radius: 0,
          color,
          strokeWidth,
        },
      ]);
    } else if (tool === "ELLIPSE") {
      setShapes((prev) => [
        ...prev,
        {
          id: newId,
          type: "ELLIPSE",
          x: snapPos.x,
          y: snapPos.y,
          radiusX: 0,
          radiusY: 0,
          color,
          strokeWidth,
        },
      ]);
    } else if (tool === "ARROW" || tool === "LINE" || tool === "CONNECTOR") {
      setShapes((prev) => [
        ...prev,
        {
          id: newId,
          type: tool === "LINE" ? "LINE" : "ARROW",
          points: [snapPos.x, snapPos.y, snapPos.x, snapPos.y],
          color,
          strokeWidth,
          ...(tool === "CONNECTOR" ? { kind: "connector" as const } : {}),
        },
      ]);
    } else if (tool === "STICKY_NOTE" || tool === "TEXT") {
      const shape: Shape = {
        id: newId,
        type: tool,
        x: snapPos.x,
        y: snapPos.y,
        text: "",
        ...(tool === "STICKY_NOTE"
          ? { width: 180, height: 160, color: noteColor, fill: noteColor }
          : { color, fontSize: 18 }),
      };
      drawingId.current = null;
      pendingNew.current = newId;
      setShapes((prev) => [...prev, shape]);
      setIsMouseDown(false);
      setToolState("SELECT");
      setSelectedId(newId);
      setEditing({ id: newId, value: "" });
    }
  };

  const handleMouseMove = (e: any) => {
    const stage = stageRef.current;
    if (stage) {
      const relPos = getRelativePointerPosition(stage);
      const now = e.evt.timeStamp;
      if (
        now - lastCursorSend.current > 30 &&
        stompClientRef.current?.connected &&
        roomId
      ) {
        lastCursorSend.current = now;
        stompClientRef.current.publish({
          destination: `/app/room.${roomId}.cursor`,
          body: JSON.stringify({ x: relPos.x, y: relPos.y }),
        });
      }
    }

    if (!isMouseDown || isSpacePressed || readOnly) return;

    if (tool === "ERASER") {
      executeErase(e.target);
      return;
    }

    if (
      tool === "SELECT" ||
      tool === "HAND" ||
      tool === "STICKY_NOTE" ||
      tool === "TEXT"
    )
      return;

    const raw = getRelativePointerPosition(stage);
    const pos =
      snap && tool !== "FREEHAND"
        ? { x: Math.round(raw.x / GRID) * GRID, y: Math.round(raw.y / GRID) * GRID }
        : raw;
    const lastIndex = shapes.findIndex((s) => s.id === drawingId.current);
    if (lastIndex < 0) return;

    const updated = [...shapes];
    const curr = { ...updated[lastIndex] };

    if (tool === "FREEHAND" && curr.points) {
      curr.points = curr.points.concat([pos.x, pos.y]);
    } else if (
      (tool === "RECTANGLE" || tool === "FRAME" || tool === "SECTION") &&
      curr.x !== undefined &&
      curr.y !== undefined
    ) {
      curr.width = pos.x - curr.x;
      curr.height = pos.y - curr.y;
      setReadout(`${Math.round(Math.abs(curr.width))} × ${Math.round(Math.abs(curr.height))}`);
    } else if (
      tool === "CIRCLE" &&
      curr.x !== undefined &&
      curr.y !== undefined
    ) {
      const dx = pos.x - curr.x;
      const dy = pos.y - curr.y;
      curr.radius = Math.sqrt(dx * dx + dy * dy);
      setReadout(`r ${Math.round(curr.radius)}`);
    } else if (
      tool === "ELLIPSE" &&
      curr.x !== undefined &&
      curr.y !== undefined
    ) {
      curr.radiusX = Math.abs(pos.x - curr.x);
      curr.radiusY = Math.abs(pos.y - curr.y);
    } else if (
      (tool === "ARROW" || tool === "LINE" || tool === "CONNECTOR") &&
      curr.points
    ) {
      curr.points = [curr.points[0], curr.points[1], pos.x, pos.y];
    }

    updated[lastIndex] = curr;
    setShapes(updated);
  };

  const handleMouseUp = () => {
    if (!isMouseDown) return;
    setIsMouseDown(false);
    setReadout("");
    if (
      tool !== "ERASER" &&
      tool !== "HAND" &&
      tool !== "SELECT" &&
      tool !== "STICKY_NOTE" &&
      tool !== "TEXT"
    ) {
      let lastShape = shapes.find((s) => s.id === drawingId.current);
      if (lastShape) {
        // Normalize negative rectangle drags so sizes stay positive.
        if (
          lastShape.type === "RECTANGLE" &&
          ((lastShape.width ?? 0) < 0 || (lastShape.height ?? 0) < 0)
        ) {
          const w = lastShape.width ?? 0,
            h = lastShape.height ?? 0;
          lastShape = {
            ...lastShape,
            x: (lastShape.x ?? 0) + Math.min(0, w),
            y: (lastShape.y ?? 0) + Math.min(0, h),
            width: Math.abs(w),
            height: Math.abs(h),
          };
          const fixed = lastShape;
          setShapes((prev) => prev.map((s) => (s.id === fixed.id ? fixed : s)));
        }
        broadcastEvent(lastShape.type, lastShape);
        if (lastShape.kind === "frame" || lastShape.kind === "section") {
          setToolState("SELECT");
          setSelectedId(lastShape.id);
        }
      }
    }
    drawingId.current = null;
  };

  const handleDragMove = (e: any) => {
    const node = e.target;
    if (node === stageRef.current) return;
    if (snap)
      node.position({
        x: Math.round(node.x() / GRID) * GRID,
        y: Math.round(node.y() / GRID) * GRID,
      });
    setReadout(`Moving · X ${Math.round(node.x())}  Y ${Math.round(node.y())}`);
  };
  const handleDragEnd = (e: any, shape: Shape) => {
    setReadout("");
    setDraggingId(null);
    recordHistory();
    const updatedShape = { ...shape, x: e.target.x(), y: e.target.y() };
    const dx = updatedShape.x - (shape.x || 0),
      dy = updatedShape.y - (shape.y || 0);
    const moved = shapes
      .filter(
        (s) =>
          s.id === shape.id ||
          (shape.groupId && s.groupId === shape.groupId && !s.locked),
      )
      .map((s) =>
        s.id === shape.id
          ? updatedShape
          : { ...s, x: (s.x || 0) + dx, y: (s.y || 0) + dy },
      );
    setShapes((prev) => prev.map((s) => moved.find((m) => m.id === s.id) || s));
    moved.forEach((s) => broadcastEvent("UPDATE", s));
  };

  const handleShapeHover = (e: any) => {
    if (tool === "ERASER" && isMouseDown) {
      executeErase(e.target);
    }
  };

  const withoutOverlay = (run: () => void) => {
    setSelectedId(null);
    setMultiIds([]);
    setHoverId(null);
    setTimeout(() => {
      overlayRef.current?.visible(false);
      try {
        run();
      } finally {
        overlayRef.current?.visible(true);
      }
    }, 50);
  };
  const handleExportPNG = () => {
    const stage = stageRef.current;
    if (!stage) return;
    withoutOverlay(() => {
      try {
        // Xuất hình ảnh với độ phân giải cao (pixelRatio: 2)
        const dataURL = stage.toDataURL({ pixelRatio: 2 });
        const link = document.createElement("a");
        link.download = `canvas-room-${roomId}-${Date.now()}.png`;
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch {
        toast(
          "PNG export failed. Check image permissions and try again.",
          true,
        );
      }
    });
  };

  const handleExportPDF = () => {
    const stage = stageRef.current;
    if (!stage) return;
    withoutOverlay(() => {
      let dataURL = "";
      try {
        dataURL = stage.toDataURL({ pixelRatio: 2 });
      } catch {
        toast("PDF export failed. Check image permissions and try again.", true);
        return;
      }
      import("jspdf")
        .then(({ default: jsPDF }) => {
          const pdf = new jsPDF({
            orientation: "landscape",
            unit: "px",
            format: [stage.width(), stage.height()],
          });
          pdf.addImage(dataURL, "PNG", 0, 0, stage.width(), stage.height());
          pdf.save(`canvas-room-${roomId}-${Date.now()}.pdf`);
        })
        .catch(() =>
          toast(
            "PDF export failed. Check image permissions and try again.",
            true,
          ),
        );
    });
  };

  const selectShape = (id: string, additive = false) => {
    if (editingRef.current && editingRef.current.id !== id) commitEditing();
    const shape = shapes.find((s) => s.id === id);
    setSelectedId(id);
    if (additive)
      setMultiIds((prev) => {
        const base = prev.length ? prev : selectedId ? [selectedId] : [];
        return base.includes(id) && base.length > 1
          ? base.filter((x) => x !== id)
          : Array.from(new Set([...base, id]));
      });
    else
      setMultiIds(
        shape?.groupId
          ? shapes.filter((s) => s.groupId === shape.groupId).map((s) => s.id)
          : [],
      );
  };
  const selectGroup = (groupId: string) => {
    const ids = shapes.filter((s) => s.groupId === groupId).map((s) => s.id);
    setToolState("SELECT");
    setSelectedId(ids[0] || null);
    setMultiIds(ids);
  };
  const selectAll = () => {
    const ids = shapes.filter((s) => !s.hidden && !s.locked).map((s) => s.id);
    setToolState("SELECT");
    setSelectedId(ids[0] || null);
    setMultiIds(ids.length > 1 ? ids : []);
  };
  const changeShape = (patch: Partial<Shape>, target = selected) => {
    if (
      readOnly ||
      !target ||
      (target.locked && !("locked" in patch) && !("hidden" in patch))
    )
      return;
    if (patch.align && target.type === "TEXT" && !target.width) {
      const node = stageRef.current?.findOne("#" + target.id);
      if (node) patch = { ...patch, width: Math.ceil(node.width()) };
    }
    recordHistory();
    const next = { ...target, ...patch };
    setShapes((prev) => prev.map((s) => (s.id === target.id ? next : s)));
    broadcastEvent("UPDATE", next);
  };
  const toggleSelection = (key: "hidden" | "locked") => {
    const targets = shapes.filter((s) => selectionIds.includes(s.id));
    if (!targets.length || readOnly) return;
    const value = !targets.every((s) => s[key]);
    recordHistory();
    const next = shapes.map((s) =>
      selectionIds.includes(s.id) ? { ...s, [key]: value } : s,
    );
    setShapes(next);
    next
      .filter((s) => selectionIds.includes(s.id))
      .forEach((s) => broadcastEvent("UPDATE", s));
    if (key === "hidden" && value) {
      setSelectedId(null);
      setMultiIds([]);
    }
  };
  const applySnapshot = (entry: HistoryEntry) => {
    // Restore only locally affected objects, not unrelated concurrent additions.
    const next = shapes.flatMap((s) => {
      if (!entry.affectedIds.has(s.id)) return [s];
      const previous = entry.shapes.find((p) => p.id === s.id);
      return previous ? [previous] : [];
    });
    entry.shapes.forEach((s, index) => {
      if (
        entry.affectedIds.has(s.id) &&
        !shapes.some((current) => current.id === s.id)
      )
        next.splice(Math.min(index, next.length), 0, s);
    });
    replaying.current = true;
    shapes
      .filter(
        (s) => entry.affectedIds.has(s.id) && !next.some((n) => n.id === s.id),
      )
      .forEach((s) => broadcastEvent("ERASER", { id: s.id }));
    next
      .filter((s) => entry.affectedIds.has(s.id))
      .forEach((s) => broadcastEvent("UPDATE", s));
    replaying.current = false;
    setShapes(structuredClone(next));
    setSelectedId(null);
    setMultiIds([]);
  };
  const undo = () => {
    const previous = past.current.pop();
    if (!previous) return;
    future.current.push({
      shapes: structuredClone(shapes),
      affectedIds: new Set(previous.affectedIds),
    });
    applySnapshot(previous);
    setHistoryCounts({
      undo: past.current.length,
      redo: future.current.length,
    });
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push({
      shapes: structuredClone(shapes),
      affectedIds: new Set(next.affectedIds),
    });
    applySnapshot(next);
    setHistoryCounts({
      undo: past.current.length,
      redo: future.current.length,
    });
  };
  const deleteSelection = () => {
    if (readOnly || !selectionIds.length) return;
    const ids = selectionIds;
    recordHistory();
    shapes
      .filter((s) => ids.includes(s.id) && !s.locked)
      .forEach((s) => broadcastEvent("ERASER", { id: s.id }));
    setShapes((prev) => prev.filter((s) => !ids.includes(s.id) || s.locked));
    setSelectedId(null);
    setMultiIds([]);
  };
  const duplicateSelection = () => {
    if (readOnly || !selectionIds.length) return;
    const ids = selectionIds;
    const groupId = multiIds.length > 1 ? crypto.randomUUID() : undefined;
    const copies = shapes
      .filter((s) => ids.includes(s.id))
      .map((s) => ({
        ...s,
        id: `shape-${crypto.randomUUID()}`,
        x: (s.x || 0) + 24,
        y: (s.y || 0) + 24,
        groupId,
        locked: false,
        name: `${shapeLabel(s)} copy`,
        order: undefined,
      }));
    recordHistory();
    setShapes((prev) => [...prev, ...copies]);
    copies.forEach((s) => broadcastEvent(s.type, s));
    setSelectedId(copies[0]?.id || null);
    setMultiIds(copies.length > 1 ? copies.map((c) => c.id) : []);
  };
  const commitOrder = (asc: Shape[]) => {
    const ordered = asc.map((s, i) => ({ ...s, order: i }));
    setShapes(ordered);
    ordered.forEach((s) => {
      const prev = shapes.find((p) => p.id === s.id);
      if (prev?.order !== s.order) broadcastEvent("UPDATE", s);
    });
  };
  const reorder = (direction: "front" | "forward" | "backward" | "back") => {
    const ids = selectionIds;
    if (!ids.length || readOnly) return;
    let asc = [...orderedShapes];
    if (direction === "front" || direction === "back") {
      const sel = asc.filter((s) => ids.includes(s.id));
      const rest = asc.filter((s) => !ids.includes(s.id));
      asc = direction === "front" ? [...rest, ...sel] : [...sel, ...rest];
    } else {
      const step = direction === "forward" ? 1 : -1;
      const indexes = asc
        .map((s, i) => (ids.includes(s.id) ? i : -1))
        .filter((i) => i >= 0);
      if (step === 1) indexes.reverse();
      for (const i of indexes) {
        const j = i + step;
        if (j < 0 || j >= asc.length || ids.includes(asc[j].id)) continue;
        [asc[i], asc[j]] = [asc[j], asc[i]];
      }
    }
    recordHistory();
    commitOrder(asc);
  };
  const moveLayer = (dragId: string, targetId: string, after: boolean) => {
    if (readOnly) return;
    const asc = [...orderedShapes];
    const from = asc.findIndex((s) => s.id === dragId);
    if (from < 0) return;
    const [item] = asc.splice(from, 1);
    const to = asc.findIndex((s) => s.id === targetId);
    // The layer list is top-first, so "after" (below) means lower z-order.
    asc.splice(after ? to : to + 1, 0, item);
    recordHistory();
    commitOrder(asc);
  };
  const groupSelection = () => {
    if (
      readOnly ||
      multiIds.length < 2 ||
      multiIds.some((id) => shapes.find((s) => s.id === id)?.locked)
    )
      return;
    recordHistory();
    const groupId = crypto.randomUUID();
    const next = shapes.map((s) =>
      multiIds.includes(s.id) ? { ...s, groupId } : s,
    );
    setShapes(next);
    next
      .filter((s) => multiIds.includes(s.id))
      .forEach((s) => broadcastEvent("UPDATE", s));
    toast(`Grouped ${multiIds.length} objects.`, "info");
  };
  const ungroupSelection = () => {
    const groupIds = new Set(
      shapes
        .filter((s) => selectionIds.includes(s.id) && s.groupId)
        .map((s) => s.groupId),
    );
    if (readOnly || !groupIds.size) return;
    recordHistory();
    const next = shapes.map((s) =>
      groupIds.has(s.groupId) ? { ...s, groupId: undefined } : s,
    );
    setShapes(next);
    next
      .filter((s) => groupIds.has(shapes.find((p) => p.id === s.id)?.groupId))
      .forEach((s) => broadcastEvent("UPDATE", s));
    setMultiIds([]);
  };
  const alignSelection = (mode: AlignMode) => {
    if (readOnly) return;
    const stage = stageRef.current;
    const rects = new Map<string, { x: number; y: number; width: number; height: number }>();
    selectionIds.forEach((id) => {
      const node = stage?.findOne("#" + id);
      if (node && !shapes.find((s) => s.id === id)?.locked)
        rects.set(id, node.getClientRect({ relativeTo: stage }));
    });
    if (rects.size < 2) return;
    const list = [...rects.entries()];
    const minX = Math.min(...list.map(([, r]) => r.x));
    const minY = Math.min(...list.map(([, r]) => r.y));
    const maxX = Math.max(...list.map(([, r]) => r.x + r.width));
    const maxY = Math.max(...list.map(([, r]) => r.y + r.height));
    const delta = new Map<string, { dx: number; dy: number }>();
    if (mode === "distribute-h" || mode === "distribute-v") {
      if (rects.size < 3) return;
      const horizontal = mode === "distribute-h";
      const sorted = list.toSorted(([, a], [, b]) =>
        horizontal ? a.x - b.x : a.y - b.y,
      );
      const total = sorted.reduce(
        (n, [, r]) => n + (horizontal ? r.width : r.height),
        0,
      );
      const gap =
        ((horizontal ? maxX - minX : maxY - minY) - total) / (sorted.length - 1);
      let cursor = horizontal ? minX : minY;
      for (const [id, r] of sorted) {
        delta.set(
          id,
          horizontal
            ? { dx: cursor - r.x, dy: 0 }
            : { dx: 0, dy: cursor - r.y },
        );
        cursor += (horizontal ? r.width : r.height) + gap;
      }
    } else
      for (const [id, r] of list)
        delta.set(id, {
          dx:
            mode === "left"
              ? minX - r.x
              : mode === "center"
                ? (minX + maxX) / 2 - (r.x + r.width / 2)
                : mode === "right"
                  ? maxX - (r.x + r.width)
                  : 0,
          dy:
            mode === "top"
              ? minY - r.y
              : mode === "middle"
                ? (minY + maxY) / 2 - (r.y + r.height / 2)
                : mode === "bottom"
                  ? maxY - (r.y + r.height)
                  : 0,
        });
    recordHistory();
    const next = shapes.map((s) => {
      const d = delta.get(s.id);
      return d ? { ...s, x: (s.x || 0) + d.dx, y: (s.y || 0) + d.dy } : s;
    });
    setShapes(next);
    next
      .filter((s) => delta.has(s.id))
      .forEach((s) => broadcastEvent("UPDATE", s));
  };
  const nudge = (dx: number, dy: number) => {
    const ids = selectionIds.filter(
      (id) => !shapes.find((s) => s.id === id)?.locked,
    );
    if (!ids.length || readOnly) return;
    recordHistory();
    const next = shapes.map((s) =>
      ids.includes(s.id) ? { ...s, x: (s.x || 0) + dx, y: (s.y || 0) + dy } : s,
    );
    setShapes(next);
    next.filter((s) => ids.includes(s.id)).forEach((s) => broadcastEvent("UPDATE", s));
  };
  const insertImage = (url: string, name: string) => {
    recordHistory();
    const shape: Shape = {
      id: `shape-${crypto.randomUUID()}`,
      type: "IMAGE",
      x: (size.width / 2 - 120 - stagePos.x) / stageScale,
      y: (size.height / 2 - 120 - stagePos.y) / stageScale,
      width: 240,
      height: 240,
      imageUrl: url,
      name,
      fit: "cover",
      color: "transparent",
    };
    setShapes((prev) => [...prev, shape]);
    broadcastEvent("IMAGE", shape);
    setLibraryOpen(false);
    setToolState("SELECT");
    setSelectedId(shape.id);
    toast(`${name} added to the canvas.`);
  };
  const transformShape = (e: any) => {
    setReadout("");
    const node = e.target,
      shape = shapes.find((s) => s.id === node.id());
    if (!shape || shape.locked || readOnly) return;
    recordHistory();
    const sx = node.scaleX(),
      sy = node.scaleY();
    const updated: Shape = {
      ...shape,
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
      ...(shape.width !== undefined
        ? { width: Math.abs(shape.width * sx) }
        : {}),
      ...(shape.height !== undefined
        ? { height: Math.abs(shape.height * sy) }
        : {}),
      ...(shape.radius !== undefined
        ? { radius: Math.abs(shape.radius * sx) }
        : {}),
      ...(shape.radiusX !== undefined
        ? {
            radiusX: Math.abs(shape.radiusX * sx),
            radiusY: Math.abs((shape.radiusY || 0) * sy),
          }
        : {}),
      ...(shape.points
        ? { points: shape.points.map((n, i) => n * (i % 2 === 0 ? sx : sy)) }
        : {}),
      ...(shape.type === "TEXT"
        ? { fontSize: (shape.fontSize || 18) * Math.abs(sx) }
        : {}),
    };
    node.scaleX(1);
    node.scaleY(1);
    setShapes((prev) => prev.map((s) => (s.id === shape.id ? updated : s)));
    broadcastEvent("UPDATE", updated);
  };
  const appearance = (s: Shape) => ({
    rotation: s.rotation || 0,
    opacity: s.opacity ?? 1,
  });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        view !== "canvas" ||
        !isActive ||
        (e.target as HTMLElement)?.closest(
          'input,textarea,select,[contenteditable], [role="dialog"]',
        )
      )
        return;
      const mod = e.metaKey || e.ctrlKey;
      // Navigation shortcuts — available in read-only mode too.
      if (e.shiftKey && (e.key === "!" || e.code === "Digit1")) {
        e.preventDefault();
        fitToScreen();
        return;
      }
      if (e.shiftKey && (e.key === ")" || e.code === "Digit0")) {
        e.preventDefault();
        resetView();
        return;
      }
      if (mod && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        zoomTo(stageScale * 1.2);
        return;
      }
      if (mod && e.key === "-") {
        e.preventDefault();
        zoomTo(stageScale / 1.2);
        return;
      }
      if (e.shiftKey && !mod && e.key.toLowerCase() === "g") {
        setGrid(!grid);
        return;
      }
      if (e.key === "Escape") {
        setSelectedId(null);
        setMultiIds([]);
        setToolState("SELECT");
        return;
      }
      if (readOnly) {
        if (!mod && e.key.toLowerCase() === "v") setToolState("SELECT");
        if (!mod && e.key.toLowerCase() === "h") setToolState("HAND");
        return;
      }
      if (e.shiftKey && !mod && e.key.toLowerCase() === "s") {
        setSnap(!snap);
        return;
      }
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelection();
      } else if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selectAll();
      } else if (mod && e.key.toLowerCase() === "g") {
        e.preventDefault();
        if (e.shiftKey) ungroupSelection();
        else groupSelection();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelection();
      } else if (e.key === "]" || e.key === "}") {
        reorder(e.shiftKey || e.key === "}" ? "front" : "forward");
      } else if (e.key === "[" || e.key === "{") {
        reorder(e.shiftKey || e.key === "{" ? "back" : "backward");
      } else if (e.key.startsWith("Arrow") && selectionIds.length) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        nudge(
          e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0,
          e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0,
        );
      } else if (e.key === "Enter" && selected) {
        e.preventDefault();
        startEditing(selected);
      } else if (!mod && !e.shiftKey) {
        const keys: Record<string, Tool> = {
          v: "SELECT",
          h: "HAND",
          p: "FREEHAND",
          r: "RECTANGLE",
          o: "CIRCLE",
          t: "TEXT",
          e: "ERASER",
          l: "LINE",
          a: "ARROW",
          s: "STICKY_NOTE",
          f: "FRAME",
        };
        const next = keys[e.key.toLowerCase()];
        if (next) {
          if (["RECTANGLE", "CIRCLE", "LINE", "ARROW"].includes(next))
            setShapeTool(next);
          setTool(next);
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  // Shared Konva props for every object.
  const common = (s: Shape) => ({
    id: s.id,
    draggable: tool === "SELECT" && !isSpacePressed && !s.locked && !readOnly,
    onDragStart: () => {
      setHoverId(null);
      setDraggingId(s.id);
    },
    onDragMove: handleDragMove,
    onDragEnd: (e: any) => handleDragEnd(e, s),
    onClick: (e: any) => {
      if (e.evt.button === 2) return;
      if (tool === "SELECT" || tool === "HAND") selectShape(s.id, e.evt.shiftKey);
    },
    onTap: () => selectShape(s.id),
    onDblClick: () => startEditing(s),
    onDblTap: () => startEditing(s),
    onMouseEnter: (e: any) => {
      handleShapeHover(e);
      if (tool === "SELECT" && !isMouseDown) setHoverId(s.id);
    },
    onMouseLeave: () => setHoverId((h) => (h === s.id ? null : h)),
  });

  // Derived interaction state
  const syncState: SyncState = readOnly
    ? "readonly"
    : demo
      ? "local"
      : conn === "failed"
        ? "failed"
        : conn === "connecting"
          ? "connecting"
          : conn === "reconnecting"
            ? queued
              ? "offline"
              : "reconnecting"
            : saveState === "saving"
              ? "saving"
              : saveState === "saved"
                ? "saved"
                : "connected";
  const syncLabel =
    syncState === "offline"
      ? `Offline · ${queued} queued`
      : syncState === "saved"
        ? "Synced"
        : syncState === "local"
          ? "Saved locally"
          : undefined;
  const presence = demo
    ? [{ name: "Sarah Chen", color: "#2455d6" }]
    : Object.values(cursors).map((c) => ({
        name:
          members.find((m) => m.username === c.username)?.fullName || c.username,
        color: c.color,
      }));
  const hoverRect = (() => {
    if (
      !hoverId ||
      tool !== "SELECT" ||
      selectionIds.includes(hoverId) ||
      draggingId ||
      !stageRef.current
    )
      return null;
    const node = stageRef.current.findOne("#" + hoverId);
    return node ? node.getClientRect({ relativeTo: stageRef.current }) : null;
  })();
  const editingShape = editing && shapes.find((s) => s.id === editing.id);
  const gridSize = GRID * stageScale * (GRID * stageScale < 9 ? 4 : 1);
  const menuTarget = menu?.target ? shapes.find((s) => s.id === menu.target) : undefined;
  const runMenu = (fn: () => void) => () => {
    setMenu(null);
    fn();
  };
  const canGroup =
    multiIds.length > 1 &&
    !multiIds.every(
      (id) =>
        shapes.find((s) => s.id === id)?.groupId &&
        shapes.find((s) => s.id === id)?.groupId ===
          shapes.find((s) => s.id === multiIds[0])?.groupId,
    );
  const canUngroup = shapes.some(
    (s) => selectionIds.includes(s.id) && s.groupId,
  );
  const addStickyAt = (point: { x: number; y: number }) => {
    if (readOnly) return;
    recordHistory();
    const id = `shape-${crypto.randomUUID()}`;
    pendingNew.current = id;
    setShapes((prev) => [
      ...prev,
      {
        id,
        type: "STICKY_NOTE",
        x: point.x,
        y: point.y,
        width: 180,
        height: 160,
        text: "",
        color: noteColor,
        fill: noteColor,
      },
    ]);
    setToolState("SELECT");
    setSelectedId(id);
    setEditing({ id, value: "" });
  };
  const handleContextMenu = (e: any) => {
    e.evt.preventDefault();
    if (editingRef.current) commitEditing();
    const id = findShapeId(e.target);
    if (id && !selectionIds.includes(id)) {
      setToolState("SELECT");
      selectShape(id);
    }
    if (!id) {
      setSelectedId(null);
      setMultiIds([]);
    }
    setMenu({
      x: e.evt.clientX,
      y: e.evt.clientY,
      target: id,
      point: getRelativePointerPosition(stageRef.current),
    });
  };
  const toolName = tool.toLowerCase().replace("_", " ");
  const statusText =
    multiIds.length > 1
      ? `${multiIds.length} objects selected`
      : selected
        ? `${shapeLabel(selected)}${selected.locked ? " · locked" : ""}`
        : `${shapes.length} objects · ${readOnly ? "view only" : toolName}`;
  const editorStyle = (() => {
    if (!editingShape) return null;
    const sticky = editingShape.type === "STICKY_NOTE";
    const pad = sticky ? 12 : 0;
    const fontStyle = editingShape.fontStyle || "normal";
    return {
      sticky,
      style: {
        left: stagePos.x + ((editingShape.x || 0) + pad) * stageScale,
        top: stagePos.y + ((editingShape.y || 0) + pad) * stageScale,
        fontSize: (editingShape.fontSize || (sticky ? 14 : 18)) * stageScale,
        fontFamily: editingShape.fontFamily || PLEX,
        fontWeight: fontStyle.includes("bold") ? 700 : 400,
        fontStyle: fontStyle.includes("italic") ? "italic" : "normal",
        color: sticky ? editingShape.textColor || "#4b543e" : editingShape.color,
        textAlign: editingShape.align || "left",
        transform: `rotate(${editingShape.rotation || 0}deg)`,
        width: sticky
          ? ((editingShape.width || 160) - 24) * stageScale
          : editingShape.width
            ? editingShape.width * stageScale
            : undefined,
        height: sticky
          ? ((editingShape.height || 160) - 24) * stageScale
          : undefined,
      } as React.CSSProperties,
    };
  })();
  return (
    <div className="canvas-engine">
      {view === "chat" && (
        <ChatPanel
          messages={messages}
          setMessages={setMessages}
          connected={connected}
          connection={demo ? "connected" : conn}
          onSend={handleSendMessage}
        />
      )}
      <div
        className={
          view === "canvas"
            ? `canvas-editor ${readOnly ? "is-readonly" : ""}`
            : "room-engine-hidden"
        }
      >
        <div className="canvas-top-toolbar">
          <div className="canvas-toolbar-group">
            <IconButton
              icon="panel"
              label="Toggle layers"
              aria-pressed={showLayers}
              onClick={() => {
                setShowLayers(!showLayers);
                writeCanvasPrefs({ layers: !showLayers });
              }}
            />
            <span className="toolbar-divider" />
            {!readOnly && (
              <>
                <IconButton
                  icon="undo"
                  label="Undo (Ctrl/⌘ Z)"
                  disabled={!historyCounts.undo}
                  onClick={undo}
                />
                <IconButton
                  icon="redo"
                  label="Redo (Ctrl/⌘ Shift Z)"
                  disabled={!historyCounts.redo}
                  onClick={redo}
                />
                <span className="toolbar-divider" />
              </>
            )}
            <StatusIndicator state={syncState} label={syncLabel} />
          </div>
          <div className="canvas-toolbar-group">
            {presence.length > 0 && (
              <>
                <Presence
                  people={presence}
                  label={demo ? "Sarah · sample" : `${presence.length} here`}
                  sample={demo}
                />
                <span className="toolbar-divider" />
              </>
            )}
            <Button variant="ghost" onClick={handleExportPNG} icon="download">
              PNG
            </Button>
            <Button variant="ghost" onClick={handleExportPDF}>
              PDF
            </Button>
            {!demo && !readOnly && (
              <Button
                variant="ghost"
                icon="refresh"
                disabled={!connected}
                title="Resend every object to the server"
                onClick={() => {
                  shapes.forEach((s) => broadcastEvent("UPDATE", s));
                  toast(
                    "Canvas objects sent. Server receipt does not guarantee database persistence.",
                    "info",
                  );
                }}
              >
                Sync
              </Button>
            )}
            <Button icon="users" onClick={() => setShareOpen(true)}>
              Share
            </Button>
            <IconButton
              icon="panel-right"
              label="Toggle properties panel"
              aria-pressed={showInspector}
              onClick={() => setShowInspector(!showInspector)}
            />
          </div>
        </div>
        {readOnly && (
          <div className="canvas-banner readonly" role="status">
            <Icon name="eye" size={14} />
            <span>
              You’re viewing this canvas. Editing requires the Member role or
              higher.
            </span>
            <RoleBadge role={role} />
          </div>
        )}
        {!demo && conn === "reconnecting" && (
          <div className="canvas-banner warning" role="status">
            <Spinner size={12} />
            <span>
              Connection lost. Reconnecting…{" "}
              {queued
                ? `${queued} change${queued === 1 ? "" : "s"} will sync when the connection returns.`
                : "New changes are queued in this tab."}
            </span>
          </div>
        )}
        {!demo && conn === "failed" && (
          <div className="canvas-banner error" role="alert">
            <Icon name="alert" size={14} />
            <span>
              Changes can’t be saved. The room connection was rejected — your
              edits stay in this tab.
            </span>
            <Button variant="ghost" icon="refresh" onClick={retryConnection}>
              Retry
            </Button>
          </div>
        )}
        {canvasError && conn !== "failed" && (
          <div className="canvas-error">
            <Notice tone="error">
              {canvasError}{" "}
              <Button variant="ghost" onClick={() => setCanvasError("")}>
                Dismiss
              </Button>
            </Notice>
          </div>
        )}
        <div className="canvas-body">
          {showLayers && (
            <CanvasLayers
              shapes={orderedShapes}
              selectedIds={selectionIds}
              readOnly={readOnly}
              onSelect={(id, additive) => {
                setToolState("SELECT");
                selectShape(id, additive);
              }}
              onSelectGroup={selectGroup}
              onToggle={(s, key) => {
                recordHistory();
                const next = { ...s, [key]: !s[key] };
                setShapes((prev) => prev.map((p) => (p.id === s.id ? next : p)));
                broadcastEvent("UPDATE", next);
              }}
              onMove={moveLayer}
              onGroup={groupSelection}
              onUngroup={ungroupSelection}
              canGroup={canGroup}
              canUngroup={canUngroup}
              onClose={() => {
                setShowLayers(false);
                writeCanvasPrefs({ layers: false });
              }}
            />
          )}
          <div className="canvas-center">
            <CanvasToolRail
              tool={tool}
              setTool={setTool}
              shapeTool={shapeTool}
              setShapeTool={setShapeTool}
              readOnly={readOnly}
              onUpload={() => fileInputRef.current?.click()}
              onLibrary={() => setLibraryOpen(true)}
            />
            <Input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              aria-label="Upload image to canvas"
            />
            {!readOnly && (
              <CanvasToolOptions
                tool={tool}
                color={color}
                setColor={setColor}
                strokeWidth={strokeWidth}
                setStrokeWidth={setStrokeWidth}
                noteColor={noteColor}
                setNoteColor={setNoteColor}
              />
            )}
            {/* Stage Container */}
            <div
              ref={containerRef}
              className={`canvas-stage-container ${grid ? "with-grid" : ""} ${isSpacePressed || tool === "HAND" ? "is-panning" : ""}`}
              style={
                grid
                  ? {
                      backgroundSize: `${gridSize}px ${gridSize}px`,
                      backgroundPosition: `${stagePos.x}px ${stagePos.y}px`,
                    }
                  : undefined
              }
            >
              <Stage
                ref={stageRef}
                width={size.width}
                height={size.height}
                x={stagePos.x}
                y={stagePos.y}
                scaleX={stageScale}
                scaleY={stageScale}
                draggable={isSpacePressed || tool === "HAND"}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onTouchStart={handleMouseDown}
                onTouchMove={handleMouseMove}
                onTouchEnd={handleMouseUp}
                onContextMenu={handleContextMenu}
                onMouseLeave={() => setHoverId(null)}
                onDragMove={(e) => {
                  if (e.target === stageRef.current)
                    setStagePos({ x: e.target.x(), y: e.target.y() });
                }}
                onDragEnd={(e) => {
                  if (e.target === stageRef.current) {
                    setStagePos({ x: e.target.x(), y: e.target.y() });
                  }
                }}
                style={{
                  cursor:
                    isSpacePressed || tool === "HAND"
                      ? "grab"
                      : tool === "SELECT"
                        ? hoverId && !readOnly
                          ? "move"
                          : "default"
                        : tool === "TEXT"
                          ? "text"
                          : "crosshair",
                }}
              >
                <Layer onTransformEnd={transformShape}>
                  {/* Shapes */}
                  {orderedShapes
                    .filter((s) => !s.hidden)
                    .map((s) => {
                      if (s.type === "FREEHAND" && s.points) {
                        return (
                          <Line
                            key={s.id}
                            {...common(s)}
                            x={s.x}
                            y={s.y}
                            {...appearance(s)}
                            points={s.points}
                            stroke={s.color}
                            strokeWidth={s.strokeWidth ?? 3}
                            hitStrokeWidth={Math.max(12, s.strokeWidth ?? 3)}
                            tension={0.5}
                            lineCap="round"
                            lineJoin="round"
                          />
                        );
                      } else if (s.type === "RECTANGLE") {
                        return (
                          <React.Fragment key={s.id}>
                            <Rect
                              {...common(s)}
                              {...appearance(s)}
                              dash={s.kind === "section" ? [8, 5] : undefined}
                              x={s.x}
                              y={s.y}
                              width={s.width}
                              height={s.height}
                              stroke={s.color}
                              strokeWidth={s.strokeWidth ?? 2}
                              fill={s.fill || `${s.color}22`}
                              cornerRadius={s.kind === "section" ? 6 : 0}
                            />
                            {s.kind && draggingId !== s.id && (
                              <Text
                                x={s.x}
                                y={(s.y || 0) - 18 / stageScale}
                                text={shapeLabel(s)}
                                fontSize={11 / stageScale}
                                fontFamily="IBM Plex Mono, monospace"
                                fill={
                                  selectionIds.includes(s.id)
                                    ? "#2455d6"
                                    : "#74766f"
                                }
                                listening={false}
                              />
                            )}
                          </React.Fragment>
                        );
                      } else if (s.type === "CIRCLE") {
                        return (
                          <Circle
                            key={s.id}
                            {...common(s)}
                            {...appearance(s)}
                            x={s.x}
                            y={s.y}
                            radius={s.radius}
                            stroke={s.color}
                            strokeWidth={s.strokeWidth ?? 2}
                            fill={s.fill || `${s.color}22`}
                          />
                        );
                      } else if (s.type === "ELLIPSE") {
                        return (
                          <Ellipse
                            key={s.id}
                            {...common(s)}
                            x={s.x}
                            y={s.y}
                            {...appearance(s)}
                            radiusX={s.radiusX || 0}
                            radiusY={s.radiusY || 0}
                            stroke={s.color}
                            strokeWidth={s.strokeWidth ?? 2}
                            fill={s.fill || `${s.color}22`}
                          />
                        );
                      } else if (s.type === "LINE" && s.points) {
                        return (
                          <Line
                            key={s.id}
                            {...common(s)}
                            x={s.x}
                            y={s.y}
                            {...appearance(s)}
                            points={s.points}
                            stroke={s.color}
                            strokeWidth={s.strokeWidth ?? 2}
                            hitStrokeWidth={Math.max(12, s.strokeWidth ?? 2)}
                            lineCap="round"
                          />
                        );
                      } else if (s.type === "ARROW" && s.points) {
                        return (
                          <Arrow
                            key={s.id}
                            {...common(s)}
                            x={s.x}
                            y={s.y}
                            {...appearance(s)}
                            points={s.points}
                            stroke={s.color}
                            fill={s.color}
                            strokeWidth={s.strokeWidth ?? 3}
                            hitStrokeWidth={Math.max(12, s.strokeWidth ?? 3)}
                            dash={s.kind === "connector" ? [10, 6] : undefined}
                            pointerLength={10}
                            pointerWidth={10}
                          />
                        );
                      } else if (s.type === "STICKY_NOTE") {
                        const w = s.width || 160,
                          h = s.height || 160;
                        return (
                          <Group
                            key={s.id}
                            {...common(s)}
                            {...appearance(s)}
                            x={s.x}
                            y={s.y}
                          >
                            <Rect
                              width={w}
                              height={h}
                              fill={s.fill || s.color}
                              cornerRadius={2}
                              stroke={s.color}
                              strokeWidth={s.strokeWidth ?? 1}
                              shadowColor="#20221f"
                              shadowOpacity={0.07}
                              shadowBlur={8}
                              shadowOffsetY={3}
                            />
                            <Text
                              text={s.text}
                              x={12}
                              y={12}
                              width={w - 24}
                              height={h - 24}
                              fontSize={s.fontSize || 14}
                              fontFamily={s.fontFamily || PLEX}
                              fontStyle={s.fontStyle || "normal"}
                              align={s.align || "left"}
                              fill={s.textColor || "#4b543e"}
                              opacity={editing?.id === s.id ? 0 : 1}
                              lineHeight={1.25}
                              wrap="word"
                              ellipsis
                            />
                            {!s.text && editing?.id !== s.id && (
                              <Text
                                text={readOnly ? "Empty note" : "Double-click to write"}
                                x={12}
                                y={12}
                                fontSize={12}
                                fontFamily={PLEX}
                                fill="#9a9f8f"
                                listening={false}
                              />
                            )}
                          </Group>
                        );
                      } else if (s.type === "TEXT") {
                        return (
                          <Text
                            key={s.id}
                            {...common(s)}
                            {...appearance(s)}
                            opacity={editing?.id === s.id ? 0 : (s.opacity ?? 1)}
                            x={s.x}
                            y={s.y}
                            text={s.text || " "}
                            width={s.width}
                            align={s.align || "left"}
                            fontSize={s.fontSize || 18}
                            fontFamily={s.fontFamily || PLEX}
                            fontStyle={s.fontStyle || "normal"}
                            fill={s.color}
                          />
                        );
                      } else if (s.type === "IMAGE") {
                        return <URLImage key={s.id} shape={s} common={common(s)} />;
                      }
                      return null;
                    })}

                  {tool === "SELECT" &&
                    selectedId &&
                    !selected?.locked &&
                    !readOnly &&
                    !editing &&
                    !isSpacePressed && (
                      <Transformer
                        ref={transformerRef}
                        flipEnabled={false}
                        anchorSize={8}
                        anchorCornerRadius={2}
                        borderStroke="#2455d6"
                        anchorStroke="#2455d6"
                        rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
                        onTransform={() => {
                          const tr = transformerRef.current;
                          if (tr)
                            setReadout(
                              `Resizing · ${Math.round(tr.width() / stageScale)} × ${Math.round(tr.height() / stageScale)}`,
                            );
                        }}
                        boundBoxFunc={(oldBox, newBox) =>
                          Math.abs(newBox.width) < 5 ||
                          Math.abs(newBox.height) < 5
                            ? oldBox
                            : newBox
                        }
                      />
                    )}
                </Layer>
                <Layer ref={overlayRef} listening={false}>
                  {hoverRect && (
                    <Rect
                      x={hoverRect.x}
                      y={hoverRect.y}
                      width={hoverRect.width}
                      height={hoverRect.height}
                      stroke="#2455d6"
                      strokeWidth={1.5 / stageScale}
                      opacity={0.7}
                    />
                  )}
                  {readOnly &&
                    selectionIds.map((id) => {
                      const node = stageRef.current?.findOne("#" + id);
                      if (!node) return null;
                      const r = node.getClientRect({ relativeTo: stageRef.current });
                      return (
                        <Rect
                          key={id}
                          {...r}
                          stroke="#2455d6"
                          strokeWidth={1.5 / stageScale}
                          dash={[4 / stageScale, 3 / stageScale]}
                        />
                      );
                    })}
                  {demo && (
                    <Group ref={sampleCursorRef} x={520} y={240}>
                      <Arrow
                        points={[0, 0, 0, 14, 4, 10, 10, 16, 13, 14, 7, 8, 14, 8]}
                        fill="#2455d6"
                        stroke="#ffffff"
                        strokeWidth={1}
                      />
                      <Rect
                        x={12}
                        y={12}
                        width={98}
                        height={20}
                        fill="#2455d6"
                        cornerRadius={4}
                      />
                      <Text
                        x={18}
                        y={16}
                        text="Sarah · sample"
                        fontSize={10.5}
                        fill="#ffffff"
                        fontStyle="bold"
                      />
                    </Group>
                  )}
                  {/* Live Cursors */}
                  {Object.values(cursors).map((c) => (
                    <Group key={c.username} x={c.x} y={c.y}>
                      <Arrow
                        points={[
                          0, 0, 0, 14, 4, 10, 10, 16, 13, 14, 7, 8, 14, 8,
                        ]}
                        fill={c.color}
                        stroke="#ffffff"
                        strokeWidth={1}
                      />
                      <Rect
                        x={12}
                        y={12}
                        width={c.username.length * 8 + 12}
                        height={20}
                        fill={c.color}
                        cornerRadius={4}
                      />
                      <Text
                        x={18}
                        y={16}
                        text={c.username}
                        fontSize={11}
                        fill="#ffffff"
                        fontStyle="bold"
                      />
                    </Group>
                  ))}
                </Layer>
              </Stage>
              {editing && editorStyle && (
                <textarea
                  className={`canvas-text-editor ${editorStyle.sticky ? "sticky" : ""}`}
                  style={editorStyle.style}
                  autoFocus
                  value={editing.value}
                  aria-label={editorStyle.sticky ? "Sticky note text" : "Text"}
                  placeholder={editorStyle.sticky ? "Write a note…" : "Type something…"}
                  onChange={(e) =>
                    setEditing((prev) =>
                      prev ? { ...prev, value: e.target.value } : prev,
                    )
                  }
                  onBlur={() => commitEditing()}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Escape") {
                      e.preventDefault();
                      commitEditing(true);
                    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      commitEditing();
                    }
                  }}
                />
              )}
              {historyLoading && (
                <div className="canvas-state-overlay" role="status">
                  <Spinner size={18} />
                  <strong>Loading canvas…</strong>
                  <span>Restoring objects saved for this room.</span>
                </div>
              )}
              {!historyLoading && shapes.length === 0 && (
                <div className="canvas-empty-state">
                  <span className="empty-icon">
                    <Icon name="frame" size={24} />
                  </span>
                  <strong>
                    {readOnly
                      ? "Nothing on this canvas yet."
                      : "A blank canvas. Start anywhere."}
                  </strong>
                  <p>
                    {readOnly
                      ? "When collaborators add content, it will appear here."
                      : "Pick a tool, drop in an image, or start with a note."}
                  </p>
                  {!readOnly && (
                    <div className="canvas-empty-actions">
                      <Button icon="sticky" onClick={() => setTool("STICKY_NOTE")}>
                        Sticky note
                      </Button>
                      <Button icon="rect" onClick={() => setTool("RECTANGLE")}>
                        Shape
                      </Button>
                      <Button icon="pen" onClick={() => setTool("FREEHAND")}>
                        Draw
                      </Button>
                      <Button icon="image" onClick={() => setLibraryOpen(true)}>
                        Image
                      </Button>
                    </div>
                  )}
                  {!readOnly && (
                    <span className="canvas-empty-template">
                      <Icon name="template" size={13} />
                      Start from a template
                      <PlannedBadge />
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="canvas-bottom-bar">
              <span className="canvas-status-text">
                <Icon name="cursor" size={12} />
                {statusText}
              </span>
              <span className="canvas-readout" aria-live="polite">
                <span ref={readoutRef} />
              </span>
              <div>
                <IconButton
                  icon="grid"
                  label="Toggle grid (Shift G)"
                  aria-pressed={grid}
                  onClick={() => setGrid(!grid)}
                />
                {!readOnly && (
                  <IconButton
                    icon="magnet"
                    label="Snap to grid (Shift S)"
                    aria-pressed={snap}
                    className={snap ? "active" : ""}
                    onClick={() => setSnap(!snap)}
                  />
                )}
                <span className="toolbar-divider" />
                <IconButton
                  icon="minus"
                  label="Zoom out"
                  onClick={() => zoomTo(stageScale / 1.2)}
                />
                <Dropdown
                  className="zoom-menu"
                  ariaLabel="Zoom options"
                  label={<span>{Math.round(stageScale * 100)}%</span>}
                >
                  <MenuItem icon="fit" shortcut="⇧1" onClick={() => fitToScreen()}>
                    Fit to screen
                  </MenuItem>
                  <MenuItem
                    icon="cursor"
                    disabled={!selectionIds.length}
                    onClick={() => fitToScreen(selectionIds)}
                  >
                    Zoom to selection
                  </MenuItem>
                  <MenuDivider />
                  {[0.5, 1, 2].map((z) => (
                    <MenuItem key={z} onClick={() => zoomTo(z)}>
                      {z * 100}%
                    </MenuItem>
                  ))}
                  <MenuDivider />
                  <MenuItem icon="refresh" shortcut="⇧0" onClick={resetView}>
                    Reset view
                  </MenuItem>
                </Dropdown>
                <IconButton
                  icon="plus"
                  label="Zoom in"
                  onClick={() => zoomTo(stageScale * 1.2)}
                />
                <IconButton
                  icon="fit"
                  label="Fit to screen (Shift 1)"
                  onClick={() => fitToScreen()}
                />
              </div>
            </div>
          </div>
          {showInspector && (
            <CanvasInspector
              selected={multiIds.length > 1 ? undefined : selected}
              multiCount={multiIds.length}
              readOnly={readOnly}
              onChange={(patch) => changeShape(patch)}
              onAlign={alignSelection}
              onReorder={reorder}
              onDuplicate={duplicateSelection}
              onDelete={deleteSelection}
              onGroup={groupSelection}
              onUngroup={ungroupSelection}
              canGroup={canGroup}
              canUngroup={canUngroup}
              color={color}
              setColor={setColor}
              strokeWidth={strokeWidth}
              setStrokeWidth={setStrokeWidth}
              noteColor={noteColor}
              setNoteColor={setNoteColor}
              grid={grid}
              setGrid={setGrid}
              snap={snap}
              setSnap={setSnap}
              shapesCount={shapes.length}
              onClear={() => setClearOpen(true)}
              demo={demo}
              onClose={() => setShowInspector(false)}
            />
          )}
        </div>
      </div>
      {clearOpen && (
        <Confirm
          title="Clear this canvas?"
          description="Every object will be removed. In live mode each removal is sent through the existing drawing channel. You can undo this in the current session."
          confirmLabel="Clear canvas"
          onClose={() => setClearOpen(false)}
          onConfirm={() => {
            recordHistory();
            shapes.forEach((s) => broadcastEvent("ERASER", { id: s.id }));
            setShapes([]);
            setSelectedId(null);
            setMultiIds([]);
            setClearOpen(false);
          }}
        />
      )}
      {libraryOpen && (
        <Modal
          title="Insert from media library"
          onClose={() => setLibraryOpen(false)}
          wide
        >
          <div className="canvas-library">
            {assets
              .filter(
                (a) =>
                  a.workspaceId === workspace?.id &&
                  a.type.startsWith("image/"),
              )
              .map((a) => (
                <Button
                  key={a.id}
                  variant="ghost"
                  onClick={() => insertImage(a.url, a.name)}
                >
                  <img src={a.url} alt={a.name} />
                  <span>{a.name}</span>
                </Button>
              ))}
          </div>
          {!assets.some(
            (a) =>
              a.workspaceId === workspace?.id && a.type.startsWith("image/"),
          ) && (
            <p className="muted">
              No images in this workspace session. Upload one with the image
              tool.
            </p>
          )}
        </Modal>
      )}
      {shareOpen && (
        <Modal title="Share this room" onClose={() => setShareOpen(false)}>
          <div className="form-stack">
            <Notice>
              {demo
                ? "This is a demo room. Sharing this URL does not synchronize local changes."
                : "Share this link with an existing workspace member. This does not grant access or create an invitation."}
            </Notice>
            <Field label="Room link">
              <Input readOnly value={window.location.href} />
            </Field>
            <Button
              variant="primary"
              icon="copy"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  toast("Room link copied.");
                } catch {
                  toast("Select and copy the room link above.", "info");
                }
              }}
            >
              Copy link
            </Button>
          </div>
        </Modal>
      )}
      {menu &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="context-menu canvas-context-menu"
            style={{
              left: Math.min(menu.x, window.innerWidth - 250),
              top: Math.max(
                8,
                Math.min(menu.y, window.innerHeight - (menuTarget ? 440 : 300)),
              ),
            }}
          >
            {menuTarget ? (
              <>
                <span className="menu-label">
                  {selectionIds.length > 1
                    ? `${selectionIds.length} OBJECTS`
                    : shapeLabel(menuTarget).toUpperCase()}
                </span>
                {!readOnly &&
                  (menuTarget.type === "TEXT" ||
                    menuTarget.type === "STICKY_NOTE") &&
                  selectionIds.length <= 1 && (
                    <MenuItem
                      icon="edit"
                      shortcut="↵"
                      onClick={runMenu(() => startEditing(menuTarget))}
                    >
                      Edit text
                    </MenuItem>
                  )}
                {!readOnly && (
                  <MenuItem
                    icon="copy"
                    shortcut="⌘D"
                    onClick={runMenu(duplicateSelection)}
                  >
                    Duplicate
                  </MenuItem>
                )}
                <MenuItem
                  icon="fit"
                  onClick={runMenu(() => fitToScreen(selectionIds))}
                >
                  Zoom to selection
                </MenuItem>
                {!readOnly && (
                  <>
                    <MenuDivider />
                    <MenuItem
                      icon="bring-front"
                      shortcut="⇧]"
                      onClick={runMenu(() => reorder("front"))}
                    >
                      Bring to front
                    </MenuItem>
                    <MenuItem
                      icon="arrow-up"
                      shortcut="]"
                      onClick={runMenu(() => reorder("forward"))}
                    >
                      Bring forward
                    </MenuItem>
                    <MenuItem
                      icon="arrow-down"
                      shortcut="["
                      onClick={runMenu(() => reorder("backward"))}
                    >
                      Send backward
                    </MenuItem>
                    <MenuItem
                      icon="send-back"
                      shortcut="⇧["
                      onClick={runMenu(() => reorder("back"))}
                    >
                      Send to back
                    </MenuItem>
                    <MenuDivider />
                    {canGroup && (
                      <MenuItem
                        icon="group"
                        shortcut="⌘G"
                        onClick={runMenu(groupSelection)}
                      >
                        Group selection
                      </MenuItem>
                    )}
                    {canUngroup && (
                      <MenuItem
                        icon="ungroup"
                        shortcut="⇧⌘G"
                        onClick={runMenu(ungroupSelection)}
                      >
                        Ungroup
                      </MenuItem>
                    )}
                    <MenuItem
                      icon={menuTarget.locked ? "unlock" : "lock"}
                      onClick={runMenu(() => toggleSelection("locked"))}
                    >
                      {menuTarget.locked ? "Unlock" : "Lock"}
                    </MenuItem>
                    <MenuItem
                      icon="eyeoff"
                      onClick={runMenu(() => toggleSelection("hidden"))}
                    >
                      Hide
                    </MenuItem>
                    <MenuDivider />
                    <MenuItem
                      icon="trash"
                      danger
                      shortcut="⌫"
                      disabled={menuTarget.locked}
                      onClick={runMenu(deleteSelection)}
                    >
                      Delete
                    </MenuItem>
                  </>
                )}
              </>
            ) : (
              <>
                <span className="menu-label">CANVAS</span>
                {!readOnly && (
                  <>
                    <MenuItem
                      icon="sticky"
                      onClick={runMenu(() => addStickyAt(menu.point))}
                    >
                      Add sticky note here
                    </MenuItem>
                    <MenuItem
                      icon="cursor"
                      shortcut="⌘A"
                      disabled={!shapes.length}
                      onClick={runMenu(selectAll)}
                    >
                      Select all
                    </MenuItem>
                    <MenuDivider />
                  </>
                )}
                <MenuItem
                  icon="fit"
                  shortcut="⇧1"
                  onClick={runMenu(() => fitToScreen())}
                >
                  Fit to screen
                </MenuItem>
                <MenuItem icon="refresh" shortcut="⇧0" onClick={runMenu(resetView)}>
                  Reset view
                </MenuItem>
                <MenuItem
                  icon="grid"
                  shortcut="⇧G"
                  onClick={runMenu(() => setGrid(!grid))}
                >
                  {grid ? "Hide grid" : "Show grid"}
                </MenuItem>
                {!readOnly && (
                  <>
                    <MenuItem
                      icon="magnet"
                      shortcut="⇧S"
                      onClick={runMenu(() => setSnap(!snap))}
                    >
                      {snap ? "Turn off snapping" : "Snap to grid"}
                    </MenuItem>
                    <MenuDivider />
                    <MenuItem icon="template" disabled badge={<PlannedBadge />}>
                      Insert template
                    </MenuItem>
                  </>
                )}
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
};
