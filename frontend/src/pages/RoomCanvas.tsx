import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import axios from "axios";
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
  Badge,
  Button,
  Confirm,
  Field,
  IconButton,
  Input,
  Modal,
  Notice,
  Textarea,
  useToast,
} from "../components/ui";
import { Icon } from "../components/Icon";
import { ChatPanel } from "../features/chat/ChatPanel";
import type { ChatMessage } from "../features/chat/ChatPanel";
import { errorMessage } from "../services/workspace";

interface Shape {
  id: string;
  type:
    | "RECTANGLE"
    | "CIRCLE"
    | "ELLIPSE"
    | "FREEHAND"
    | "STICKY_NOTE"
    | "TEXT"
    | "ARROW"
    | "IMAGE"
    | "LINE";
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radius?: number;
  radiusX?: number;
  radiusY?: number;
  points?: number[];
  text?: string;
  imageUrl?: string;
  color: string;
  strokeWidth?: number;
  name?: string;
  kind?: "frame" | "section" | "connector";
  hidden?: boolean;
  locked?: boolean;
  rotation?: number;
  opacity?: number;
  fill?: string;
  order?: number;
  fontSize?: number;
  groupId?: string;
}
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

// Component phụ render Ảnh trên Konva Canvas
const URLImage: React.FC<{
  shape: Shape;
  isDraggable: boolean;
  onDragEnd: any;
  onClick: any;
  onTap: () => void;
  onMouseEnter: any;
}> = ({ shape, isDraggable, onDragEnd, onClick, onTap, onMouseEnter }) => {
  const [image, setImage] = useState<HTMLImageElement | undefined>(undefined);

  useEffect(() => {
    if (!shape.imageUrl) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = shape.imageUrl;
    img.onload = () => {
      setImage(img);
    };
  }, [shape.imageUrl]);

  if (!image) return null;

  return (
    <KonvaImage
      key={shape.id}
      id={shape.id}
      image={image}
      x={shape.x}
      y={shape.y}
      width={shape.width || 200}
      height={shape.height || 200}
      rotation={shape.rotation || 0}
      opacity={shape.opacity ?? 1}
      draggable={isDraggable}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onTap={onTap}
      onMouseEnter={onMouseEnter}
    />
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
  const { demo, assets, workspace } = useWorkspace();
  const toast = useToast();

  // State Pan & Zoom (Infinite Canvas)
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  const [tool, setTool] = useState<
    | "SELECT"
    | "HAND"
    | "FREEHAND"
    | "RECTANGLE"
    | "CIRCLE"
    | "ELLIPSE"
    | "STICKY_NOTE"
    | "TEXT"
    | "ARROW"
    | "ERASER"
    | "LINE"
    | "FRAME"
    | "SECTION"
    | "CONNECTOR"
  >("SELECT");
  const [color, setColor] = useState("#2455d6");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [shapes, setShapes] = useState<Shape[]>(() =>
    demo
      ? structuredClone(demoCanvasCache[roomId || ""] || initialDemoShapes())
      : [],
  );
  const [isMouseDown, setIsMouseDown] = useState(false);
  const drawingId = useRef<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Chat & File Upload State
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    demo
      ? structuredClone(
          demoMessageCache[roomId || ""] || [
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
              reactions: ["sarah"],
            },
            {
              id: "sample-3",
              senderUsername: "alex",
              message:
                "Agreed. I’ll pull together a few more references before our review.",
              timestamp: "09:46",
            },
          ],
        )
      : [],
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stompClientRef = useRef<Client | null>(null);
  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);

  const [cursors, setCursors] = useState<{ [key: string]: UserCursor }>({});
  const lastCursorSend = useRef<number>(0);
  const [connected, setConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState(
    demo ? "Local demo" : "Connecting…",
  );
  const [canvasError, setCanvasError] = useState("");
  const [grid, setGrid] = useState(true);
  const [showLayers, setShowLayers] = useState(() => window.innerWidth > 1000);
  const [showInspector, setShowInspector] = useState(
    () => window.innerWidth > 760,
  );
  const [clearOpen, setClearOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [textDialog, setTextDialog] = useState<{
    type: "TEXT" | "STICKY_NOTE";
    x: number;
    y: number;
  } | null>(null);
  const [textValue, setTextValue] = useState("");
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
  const orderedShapes = shapes.toSorted(
    (a, b) => (a.order ?? shapes.indexOf(a)) - (b.order ?? shapes.indexOf(b)),
  );
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
      webSocketFactory: () =>
        new SockJS("http://localhost:8080/ws-visual-workspace"),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true);
        setSyncStatus("Live connection");
        for (const event of pendingEvents.current.values())
          client.publish({
            destination: `/app/room.${roomId}.draw`,
            body: JSON.stringify({ roomId, ...event }),
          });
        pendingEvents.current.clear();
        // 1. Subscribe nét vẽ
        client.subscribe(`/topic/room.${roomId}`, (message) => {
          const drawEvent = JSON.parse(message.body);
          if (drawEvent.payload?.id)
            editedIds.current.add(drawEvent.payload.id);
          if (drawEvent.senderUsername === user?.username)
            setSyncStatus("Received by server");
          if (drawEvent.senderUsername !== user?.username) {
            if (drawEvent.type === "ERASER") {
              setShapes((prev) =>
                prev.filter((s) => s.id !== drawEvent.payload.id),
              );
            } else if (drawEvent.type === "UPDATE") {
              setShapes((prev) =>
                prev.some((s) => s.id === drawEvent.payload.id)
                  ? prev.map((s) =>
                      s.id === drawEvent.payload.id ? drawEvent.payload : s,
                    )
                  : [...prev, drawEvent.payload],
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

        // 4. Subscribe Room Chat
        client.subscribe(`/topic/room.${roomId}.chat`, (message) => {
          const chatEvt = JSON.parse(message.body);
          setMessages((prev) => [...prev, chatEvt]);
        });
      },
      onWebSocketClose: () => {
        setConnected(false);
        setSyncStatus("Offline · local changes queued");
      },
      onStompError: () => {
        setConnected(false);
        setSyncStatus("Connection error");
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

  // Tải lịch sử vẽ từ Database
  useEffect(() => {
    if (demo || !roomId || !token) return;

    let active = true;
    const fetchCanvasHistory = async () => {
      try {
        const res = await axios.get(
          `http://localhost:8080/api/v1/rooms/${roomId}/canvas`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (active && Array.isArray(res.data)) {
          setShapes((prev) => [
            ...res.data.filter((s: Shape) => !editedIds.current.has(s.id)),
            ...prev.filter((s) => editedIds.current.has(s.id)),
          ]);
        }
      } catch (err) {
        if (active) setCanvasError(errorMessage(err));
      }
    };

    fetchCanvasHistory();
    return () => {
      active = false;
    };
  }, [roomId, token, demo]);

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

    let newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    newScale = Math.max(0.1, Math.min(5, newScale));

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
    if (demo) {
      setSyncStatus("Local demo · up to date");
      return;
    }
    if (stompClientRef.current?.connected && roomId) {
      setSyncStatus("Sending…");
      stompClientRef.current.publish({
        destination: `/app/room.${roomId}.draw`,
        body: JSON.stringify({ roomId, type: eventType, payload }),
      });
    } else if (payload.id) {
      pendingEvents.current.set(payload.id, { type: eventType, payload });
      setSyncStatus("Offline · local changes queued");
    }
  };

  const handleSendMessage = (message: string) => {
    if (!message.trim() || !stompClientRef.current?.connected || !roomId)
      return;
    stompClientRef.current.publish({
      destination: `/app/room.${roomId}.chat`,
      body: JSON.stringify({ message }),
    });
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
        : await axios.post("http://localhost:8080/api/v1/upload", formData, {
            headers: {
              "Content-Type": "multipart/form-data",
              Authorization: `Bearer ${token}`,
            },
          });

      const imageUrl = res.data.url;
      const stage = stageRef.current;
      const pos = getRelativePointerPosition(stage);

      const newId = `shape-${crypto.randomUUID()}`;
      const imgShape: Shape = {
        id: newId,
        type: "IMAGE",
        x: pos.x || 100,
        y: pos.y || 100,
        width: 250,
        height: 250,
        imageUrl: imageUrl,
        color: "transparent",
      };

      recordHistory();
      setShapes((prev) => [...prev, imgShape]);
      broadcastEvent("IMAGE", imgShape);
      e.target.value = "";
    } catch (err) {
      toast(errorMessage(err), true);
    }
  };

  const executeErase = (targetNode: any) => {
    if (!targetNode || tool !== "ERASER") return;
    let idToDelete = targetNode.id();
    if (!idToDelete && targetNode.getParent()) {
      idToDelete = targetNode.getParent().id();
    }
    if (idToDelete) {
      if (shapes.find((s) => s.id === idToDelete)?.locked) return;
      setShapes((prev) => prev.filter((s) => s.id !== idToDelete));
      broadcastEvent("ERASER", { id: idToDelete });
    }
  };

  const handleMouseDown = (e: any) => {
    if (isSpacePressed || tool === "HAND") return;

    setIsMouseDown(true);
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) {
      setSelectedId(null);
      setMultiIds([]);
    }

    if (tool === "ERASER") {
      recordHistory();
      if (!clickedOnEmpty) executeErase(e.target);
      return;
    }

    if (tool === "SELECT") return;
    recordHistory();

    const pos = getRelativePointerPosition(stageRef.current);
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
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          color,
          strokeWidth,
          ...(tool === "FRAME" || tool === "SECTION"
            ? {
                kind:
                  tool === "FRAME" ? ("frame" as const) : ("section" as const),
                fill: "#fffefb",
                name: tool === "FRAME" ? "New frame" : "New section",
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
          x: pos.x,
          y: pos.y,
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
          x: pos.x,
          y: pos.y,
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
          points: [pos.x, pos.y, pos.x, pos.y],
          color,
          strokeWidth,
          ...(tool === "CONNECTOR" ? { kind: "connector" as const } : {}),
        },
      ]);
    } else if (tool === "STICKY_NOTE" || tool === "TEXT") {
      setTextValue("");
      setTextDialog({ type: tool, ...pos });
      setIsMouseDown(false);
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

    if (!isMouseDown || isSpacePressed) return;

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

    const pos = getRelativePointerPosition(stage);
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
    } else if (
      tool === "CIRCLE" &&
      curr.x !== undefined &&
      curr.y !== undefined
    ) {
      const dx = pos.x - curr.x;
      const dy = pos.y - curr.y;
      curr.radius = Math.sqrt(dx * dx + dy * dy);
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
    if (
      tool !== "ERASER" &&
      tool !== "HAND" &&
      tool !== "SELECT" &&
      tool !== "STICKY_NOTE" &&
      tool !== "TEXT"
    ) {
      const lastShape = shapes.find((s) => s.id === drawingId.current);
      if (lastShape) {
        broadcastEvent(lastShape.type, lastShape);
      }
    }
    drawingId.current = null;
  };

  const handleDragEnd = (e: any, shape: Shape) => {
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

  const handleExportPNG = () => {
    const stage = stageRef.current;
    if (!stage) return;

    // Tạm thời ẩn Transformer selector nếu đang chọn shape
    setSelectedId(null);

    setTimeout(() => {
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
    }, 50);
  };

  const handleExportPDF = () => {
    const stage = stageRef.current;
    if (!stage) return;

    setSelectedId(null);

    setTimeout(async () => {
      try {
        const dataURL = stage.toDataURL({ pixelRatio: 2 });
        const { default: jsPDF } = await import("jspdf");
        const pdf = new jsPDF({
          orientation: "landscape",
          unit: "px",
          format: [stage.width(), stage.height()],
        });

        pdf.addImage(dataURL, "PNG", 0, 0, stage.width(), stage.height());
        pdf.save(`canvas-room-${roomId}-${Date.now()}.pdf`);
      } catch {
        toast(
          "PDF export failed. Check image permissions and try again.",
          true,
        );
      }
    }, 50);
  };

  const selectShape = (id: string, additive = false) => {
    const shape = shapes.find((s) => s.id === id);
    setSelectedId(id);
    if (additive)
      setMultiIds((prev) =>
        Array.from(
          new Set([
            ...(prev.length ? prev : selectedId ? [selectedId] : []),
            id,
          ]),
        ),
      );
    else
      setMultiIds(
        shape?.groupId
          ? shapes.filter((s) => s.groupId === shape.groupId).map((s) => s.id)
          : [],
      );
  };
  const changeShape = (patch: Partial<Shape>) => {
    if (
      !selected ||
      (selected.locked && !("locked" in patch) && !("hidden" in patch))
    )
      return;
    recordHistory();
    const next = { ...selected, ...patch };
    setShapes((prev) => prev.map((s) => (s.id === selected.id ? next : s)));
    broadcastEvent("UPDATE", next);
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
    const ids = multiIds.length ? multiIds : selectedId ? [selectedId] : [];
    recordHistory();
    shapes
      .filter((s) => ids.includes(s.id) && !s.locked)
      .forEach((s) => broadcastEvent("ERASER", { id: s.id }));
    setShapes((prev) => prev.filter((s) => !ids.includes(s.id) || s.locked));
    setSelectedId(null);
    setMultiIds([]);
  };
  const duplicateSelection = () => {
    const ids = multiIds.length ? multiIds : selectedId ? [selectedId] : [];
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
        name: `${s.name || s.type.toLowerCase()} copy`,
        order: undefined,
      }));
    recordHistory();
    setShapes((prev) => [...prev, ...copies]);
    copies.forEach((s) => broadcastEvent(s.type, s));
  };
  const reorder = (direction: number) => {
    if (!selectedId) return;
    const next = [...orderedShapes],
      index = next.findIndex((s) => s.id === selectedId),
      target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    recordHistory();
    const ordered = next.map((s, i) => ({ ...s, order: i }));
    setShapes(ordered);
    ordered.forEach((s) => broadcastEvent("UPDATE", s));
  };
  const groupSelection = () => {
    if (
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
  };
  const ungroupSelection = () => {
    if (!selected?.groupId) return;
    recordHistory();
    const next = shapes.map((s) =>
      s.groupId === selected.groupId ? { ...s, groupId: undefined } : s,
    );
    setShapes(next);
    next
      .filter(
        (s) => shapes.find((p) => p.id === s.id)?.groupId === selected.groupId,
      )
      .forEach((s) => broadcastEvent("UPDATE", s));
    setMultiIds([]);
  };
  const alignSelection = () => {
    if (multiIds.length < 2) return;
    const bounds = new Map<string, number>();
    multiIds.forEach((id) => {
      const node = stageRef.current?.findOne("#" + id);
      if (node)
        bounds.set(id, node.getClientRect({ relativeTo: stageRef.current }).x);
    });
    if (bounds.size < 2) return;
    const minX = Math.min(...bounds.values());
    recordHistory();
    const next = shapes.map((s) =>
      bounds.has(s.id) && !s.locked
        ? { ...s, x: (s.x || 0) + minX - bounds.get(s.id)! }
        : s,
    );
    setShapes(next);
    next
      .filter((s) => multiIds.includes(s.id))
      .forEach((s) => broadcastEvent("UPDATE", s));
  };
  const insertImage = (url: string, name: string) => {
    recordHistory();
    const shape: Shape = {
      id: `shape-${crypto.randomUUID()}`,
      type: "IMAGE",
      x: (100 - stagePos.x) / stageScale,
      y: (100 - stagePos.y) / stageScale,
      width: 240,
      height: 240,
      imageUrl: url,
      name,
      color: "transparent",
    };
    setShapes((prev) => [...prev, shape]);
    broadcastEvent("IMAGE", shape);
    setLibraryOpen(false);
    setTool("SELECT");
    setSelectedId(shape.id);
  };
  const transformShape = (e: any) => {
    const node = e.target,
      shape = shapes.find((s) => s.id === node.id());
    if (!shape || shape.locked) return;
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
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        duplicateSelection();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelection();
      } else if (e.key === "Escape") {
        setSelectedId(null);
        setMultiIds([]);
        setTool("SELECT");
      } else if (!e.metaKey && !e.ctrlKey) {
        const keys: Record<string, typeof tool> = {
          v: "SELECT",
          h: "HAND",
          p: "FREEHAND",
          r: "RECTANGLE",
          o: "CIRCLE",
          t: "TEXT",
          e: "ERASER",
          l: "LINE",
          f: "FRAME",
        };
        if (keys[e.key.toLowerCase()]) setTool(keys[e.key.toLowerCase()]);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  return (
    <div className="canvas-engine">
      {view === "chat" && (
        <ChatPanel
          messages={messages}
          setMessages={setMessages}
          connected={connected}
          onSend={handleSendMessage}
        />
      )}
      <div
        className={view === "canvas" ? "canvas-editor" : "room-engine-hidden"}
      >
        <div className="canvas-top-toolbar">
          <div className="canvas-toolbar-group">
            <IconButton
              icon="panel"
              label="Toggle layers"
              aria-pressed={showLayers}
              onClick={() => setShowLayers(!showLayers)}
            />
            <span className="toolbar-divider" />
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
            <span className="canvas-sync">
              <span
                className={`status-dot ${!demo && !connected ? "offline" : ""}`}
              />
              {syncStatus}
            </span>
          </div>
          <div className="canvas-toolbar-group">
            <Button variant="ghost" onClick={handleExportPNG} icon="download">
              PNG
            </Button>
            <Button variant="ghost" onClick={handleExportPDF}>
              PDF
            </Button>
            <Button
              variant="ghost"
              icon="refresh"
              disabled={demo || !connected}
              onClick={() => {
                shapes.forEach((s) => broadcastEvent("UPDATE", s));
                toast(
                  "Canvas objects sent. Server receipt does not guarantee database persistence.",
                );
              }}
            >
              Sync
            </Button>
            <Button icon="users" onClick={() => setShareOpen(true)}>
              Share
            </Button>
            <IconButton
              icon="settings"
              label="Toggle properties panel"
              aria-pressed={showInspector}
              onClick={() => setShowInspector(!showInspector)}
            />
          </div>
        </div>
        {canvasError && (
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
            <aside className="canvas-layers">
              <div className="canvas-panel-heading">
                <strong>Layers</strong>
                <Badge>{shapes.length}</Badge>
              </div>
              <div className="canvas-layer-list">
                {orderedShapes.toReversed().map((s) => (
                  <div
                    key={s.id}
                    className={`canvas-layer-row ${selectedId === s.id || multiIds.includes(s.id) ? "active" : ""} ${s.hidden ? "layer-hidden" : ""}`}
                  >
                    <Button
                      variant="ghost"
                      onClick={(e) => {
                        setTool("SELECT");
                        selectShape(s.id, e.shiftKey);
                      }}
                    >
                      <Icon
                        name={
                          s.type === "TEXT"
                            ? "text"
                            : s.type === "IMAGE"
                              ? "image"
                              : s.kind
                                ? "frame"
                                : s.groupId
                                  ? "layers"
                                  : s.type === "STICKY_NOTE"
                                    ? "sticky"
                                    : s.type === "FREEHAND"
                                      ? "pen"
                                      : "rect"
                        }
                        size={13}
                      />
                      <span>
                        {s.name ||
                          s.kind ||
                          s.type.toLowerCase().replace("_", " ")}
                      </span>
                    </Button>
                    <IconButton
                      icon={s.hidden ? "eyeoff" : "eye"}
                      label={`${s.hidden ? "Show" : "Hide"} layer`}
                      onClick={() => {
                        recordHistory();
                        const next = { ...s, hidden: !s.hidden };
                        setShapes((prev) =>
                          prev.map((p) => (p.id === s.id ? next : p)),
                        );
                        broadcastEvent("UPDATE", next);
                      }}
                    />
                    <IconButton
                      icon={s.locked ? "lock" : "edit"}
                      label={`${s.locked ? "Unlock" : "Lock"} layer`}
                      onClick={() => {
                        recordHistory();
                        const next = { ...s, locked: !s.locked };
                        setShapes((prev) =>
                          prev.map((p) => (p.id === s.id ? next : p)),
                        );
                        broadcastEvent("UPDATE", next);
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="canvas-layer-footer">
                <span>Shift + click to select multiple.</span>
                <div>
                  <Button
                    variant="ghost"
                    disabled={multiIds.length < 2}
                    onClick={groupSelection}
                  >
                    Group
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={!selected?.groupId}
                    onClick={ungroupSelection}
                  >
                    Ungroup
                  </Button>
                </div>
                <p>
                  Frames organize visually. They do not clip or auto-layout
                  their children.
                </p>
              </div>
            </aside>
          )}
          <div className="canvas-center">
            <div
              className="canvas-tool-rail"
              role="toolbar"
              aria-label="Canvas tools"
            >
              {[
                { id: "SELECT", icon: "cursor", label: "Select (V)" },
                { id: "HAND", icon: "hand", label: "Hand / pan (H)" },
                { id: "FREEHAND", icon: "pen", label: "Pen (P)" },
                { id: "ERASER", icon: "eraser", label: "Eraser (E)" },
                { id: "RECTANGLE", icon: "rect", label: "Rectangle (R)" },
                { id: "CIRCLE", icon: "circle", label: "Circle (O)" },
                { id: "ELLIPSE", icon: "ellipse", label: "Ellipse" },
                { id: "LINE", icon: "minus", label: "Line (L)" },
                { id: "ARROW", icon: "diagonal", label: "Arrow" },
                { id: "TEXT", icon: "text", label: "Text (T)" },
                { id: "STICKY_NOTE", icon: "sticky", label: "Sticky note" },
                { id: "FRAME", icon: "frame", label: "Frame (F)" },
                { id: "SECTION", icon: "grid", label: "Section" },
                {
                  id: "CONNECTOR",
                  icon: "link",
                  label: "Connector (manual endpoints)",
                },
              ].map((t) => (
                <IconButton
                  key={t.id}
                  icon={t.icon}
                  label={t.label}
                  aria-pressed={tool === t.id}
                  className={tool === t.id ? "active" : ""}
                  onClick={() => {
                    setTool(t.id as typeof tool);
                    setSelectedId(null);
                    setMultiIds([]);
                  }}
                />
              ))}
              <span className="rail-divider" />
              <IconButton
                icon="image"
                label="Upload image"
                onClick={() => fileInputRef.current?.click()}
              />
              <IconButton
                icon="folder"
                label="Insert from media library"
                onClick={() => setLibraryOpen(true)}
              />
              <Input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="sr-only"
              />
            </div>
            {/* Stage Container */}
            <div
              ref={containerRef}
              className={`canvas-stage-container ${grid ? "with-grid" : ""}`}
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
                        ? "default"
                        : "crosshair",
                }}
              >
                <Layer onTransformEnd={transformShape}>
                  {/* Shapes */}
                  {orderedShapes
                    .filter((s) => !s.hidden)
                    .map((s) => {
                      const isDraggable =
                        tool === "SELECT" && !isSpacePressed && !s.locked;
                      if (s.type === "FREEHAND" && s.points) {
                        return (
                          <Line
                            key={s.id}
                            id={s.id}
                            x={s.x}
                            y={s.y}
                            {...appearance(s)}
                            points={s.points}
                            stroke={s.color}
                            strokeWidth={s.strokeWidth ?? 3}
                            tension={0.5}
                            lineCap="round"
                            lineJoin="round"
                            draggable={isDraggable}
                            onDragEnd={(e) => handleDragEnd(e, s)}
                            onClick={(e: any) =>
                              selectShape(s.id, e.evt.shiftKey)
                            }
                            onTap={() => selectShape(s.id)}
                            onMouseEnter={handleShapeHover}
                          />
                        );
                      } else if (s.type === "RECTANGLE") {
                        return (
                          <Rect
                            key={s.id}
                            id={s.id}
                            {...appearance(s)}
                            dash={s.kind === "section" ? [8, 5] : undefined}
                            x={s.x}
                            y={s.y}
                            width={s.width}
                            height={s.height}
                            stroke={s.color}
                            strokeWidth={s.strokeWidth ?? 2}
                            fill={s.fill || `${s.color}22`}
                            draggable={isDraggable}
                            onDragEnd={(e) => handleDragEnd(e, s)}
                            onClick={(e: any) =>
                              selectShape(s.id, e.evt.shiftKey)
                            }
                            onTap={() => selectShape(s.id)}
                            onMouseEnter={handleShapeHover}
                          />
                        );
                      } else if (s.type === "CIRCLE") {
                        return (
                          <Circle
                            key={s.id}
                            id={s.id}
                            {...appearance(s)}
                            x={s.x}
                            y={s.y}
                            radius={s.radius}
                            stroke={s.color}
                            strokeWidth={s.strokeWidth ?? 2}
                            fill={s.fill || `${s.color}22`}
                            draggable={isDraggable}
                            onDragEnd={(e) => handleDragEnd(e, s)}
                            onClick={(e: any) =>
                              selectShape(s.id, e.evt.shiftKey)
                            }
                            onTap={() => selectShape(s.id)}
                            onMouseEnter={handleShapeHover}
                          />
                        );
                      } else if (s.type === "ELLIPSE") {
                        return (
                          <Ellipse
                            key={s.id}
                            id={s.id}
                            x={s.x}
                            y={s.y}
                            {...appearance(s)}
                            radiusX={s.radiusX || 0}
                            radiusY={s.radiusY || 0}
                            stroke={s.color}
                            strokeWidth={s.strokeWidth ?? 2}
                            fill={s.fill || `${s.color}22`}
                            draggable={isDraggable}
                            onDragEnd={(e) => handleDragEnd(e, s)}
                            onClick={(e) => selectShape(s.id, e.evt.shiftKey)}
                            onTap={() => selectShape(s.id)}
                            onMouseEnter={handleShapeHover}
                          />
                        );
                      } else if (s.type === "LINE" && s.points) {
                        return (
                          <Line
                            key={s.id}
                            id={s.id}
                            x={s.x}
                            y={s.y}
                            {...appearance(s)}
                            points={s.points}
                            stroke={s.color}
                            strokeWidth={s.strokeWidth ?? 2}
                            draggable={isDraggable}
                            onDragEnd={(e) => handleDragEnd(e, s)}
                            onClick={(e) => selectShape(s.id, e.evt.shiftKey)}
                            onTap={() => selectShape(s.id)}
                            onMouseEnter={handleShapeHover}
                          />
                        );
                      } else if (s.type === "ARROW" && s.points) {
                        return (
                          <Arrow
                            key={s.id}
                            id={s.id}
                            x={s.x}
                            y={s.y}
                            {...appearance(s)}
                            points={s.points}
                            stroke={s.color}
                            fill={s.color}
                            strokeWidth={s.strokeWidth ?? 3}
                            pointerLength={10}
                            pointerWidth={10}
                            draggable={isDraggable}
                            onDragEnd={(e) => handleDragEnd(e, s)}
                            onClick={(e: any) =>
                              selectShape(s.id, e.evt.shiftKey)
                            }
                            onTap={() => selectShape(s.id)}
                            onMouseEnter={handleShapeHover}
                          />
                        );
                      } else if (s.type === "STICKY_NOTE") {
                        return (
                          <Group
                            key={s.id}
                            id={s.id}
                            {...appearance(s)}
                            x={s.x}
                            y={s.y}
                            draggable={isDraggable}
                            onDragEnd={(e) => handleDragEnd(e, s)}
                            onClick={(e: any) =>
                              selectShape(s.id, e.evt.shiftKey)
                            }
                            onTap={() => selectShape(s.id)}
                            onMouseEnter={handleShapeHover}
                          >
                            <Rect
                              width={s.width || 160}
                              height={s.height || 160}
                              fill={s.fill || s.color}
                              cornerRadius={2}
                              stroke={s.color}
                              strokeWidth={s.strokeWidth ?? 1}
                            />
                            <Text
                              text={s.text}
                              x={12}
                              y={12}
                              width={(s.width || 160) - 24}
                              fontSize={14}
                              fontFamily="IBM Plex Sans, sans-serif"
                              fill="#4b543e"
                              wrap="word"
                            />
                          </Group>
                        );
                      } else if (s.type === "TEXT") {
                        return (
                          <Text
                            key={s.id}
                            id={s.id}
                            {...appearance(s)}
                            x={s.x}
                            y={s.y}
                            text={s.text}
                            fontSize={s.fontSize || 18}
                            fontFamily="IBM Plex Sans, sans-serif"
                            fill={s.color}
                            draggable={isDraggable}
                            onDragEnd={(e) => handleDragEnd(e, s)}
                            onClick={(e: any) =>
                              selectShape(s.id, e.evt.shiftKey)
                            }
                            onTap={() => selectShape(s.id)}
                            onMouseEnter={handleShapeHover}
                          />
                        );
                      } else if (s.type === "IMAGE") {
                        return (
                          <URLImage
                            key={s.id}
                            shape={s}
                            isDraggable={isDraggable}
                            onDragEnd={(e: any) => handleDragEnd(e, s)}
                            onClick={(e: any) =>
                              selectShape(s.id, e.evt.shiftKey)
                            }
                            onTap={() => selectShape(s.id)}
                            onMouseEnter={handleShapeHover}
                          />
                        );
                      }
                      return null;
                    })}

                  {tool === "SELECT" &&
                    selectedId &&
                    !selected?.locked &&
                    !isSpacePressed && (
                      <Transformer
                        ref={transformerRef}
                        flipEnabled={false}
                        boundBoxFunc={(oldBox, newBox) =>
                          Math.abs(newBox.width) < 5 ||
                          Math.abs(newBox.height) < 5
                            ? oldBox
                            : newBox
                        }
                      />
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
            </div>

            <div className="canvas-bottom-bar">
              <span>
                <Icon name="cursor" size={12} />
                {multiIds.length > 1
                  ? `${multiIds.length} objects selected`
                  : selected
                    ? selected.name || selected.type.toLowerCase()
                    : `${shapes.length} objects · ${tool.toLowerCase().replace("_", " ")}`}
              </span>
              <div>
                <IconButton
                  icon="grid"
                  label="Toggle grid"
                  aria-pressed={grid}
                  onClick={() => setGrid(!grid)}
                />
                <span className="toolbar-divider" />
                <IconButton
                  icon="minus"
                  label="Zoom out"
                  onClick={() => setStageScale((v) => Math.max(0.1, v / 1.2))}
                />
                <Button
                  variant="ghost"
                  onClick={() => {
                    setStageScale(1);
                    setStagePos({ x: 0, y: 0 });
                  }}
                  title="Reset zoom and position"
                >
                  {Math.round(stageScale * 100)}%
                </Button>
                <IconButton
                  icon="plus"
                  label="Zoom in"
                  onClick={() => setStageScale((v) => Math.min(5, v * 1.2))}
                />
              </div>
            </div>
          </div>
          {showInspector && (
            <aside className="canvas-inspector">
              <div className="canvas-panel-heading">
                <strong>Properties</strong>
                <Icon name="settings" size={14} />
              </div>
              <div className="inspector-content">
                {selected ? (
                  <>
                    <Field label="Layer name">
                      <Input
                        disabled={selected.locked}
                        value={selected.name || selected.type.toLowerCase()}
                        onChange={(e) => changeShape({ name: e.target.value })}
                      />
                    </Field>
                    <div className="inspector-two-col">
                      <Field label="X">
                        <Input
                          type="number"
                          value={Math.round(selected.x || 0)}
                          disabled={selected.locked}
                          onChange={(e) =>
                            changeShape({ x: Number(e.target.value) })
                          }
                        />
                      </Field>
                      <Field label="Y">
                        <Input
                          type="number"
                          value={Math.round(selected.y || 0)}
                          disabled={selected.locked}
                          onChange={(e) =>
                            changeShape({ y: Number(e.target.value) })
                          }
                        />
                      </Field>
                      <Field
                        label={selected.type === "CIRCLE" ? "Radius" : "Width"}
                      >
                        <Input
                          type="number"
                          min="1"
                          disabled={
                            selected.locked ||
                            (selected.radiusX === undefined &&
                              selected.width === undefined &&
                              selected.radius === undefined)
                          }
                          value={Math.round(
                            selected.radius ??
                              (selected.radiusX !== undefined
                                ? selected.radiusX * 2
                                : (selected.width ?? 0)),
                          )}
                          onChange={(e) =>
                            changeShape(
                              selected.type === "CIRCLE"
                                ? {
                                    radius: Math.max(1, Number(e.target.value)),
                                  }
                                : selected.type === "ELLIPSE"
                                  ? {
                                      radiusX: Math.max(
                                        1,
                                        Number(e.target.value) / 2,
                                      ),
                                    }
                                  : {
                                      width: Math.max(
                                        1,
                                        Number(e.target.value),
                                      ),
                                    },
                            )
                          }
                        />
                      </Field>
                      <Field label="Height">
                        <Input
                          type="number"
                          min="1"
                          disabled={
                            selected.locked ||
                            (selected.height === undefined &&
                              selected.radiusY === undefined)
                          }
                          value={Math.round(
                            selected.radiusY !== undefined
                              ? selected.radiusY * 2
                              : selected.height || 0,
                          )}
                          onChange={(e) =>
                            changeShape(
                              selected.type === "ELLIPSE"
                                ? {
                                    radiusY: Math.max(
                                      1,
                                      Number(e.target.value) / 2,
                                    ),
                                  }
                                : {
                                    height: Math.max(1, Number(e.target.value)),
                                  },
                            )
                          }
                        />
                      </Field>
                      <Field label="Rotation">
                        <Input
                          type="number"
                          disabled={selected.locked}
                          value={Math.round(selected.rotation || 0)}
                          onChange={(e) =>
                            changeShape({ rotation: Number(e.target.value) })
                          }
                        />
                      </Field>
                      <Field label="Opacity %">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          disabled={selected.locked}
                          value={Math.round((selected.opacity ?? 1) * 100)}
                          onChange={(e) =>
                            changeShape({
                              opacity: Math.min(
                                1,
                                Math.max(0, Number(e.target.value) / 100),
                              ),
                            })
                          }
                        />
                      </Field>
                    </div>
                    <div className="inspector-divider" />
                    {selected.type !== "IMAGE" && (
                      <Field
                        label={
                          selected.type === "TEXT"
                            ? "Text color"
                            : "Stroke color"
                        }
                      >
                        <div className="inspector-color">
                          <Input
                            type="color"
                            value={
                              selected.color.startsWith("#")
                                ? selected.color.slice(0, 7)
                                : "#20221f"
                            }
                            disabled={selected.locked}
                            onChange={(e) =>
                              changeShape({ color: e.target.value })
                            }
                          />
                          <span>{selected.color}</span>
                        </div>
                      </Field>
                    )}
                    {["RECTANGLE", "CIRCLE", "ELLIPSE", "STICKY_NOTE"].includes(
                      selected.type,
                    ) && (
                      <Field label="Fill">
                        <div className="inspector-color">
                          <Input
                            type="color"
                            disabled={selected.locked}
                            value={(selected.fill || selected.color).slice(
                              0,
                              7,
                            )}
                            onChange={(e) =>
                              changeShape({ fill: e.target.value })
                            }
                          />
                          <span>{selected.fill || "Default fill"}</span>
                        </div>
                      </Field>
                    )}
                    {selected.type !== "IMAGE" && selected.type !== "TEXT" && (
                      <Field label="Stroke width">
                        <Input
                          type="number"
                          min="0"
                          max="40"
                          disabled={selected.locked}
                          value={selected.strokeWidth ?? 1}
                          onChange={(e) =>
                            changeShape({ strokeWidth: Number(e.target.value) })
                          }
                        />
                      </Field>
                    )}
                    {(selected.type === "TEXT" ||
                      selected.type === "STICKY_NOTE") && (
                      <Field label="Content">
                        <Textarea
                          rows={4}
                          disabled={selected.locked}
                          value={selected.text || ""}
                          onChange={(e) =>
                            changeShape({ text: e.target.value })
                          }
                        />
                      </Field>
                    )}
                    {selected.type === "TEXT" && (
                      <Field label="Font size">
                        <Input
                          type="number"
                          min="6"
                          max="300"
                          value={selected.fontSize || 18}
                          disabled={selected.locked}
                          onChange={(e) =>
                            changeShape({
                              fontSize: Math.max(6, Number(e.target.value)),
                            })
                          }
                        />
                      </Field>
                    )}
                    <div className="inspector-divider" />
                    <span className="eyebrow">ARRANGE</span>
                    <div className="inspector-arrange">
                      <Button icon="layers" onClick={() => reorder(1)}>
                        Forward
                      </Button>
                      <Button icon="layers" onClick={() => reorder(-1)}>
                        Backward
                      </Button>
                      <Button
                        icon="align"
                        disabled={multiIds.length < 2}
                        onClick={alignSelection}
                      >
                        Align left
                      </Button>
                      <Button icon="copy" onClick={duplicateSelection}>
                        Duplicate
                      </Button>
                    </div>
                    <Button
                      icon="trash"
                      variant="ghost"
                      disabled={selected.locked}
                      onClick={deleteSelection}
                    >
                      Delete selected
                    </Button>
                    {selected.groupId && <Badge>Grouped objects</Badge>}
                    {selected.kind === "connector" && (
                      <p className="inspector-hint">
                        Manual connector. Automatic attachment to objects is not
                        implemented.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <span className="inspector-empty-icon">
                      <Icon name="cursor" size={25} />
                    </span>
                    <strong className="inspector-empty-title">
                      A little room to create.
                    </strong>
                    <p className="inspector-hint">
                      Select an object to adjust its properties, or choose a
                      tool to begin.
                    </p>
                    <div className="inspector-divider" />
                    <Field label="Drawing color">
                      <div className="inspector-color">
                        <Input
                          type="color"
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                        />
                        <span>{color.toUpperCase()}</span>
                      </div>
                    </Field>
                    <Field label="Stroke width">
                      <Input
                        type="range"
                        min="1"
                        max="20"
                        value={strokeWidth}
                        onChange={(e) => setStrokeWidth(Number(e.target.value))}
                      />
                      <span className="inspector-hint">{strokeWidth} px</span>
                    </Field>
                    <div className="inspector-divider" />
                    <p className="inspector-hint">
                      Space to pan
                      <br />
                      Scroll to zoom
                      <br />V to select
                      <br />
                      Shift + click for multi-select
                      <br />
                      Ctrl / ⌘ Z to undo
                    </p>
                    <Button
                      variant="ghost"
                      icon="trash"
                      disabled={!shapes.length}
                      onClick={() => setClearOpen(true)}
                    >
                      Clear canvas
                    </Button>
                  </>
                )}
                <div className="inspector-integration-note">
                  <Icon name={demo ? "info" : "shield"} size={13} />
                  <p>
                    {demo
                      ? "Demo canvas. All drawing is local to this browser session."
                      : "Drawing events use your existing STOMP persistence. Server receipt is not a database-save guarantee."}
                  </p>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
      {clearOpen && (
        <Confirm
          title="Clear this canvas?"
          description="Every object will be removed. In live mode each removal is sent through the existing drawing channel."
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
      {textDialog && (
        <Modal
          title={textDialog.type === "TEXT" ? "Add text" : "Add a sticky note"}
          onClose={() => setTextDialog(null)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const shape: Shape = {
                id: `shape-${crypto.randomUUID()}`,
                type: textDialog.type,
                x: textDialog.x,
                y: textDialog.y,
                text: textValue,
                width: textDialog.type === "STICKY_NOTE" ? 180 : undefined,
                height: textDialog.type === "STICKY_NOTE" ? 160 : undefined,
                color: textDialog.type === "STICKY_NOTE" ? "#e8ebcc" : color,
              };
              setShapes((prev) => [...prev, shape]);
              broadcastEvent(shape.type, shape);
              setTextDialog(null);
              setSelectedId(shape.id);
              setTool("SELECT");
            }}
          >
            <Textarea
              autoFocus
              required
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder="A thought worth keeping…"
              rows={4}
              aria-label="Object text"
            />
            <Button variant="primary" type="submit">
              Add to canvas
            </Button>
          </form>
        </Modal>
      )}
      {libraryOpen && (
        <Modal
          title="Insert from media library"
          onClose={() => setLibraryOpen(false)}
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
                  toast("Select and copy the room link above.");
                }
              }}
            >
              Copy link
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};
