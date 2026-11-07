import React, { useCallback, useEffect, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import { Stage, Layer, Line, Rect, Circle, Arrow, Text, Transformer } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type Konva from "konva";
import type { Participant, PresenceUpdateEvent } from "../types/presence";
import type { CursorEvent } from "../types/cursor";
import { ParticipantsPanel } from "./ParticipantsPanel";
import { LiveCursorsLayer } from "./LiveCursorsLayer";
import { UserNameModal } from "./UserNameModal";

type DrawEvent = {
  roomId: string;
  strokeId: string;
  points: number[];
  color: string;
  width: number;
  roomVersion: number;
  rotation?: number;
  deleted?: boolean;
};

type ShapeType = "RECTANGLE" | "CIRCLE" | "LINE" | "ARROW";

type ShapeEvent = {
  roomId: string;
  shapeId: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  radius: number;
  color: string;
  strokeWidth: number;
  roomVersion: number;
  rotation?: number;
  deleted?: boolean;
};

type TextEvent = {
  roomId: string;
  textId: string;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
  fontFamily: string;
  fontStyle: "normal" | "bold" | "italic";
  align: "left" | "center" | "right";
  width: number;
  rotation?: number;
  deleted?: boolean;
  roomVersion: number;
};

type EditEvent = {
  roomId: string;
  operationId: string;
  transactionId: string;
  operation: "UPDATE" | "DELETE";
  objectType: "STROKE" | ShapeType | "TEXT";
  objectId: string;
  object?: Record<string, unknown>;
  roomVersion: number;
};

type UndoRedoEvent = {
  action: "UNDO" | "REDO";
  roomId: string;
  strokeId: string;
  points: number[];
  color: string;
  width: number;
  roomVersion: number;
  shapeId?: string;
  type?: ShapeType;
  x?: number;
  y?: number;
  height?: number;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  radius?: number;
  strokeWidth?: number;
  textId?: string;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: TextEvent["fontStyle"];
  align?: TextEvent["align"];
  deleted?: boolean;
};

type ClearEvent = {
  roomId: string;
  roomVersion: number;
};

type SavedState = {
  roomId: string;
  data: {
    lines: Array<{
      strokeId: string;
      points: number[];
      color: string;
      width: number;
    }>;
    shapes?: Array<ShapeEvent>;
    texts?: Array<TextEvent>;
  };
  roomVersion?: number;
  updatedAt: string;
};

type Tool = "select" | "pen" | "eraser" | "rectangle" | "circle" | "line" | "arrow" | "text";

interface WhiteboardCanvasProps {
  roomId: string;
  onLeaveRoom: () => void;
}

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  roomId,
  onLeaveRoom,
}) => {
  const [lines, setLines] = useState<DrawEvent[]>([]);
  const [shapes, setShapes] = useState<ShapeEvent[]>([]);
  const [texts, setTexts] = useState<TextEvent[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#2563eb");
  const [width, setWidth] = useState(3);
  const [fontSize, setFontSize] = useState(24);
  const [isSaving, setIsSaving] = useState(false);
  const [storageStatus, setStorageStatus] = useState("Chưa tải dữ liệu");
  const [copied, setCopied] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState("");
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);

  const [displayName, setDisplayName] = useState<string>(() => {
    return sessionStorage.getItem("wbs_display_name") || "";
  });
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<Map<string, CursorEvent>>(new Map());

  const clientRef = useRef<Client | null>(null);
  const currentStrokeIdRef = useRef<string | null>(null);
  const currentPointsRef = useRef<number[]>([]);
  const currentShapeRef = useRef<ShapeEvent | null>(null);
  const roomVersionRef = useRef(0);
  const lastCursorSendTimeRef = useRef(0);
  const lastCursorPosRef = useRef<{ x: number; y: number } | null>(null);
  const undoStackRef = useRef<DrawEvent[]>([]);
  const redoStackRef = useRef<DrawEvent[]>([]);
  const shapeUndoStackRef = useRef<ShapeEvent[]>([]);
  const shapeRedoStackRef = useRef<ShapeEvent[]>([]);
  const textUndoStackRef = useRef<TextEvent[]>([]);
  const textRedoStackRef = useRef<TextEvent[]>([]);
  const linesRef = useRef<DrawEvent[]>([]);
  const shapesRef = useRef<ShapeEvent[]>([]);
  const textsRef = useRef<TextEvent[]>([]);
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const nodeRefs = useRef(new Map<string, Konva.Node>());
  const transformerRef = useRef<Konva.Transformer | null>(null);

  const apiStateUrl = `http://localhost:8080/api/rooms/${roomId}/state`;

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    transformer.nodes(
      selectedObjectIds
        .map((id) => nodeRefs.current.get(id))
        .filter((node): node is Konva.Node => Boolean(node))
    );
    transformer.getLayer()?.batchDraw();
  }, [selectedObjectIds, lines, shapes, texts]);

  const handleDisplayNameSubmit = (name: string) => {
    sessionStorage.setItem("wbs_display_name", name);
    setDisplayName(name);
  };

  // Gửi trạng thái bảng vẽ hiện tại xuống backend.
  const saveLines = useCallback(
    async (currentLines: DrawEvent[]) => {
      const response = await fetch(apiStateUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lines: currentLines.map((line) => ({
            strokeId: line.strokeId,
            points: line.points,
            color: line.color,
            width: line.width,
          })),
          shapes: shapesRef.current.map(({ roomId: _roomId, ...shape }) => shape),
          texts: textsRef.current.map(({ roomId: _roomId, ...text }) => text),
        }),
      });

      if (!response.ok) {
        throw new Error(`Lưu thất bại: HTTP ${response.status}`);
      }

      return response.json();
    },
    [apiStateUrl]
  );

  const persistLines = useCallback(
    (currentLines: DrawEvent[]) => {
      const nextSave = saveQueueRef.current.then(() => saveLines(currentLines));
      saveQueueRef.current = nextSave.catch(() => undefined);
      return nextSave;
    },
    [saveLines]
  );

  // Tải dữ liệu đã lưu trong PostgreSQL của phòng này.
  const loadLines = useCallback(async () => {
    const versionAtStart = roomVersionRef.current;
    setStorageStatus("Đang tải dữ liệu...");

    try {
      const response = await fetch(apiStateUrl);

      if (!response.ok) {
        throw new Error(`Tải thất bại: HTTP ${response.status}`);
      }

      const result = (await response.json()) as SavedState;

      if (!Array.isArray(result.data?.lines)) {
        throw new Error("Dữ liệu bảng vẽ không hợp lệ");
      }

      if (typeof result.roomVersion === "number") {
        roomVersionRef.current = result.roomVersion;
      }

      // Không khôi phục dữ liệu cũ nếu bảng đã bị xóa trong lúc tải.
      if (versionAtStart !== roomVersionRef.current && result.roomVersion === undefined) {
        return;
      }

      const restoredLines: DrawEvent[] = result.data.lines
        .filter(
          (line) =>
            typeof line.strokeId === "string" &&
            Array.isArray(line.points) &&
            line.points.every(
              (point) => typeof point === "number" && Number.isFinite(point)
            ) &&
            typeof line.color === "string" &&
            typeof line.width === "number"
        )
        .map((line) => ({
          roomId: roomId,
          strokeId: line.strokeId,
          points: line.points,
          color: line.color,
          width: line.width,
          roomVersion: roomVersionRef.current,
        }));
      const restoredShapes: ShapeEvent[] = (result.data.shapes ?? [])
        .filter((shape) =>
          shape && typeof shape.shapeId === "string" &&
          ["RECTANGLE", "CIRCLE", "LINE", "ARROW"].includes(shape.type) &&
          typeof shape.color === "string" && typeof shape.strokeWidth === "number"
        )
        .map((shape) => ({ ...shape, roomId, roomVersion: roomVersionRef.current }));
      const restoredTexts: TextEvent[] = (result.data.texts ?? [])
        .filter((text) =>
          text && typeof text.textId === "string" && typeof text.text === "string" &&
          text.text.length > 0 && typeof text.x === "number" && typeof text.y === "number" &&
          typeof text.color === "string" && typeof text.fontSize === "number"
        )
        .map((text) => ({
          ...text,
          roomId,
          fontFamily: text.fontFamily || "Arial",
          fontStyle: text.fontStyle || "normal",
          align: text.align || "left",
          width: text.width || 0,
          roomVersion: roomVersionRef.current,
        }));

      // Giữ các nét vẽ realtime vừa nhận được trong lúc tải dữ liệu.
      setLines((previous) => {
        const merged = new Map<string, DrawEvent>();

        for (const line of restoredLines) {
          merged.set(line.strokeId, line);
        }

        for (const line of previous) {
          merged.set(line.strokeId, line);
        }

        const nextLines = Array.from(merged.values());
        linesRef.current = nextLines;
        return nextLines;
      });
      setShapes((previous) => {
        const merged = new Map<string, ShapeEvent>();
        for (const shape of restoredShapes) merged.set(shape.shapeId, shape);
        for (const shape of previous) merged.set(shape.shapeId, shape);
        const nextShapes = Array.from(merged.values());
        shapesRef.current = nextShapes;
        return nextShapes;
      });
      setTexts((previous) => {
        const merged = new Map<string, TextEvent>();
        for (const text of restoredTexts) merged.set(text.textId, text);
        for (const text of previous) merged.set(text.textId, text);
        const nextTexts = Array.from(merged.values());
        textsRef.current = nextTexts;
        return nextTexts;
      });

      setStorageStatus(`Đã tải ${restoredLines.length} nét, ${restoredShapes.length} hình và ${restoredTexts.length} văn bản từ PostgreSQL`);
    } catch (error) {
      console.error("Lỗi tải bảng vẽ:", error);
      setStorageStatus("Không tải được dữ liệu đã lưu");
    }
  }, [apiStateUrl, roomId]);

  useEffect(() => {
    if (!displayName) return;

    const client = new Client({
      brokerURL: "ws://localhost:8080/ws",
      reconnectDelay: 3000,

      onConnect: () => {
        setConnected(true);

        // Kênh presence cho phòng
        client.subscribe(`/topic/rooms/${roomId}/presence`, (frame) => {
          try {
            const event = JSON.parse(frame.body) as PresenceUpdateEvent;
            if (
              event &&
              event.type === "PRESENCE_UPDATE" &&
              Array.isArray(event.participants)
            ) {
              setParticipants(event.participants);
              const activeSessionIds = new Set(
                event.participants.map((p) => p.sessionId)
              );
              setRemoteCursors((prev) => {
                let changed = false;
                const next = new Map(prev);
                for (const sessionId of next.keys()) {
                  if (!activeSessionIds.has(sessionId)) {
                    next.delete(sessionId);
                    changed = true;
                  }
                }
                return changed ? next : prev;
              });
            }
          } catch (error) {
            console.error("Lỗi nhận presence:", error);
          }
        });

        // Đăng ký tham gia phòng
        client.publish({
          destination: `/app/rooms/${roomId}/join`,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ displayName }),
        });

        // Kênh cursor cho từng phòng
        client.subscribe(`/topic/rooms/${roomId}/cursor`, (frame) => {
          try {
            const cursor = JSON.parse(frame.body) as CursorEvent;
            if (
              !cursor ||
              cursor.roomId !== roomId ||
              typeof cursor.x !== "number" ||
              typeof cursor.y !== "number" ||
              !cursor.sessionId ||
              cursor.displayName === displayName
            ) {
              return;
            }

            setRemoteCursors((prev) => {
              const next = new Map(prev);
              next.set(cursor.sessionId, { ...cursor, lastUpdated: Date.now() });
              return next;
            });
          } catch (error) {
            console.error("Lỗi nhận cursor:", error);
          }
        });

        // Kênh riêng cho từng phòng
        client.subscribe(`/topic/rooms/${roomId}/draw`, (frame) => {
          try {
            const event = JSON.parse(frame.body) as DrawEvent;

            if (
              event.roomId !== roomId ||
              typeof event.strokeId !== "string" ||
              !Array.isArray(event.points) ||
              !Number.isInteger(event.roomVersion)
            ) {
              return;
            }

            if (event.roomVersion !== roomVersionRef.current) {
              return;
            }

            setLines((previous) => {
              const index = previous.findIndex(
                (line) => line.strokeId === event.strokeId
              );

              if (index === -1) {
                const nextLines = [...previous, event];
                linesRef.current = nextLines;
                return nextLines;
              }

              const updated = [...previous];
              updated[index] = event;
              linesRef.current = updated;
              return updated;
            });

          } catch (error) {
            console.error("Lỗi nhận nét vẽ:", error);
          }
        });

        client.subscribe(`/topic/rooms/${roomId}/shape`, (frame) => {
          try {
            const event = JSON.parse(frame.body) as ShapeEvent;
            if (
              event.roomId !== roomId ||
              typeof event.shapeId !== "string" ||
              !["RECTANGLE", "CIRCLE", "LINE", "ARROW"].includes(event.type) ||
              !Number.isInteger(event.roomVersion) ||
              event.roomVersion !== roomVersionRef.current
            ) return;
            setShapes((previous) => {
              const next = [...previous];
              const index = next.findIndex((shape) => shape.shapeId === event.shapeId);
              if (index === -1) next.push(event);
              else next[index] = event;
              shapesRef.current = next;
              return next;
            });
          } catch (error) {
            console.error("Lỗi nhận hình vẽ:", error);
          }
        });

        client.subscribe(`/topic/rooms/${roomId}/text`, (frame) => {
          try {
            const event = JSON.parse(frame.body) as TextEvent;
            if (
              event.roomId !== roomId ||
              typeof event.textId !== "string" ||
              typeof event.text !== "string" ||
              !Number.isInteger(event.roomVersion) ||
              event.roomVersion !== roomVersionRef.current
            ) return;
            if (event.deleted) {
              const next = textsRef.current.filter((text) => text.textId !== event.textId);
              textsRef.current = next;
              setTexts(next);
              return;
            }
            const normalized: TextEvent = {
              ...event,
              fontFamily: event.fontFamily || "Arial",
              fontStyle: event.fontStyle || "normal",
              align: event.align || "left",
              width: event.width || 0,
            };
            setTexts((previous) => {
              const next = [...previous];
              const index = next.findIndex((text) => text.textId === event.textId);
              if (index === -1) next.push(normalized);
              else next[index] = normalized;
              textsRef.current = next;
              return next;
            });
          } catch (error) {
            console.error("Lỗi nhận văn bản:", error);
          }
        });

        client.subscribe(`/topic/rooms/${roomId}/edit`, (frame) => {
          try {
            const event = JSON.parse(frame.body) as EditEvent;
            if (
              event.roomId !== roomId ||
              !event.objectId ||
              !Number.isInteger(event.roomVersion) ||
              event.roomVersion <= roomVersionRef.current
            ) {
              return;
            }
            roomVersionRef.current = event.roomVersion;
            const object = event.object ?? {};
            if (event.operation === "DELETE") {
              linesRef.current = linesRef.current.filter((line) => line.strokeId !== event.objectId);
              shapesRef.current = shapesRef.current.filter((shape) => shape.shapeId !== event.objectId);
              textsRef.current = textsRef.current.filter((text) => text.textId !== event.objectId);
              setLines(linesRef.current);
              setShapes(shapesRef.current);
              setTexts(textsRef.current);
              setSelectedObjectIds((ids) => ids.filter((id) => id !== event.objectId));
            } else if (event.objectType === "STROKE") {
              const next = linesRef.current.map((line) =>
                line.strokeId === event.objectId ? { ...line, ...object, roomVersion: event.roomVersion } as DrawEvent : line
              );
              linesRef.current = next;
              setLines(next);
            } else if (event.objectType === "TEXT") {
              const next = textsRef.current.map((text) =>
                text.textId === event.objectId ? { ...text, ...object, roomVersion: event.roomVersion } as TextEvent : text
              );
              textsRef.current = next;
              setTexts(next);
            } else {
              const next = shapesRef.current.map((shape) =>
                shape.shapeId === event.objectId ? { ...shape, ...object, roomVersion: event.roomVersion } as ShapeEvent : shape
              );
              shapesRef.current = next;
              setShapes(next);
            }
            void persistLines(linesRef.current).catch((error) => {
              console.error("Lỗi lưu chỉnh sửa realtime:", error);
            });
          } catch (error) {
            console.error("Lỗi nhận chỉnh sửa realtime:", error);
          }
        });

        client.subscribe(`/topic/rooms/${roomId}/edit-conflict`, (frame) => {
          try {
            const event = JSON.parse(frame.body) as { roomId: string; reason: string };
            if (event.roomId === roomId) {
              setStorageStatus(`Chỉnh sửa bị từ chối: ${event.reason}`);
              void loadLines();
            }
          } catch (error) {
            console.error("Lỗi nhận xung đột chỉnh sửa:", error);
          }
        });

        client.subscribe(`/topic/rooms/${roomId}/clear`, (frame) => {
          try {
            const event = JSON.parse(frame.body) as ClearEvent;

            if (
              event.roomId !== roomId ||
              !Number.isInteger(event.roomVersion) ||
              event.roomVersion <= roomVersionRef.current
            ) {
              return;
            }

            roomVersionRef.current = event.roomVersion;
            currentStrokeIdRef.current = null;
            currentPointsRef.current = [];
            setIsDrawing(false);
            linesRef.current = [];
            setLines([]);
            shapesRef.current = [];
            setShapes([]);
            textsRef.current = [];
            setTexts([]);
            undoStackRef.current = [];
            redoStackRef.current = [];
            shapeUndoStackRef.current = [];
            shapeRedoStackRef.current = [];
            textUndoStackRef.current = [];
            textRedoStackRef.current = [];
            setUndoCount(0);
            setRedoCount(0);

            // Lưu trạng thái rỗng để tải lại trang không phục hồi nét đã xóa.
            void persistLines([])
              .then(() => {
                setStorageStatus("Đã xóa và lưu bảng vẽ");
              })
              .catch((error) => {
                console.error("Lỗi lưu trạng thái xóa:", error);
                setStorageStatus(
                  "Đã xóa trên Canvas nhưng chưa lưu được vào PostgreSQL"
                );
              });
          } catch (error) {
            console.error("Lỗi nhận sự kiện xóa:", error);
          }
        });

        client.subscribe(`/topic/rooms/${roomId}/undo`, (frame) => {
          try {
            const event = JSON.parse(frame.body) as UndoRedoEvent;
            if (
              event.roomId !== roomId ||
              !["UNDO", "REDO"].includes(event.action) ||
              (typeof event.shapeId !== "string" && typeof event.textId !== "string" && typeof event.strokeId !== "string") ||
              (typeof event.shapeId !== "string" && typeof event.textId !== "string" && !Array.isArray(event.points)) ||
              !Number.isInteger(event.roomVersion) ||
              event.roomVersion <= roomVersionRef.current
            ) {
              return;
            }

            roomVersionRef.current = event.roomVersion;
            if (event.textId && typeof event.text === "string") {
              const operation: TextEvent = {
                roomId,
                textId: event.textId,
                x: event.x ?? 0,
                y: event.y ?? 0,
                text: event.text,
                color: event.color,
                fontSize: event.fontSize ?? 24,
                fontFamily: event.fontFamily || "Arial",
                fontStyle: event.fontStyle || "normal",
                align: event.align || "left",
                width: event.width ?? 0,
                deleted: event.deleted,
                roomVersion: event.roomVersion,
              };
              const nextTexts = event.deleted
                ? textsRef.current.filter((text) => text.textId !== event.textId)
                : [...textsRef.current.filter((text) => text.textId !== event.textId), operation];
              if (event.action === "UNDO") {
                const local = textUndoStackRef.current.find((text) => text.textId === event.textId);
                if (local) {
                  textUndoStackRef.current = textUndoStackRef.current.filter((text) => text.textId !== event.textId);
                  textRedoStackRef.current.push(local);
                }
              } else {
                const local = textRedoStackRef.current.find((text) => text.textId === event.textId);
                if (local) {
                  textRedoStackRef.current = textRedoStackRef.current.filter((text) => text.textId !== event.textId);
                  textUndoStackRef.current.push(local);
                }
              }
              textsRef.current = nextTexts;
              setTexts(nextTexts);
              setUndoCount(undoStackRef.current.length + shapeUndoStackRef.current.length + textUndoStackRef.current.length);
              setRedoCount(redoStackRef.current.length + shapeRedoStackRef.current.length + textRedoStackRef.current.length);
              void persistLines(linesRef.current).catch((error) => {
                console.error("Lỗi lưu trạng thái undo/redo:", error);
              });
              return;
            }
            if (event.shapeId && event.type) {
              roomVersionRef.current = event.roomVersion;
              const operation: ShapeEvent = {
                roomId, shapeId: event.shapeId, type: event.type,
                x: event.x ?? 0, y: event.y ?? 0, width: event.width ?? 0,
                height: event.height ?? 0, startX: event.startX ?? 0,
                startY: event.startY ?? 0, endX: event.endX ?? 0,
                endY: event.endY ?? 0, radius: event.radius ?? 0,
                color: event.color, strokeWidth: event.strokeWidth ?? event.width ?? 1,
                roomVersion: event.roomVersion,
              };
              const nextShapes = event.action === "UNDO"
                ? shapesRef.current.filter((shape) => shape.shapeId !== event.shapeId)
                : [...shapesRef.current.filter((shape) => shape.shapeId !== event.shapeId), operation];
              if (event.action === "UNDO") {
                const local = shapeUndoStackRef.current.find((shape) => shape.shapeId === event.shapeId);
                if (local) {
                  shapeUndoStackRef.current = shapeUndoStackRef.current.filter((shape) => shape.shapeId !== event.shapeId);
                  shapeRedoStackRef.current.push(local);
                }
              } else {
                const local = shapeRedoStackRef.current.find((shape) => shape.shapeId === event.shapeId);
                if (local) {
                  shapeRedoStackRef.current = shapeRedoStackRef.current.filter((shape) => shape.shapeId !== event.shapeId);
                  shapeUndoStackRef.current.push(local);
                }
              }
              setUndoCount(undoStackRef.current.length + shapeUndoStackRef.current.length + textUndoStackRef.current.length);
              setRedoCount(redoStackRef.current.length + shapeRedoStackRef.current.length + textRedoStackRef.current.length);
              shapesRef.current = nextShapes;
              setShapes(nextShapes);
              void persistLines(linesRef.current).catch((error) => {
                console.error("Lỗi lưu trạng thái undo/redo:", error);
              });
              return;
            }
            const operation: DrawEvent = {
              roomId,
              strokeId: event.strokeId,
              points: event.points,
              color: event.color,
              width: event.width,
              roomVersion: event.roomVersion,
            };

            let nextLines: DrawEvent[] | null = null;
            if (event.action === "UNDO") {
              const localIndex = undoStackRef.current.findIndex(
                (line) => line.strokeId === event.strokeId
              );
              if (localIndex !== -1) {
                const [localOperation] = undoStackRef.current.splice(localIndex, 1);
                redoStackRef.current.push(localOperation);
                setUndoCount(undoStackRef.current.length + shapeUndoStackRef.current.length + textUndoStackRef.current.length);
                setRedoCount(redoStackRef.current.length + shapeRedoStackRef.current.length + textRedoStackRef.current.length);
              }
              nextLines = linesRef.current.filter(
                (line) => line.strokeId !== event.strokeId
              );
            } else {
              const localIndex = redoStackRef.current.findIndex(
                (line) => line.strokeId === event.strokeId
              );
              if (localIndex !== -1) {
                const [localOperation] = redoStackRef.current.splice(localIndex, 1);
                undoStackRef.current.push(localOperation);
                setUndoCount(undoStackRef.current.length + shapeUndoStackRef.current.length + textUndoStackRef.current.length);
                setRedoCount(redoStackRef.current.length + shapeRedoStackRef.current.length + textRedoStackRef.current.length);
              }
              nextLines = linesRef.current.some(
                (line) => line.strokeId === event.strokeId
              )
                ? linesRef.current.map((line) =>
                    line.strokeId === event.strokeId ? operation : line
                  )
                : [...linesRef.current, operation];
            }

            linesRef.current = nextLines;
            setLines(nextLines);
            void persistLines(nextLines).catch((error) => {
              console.error("Lỗi lưu trạng thái undo/redo:", error);
              setStorageStatus("Đã cập nhật Canvas nhưng chưa lưu được vào PostgreSQL");
            });
          } catch (error) {
            console.error("Lỗi nhận sự kiện undo/redo:", error);
          }
        });

        // Chỉ tải sau khi đã đăng ký nhận sự kiện realtime.
        void loadLines();
      },

      onWebSocketClose: () => {
        setConnected(false);
        setParticipants([]);
        setRemoteCursors(new Map());
      },

      onStompError: (frame) => {
        console.error("STOMP error:", frame.headers.message);
      },
    });

    clientRef.current = client;
    void client.activate();

    return () => {
      if (client.connected) {
        try {
          client.publish({
            destination: `/app/rooms/${roomId}/leave`,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          });
        } catch {
          // ignore error when connection is closing
        }
      }
      clientRef.current = null;
      void client.deactivate();
    };
  }, [roomId, displayName, loadLines, persistLines]);

  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  useEffect(() => {
    shapesRef.current = shapes;
  }, [shapes]);

  useEffect(() => {
    textsRef.current = texts;
  }, [texts]);

  // Tự động loại bỏ cursor mất tín hiệu quá 5 giây
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setRemoteCursors((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [sessionId, cursor] of next.entries()) {
          if (cursor.lastUpdated && now - cursor.lastUpdated > 5000) {
            next.delete(sessionId);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  const sendCursorPosition = useCallback(
    (x: number, y: number) => {
      const client = clientRef.current;
      if (!client?.connected) return;

      const now = performance.now();
      if (now - lastCursorSendTimeRef.current < 40) {
        return;
      }

      const last = lastCursorPosRef.current;
      if (last && Math.hypot(x - last.x, y - last.y) < 2) {
        return;
      }

      lastCursorSendTimeRef.current = now;
      lastCursorPosRef.current = { x, y };

      client.publish({
        destination: `/app/rooms/${roomId}/cursor`,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ x, y }),
      });
    },
    [roomId]
  );

  const publishStroke = useCallback(
    (points: number[]) => {
      const client = clientRef.current;
      const strokeId = currentStrokeIdRef.current;

      if (!client?.connected || !strokeId || points.length < 2) {
        return;
      }

      const event: DrawEvent = {
        roomId: roomId,
        strokeId,
        points,
        color: tool === "eraser" ? "#ffffff" : color,
        width: tool === "eraser" ? Math.max(width, 18) : width,
        roomVersion: roomVersionRef.current,
      };

      client.publish({
        destination: "/app/draw",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(event),
      });
    },
    [roomId, tool, color, width]
  );

  const publishShape = useCallback((shape: ShapeEvent) => {
    const client = clientRef.current;
    if (!client?.connected) return;
    client.publish({
      destination: "/app/shape",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(shape),
    });
  }, []);

  const publishText = useCallback((text: TextEvent) => {
    const client = clientRef.current;
    if (!client?.connected) return;
    client.publish({
      destination: "/app/text",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(text),
    });
  }, []);

  const publishEdit = useCallback(
    (operation: "UPDATE" | "DELETE", objectType: EditEvent["objectType"], objectId: string, object?: Record<string, unknown>) => {
      const client = clientRef.current;
      if (!client?.connected) return;
      client.publish({
        destination: "/app/edit",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomId,
          operationId: crypto.randomUUID(),
          transactionId: crypto.randomUUID(),
          operation,
          objectType,
          objectId,
          object,
          baseRoomVersion: roomVersionRef.current,
        }),
      });
    },
    [roomId]
  );

  const selectObject = useCallback((objectId: string, additive: boolean) => {
    setSelectedObjectIds((current) =>
      additive
        ? current.includes(objectId)
          ? current.filter((id) => id !== objectId)
          : [...current, objectId]
        : [objectId]
    );
  }, []);

  const deleteSelected = useCallback(() => {
    if (!clientRef.current?.connected || selectedObjectIds.length === 0) return;
    for (const objectId of selectedObjectIds) {
      const line = linesRef.current.find((item) => item.strokeId === objectId);
      const shape = shapesRef.current.find((item) => item.shapeId === objectId);
      const objectType = line ? "STROKE" : shape ? shape.type : "TEXT";
      publishEdit("DELETE", objectType, objectId);
    }
    linesRef.current = linesRef.current.filter((line) => !selectedObjectIds.includes(line.strokeId));
    shapesRef.current = shapesRef.current.filter((shape) => !selectedObjectIds.includes(shape.shapeId));
    textsRef.current = textsRef.current.filter((text) => !selectedObjectIds.includes(text.textId));
    setLines(linesRef.current);
    setShapes(shapesRef.current);
    setTexts(textsRef.current);
    setSelectedObjectIds([]);
    void persistLines(linesRef.current).catch((error) => {
      console.error("Lỗi lưu xóa đối tượng:", error);
    });
  }, [persistLines, publishEdit, selectedObjectIds]);

  const updateObjectFromNode = useCallback((objectId: string, node: Konva.Node) => {
    const position = node.position();
    const rotation = node.rotation();
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const shape = shapesRef.current.find((item) => item.shapeId === objectId);
    const text = textsRef.current.find((item) => item.textId === objectId);
    const line = linesRef.current.find((item) => item.strokeId === objectId);
    if (shape) {
      const anchorX = shape.type === "CIRCLE" ? shape.startX : 0;
      const anchorY = shape.type === "CIRCLE" ? shape.startY : 0;
      const dx = position.x - anchorX;
      const dy = position.y - anchorY;
      const updated = {
        ...shape,
        x: shape.type === "RECTANGLE" ? position.x : shape.x,
        y: shape.type === "RECTANGLE" ? position.y : shape.y,
        startX: shape.startX + dx,
        startY: shape.type === "CIRCLE" ? shape.startY + dy : shape.startY + dy,
        endX: shape.endX + dx,
        endY: shape.endY + dy,
        width: shape.type === "RECTANGLE" ? Math.max(1, shape.width * scaleX) : shape.width,
        height: shape.type === "RECTANGLE" ? Math.max(1, shape.height * scaleY) : shape.height,
        radius: shape.type === "CIRCLE" ? Math.max(1, shape.radius * Math.max(scaleX, scaleY)) : shape.radius,
        rotation,
        roomVersion: roomVersionRef.current,
      };
      node.scale({ x: 1, y: 1 });
      node.position({ x: 0, y: 0 });
      shapesRef.current = shapesRef.current.map((item) => item.shapeId === objectId ? updated : item);
      setShapes(shapesRef.current);
      publishEdit("UPDATE", shape.type, objectId, {
        x: updated.x, y: updated.y, width: updated.width, height: updated.height,
        startX: updated.startX, startY: updated.startY, endX: updated.endX,
        endY: updated.endY, radius: updated.radius, rotation,
      });
    } else if (text) {
      const updated = { ...text, x: position.x, y: position.y, roomVersion: roomVersionRef.current };
      textsRef.current = textsRef.current.map((item) => item.textId === objectId ? updated : item);
      setTexts(textsRef.current);
      publishEdit("UPDATE", "TEXT", objectId, { x: updated.x, y: updated.y, rotation });
    } else if (line) {
      const dx = position.x;
      const dy = position.y;
      const points = line.points.map((value, index) => value + (index % 2 === 0 ? dx : dy));
      const updated = { ...line, points, rotation: 0, roomVersion: roomVersionRef.current };
      node.position({ x: 0, y: 0 });
      linesRef.current = linesRef.current.map((item) => item.strokeId === objectId ? updated : item);
      setLines(linesRef.current);
      publishEdit("UPDATE", "STROKE", objectId, { points, rotation: 0 });
    }
    void persistLines(linesRef.current).catch((error) => {
      console.error("Lỗi lưu di chuyển đối tượng:", error);
    });
  }, [persistLines, publishEdit]);

  const commitSelectedTransforms = useCallback(() => {
    for (const objectId of selectedObjectIds) {
      const node = nodeRefs.current.get(objectId);
      if (node) updateObjectFromNode(objectId, node);
    }
  }, [selectedObjectIds, updateObjectFromNode]);

  const commitTextEdit = useCallback(() => {
    if (!editingTextId) return;
    const existing = textsRef.current.find((text) => text.textId === editingTextId);
    if (!existing) {
      setEditingTextId(null);
      return;
    }
    const value = editingTextValue.trim();
    if (!value) {
      const deleted: TextEvent = {
        ...existing,
        text: "",
        deleted: true,
        roomVersion: roomVersionRef.current,
      };
      textUndoStackRef.current.push(existing);
      textRedoStackRef.current = [];
      publishText(deleted);
      textsRef.current = textsRef.current.filter((text) => text.textId !== editingTextId);
      setTexts(textsRef.current);
      setEditingTextId(null);
      return;
    }
    const updated: TextEvent = {
      ...existing,
      text: editingTextValue,
      deleted: false,
      roomVersion: roomVersionRef.current,
    };
    textsRef.current = textsRef.current.map((text) =>
      text.textId === editingTextId ? updated : text
    );
    setTexts(textsRef.current);
    textUndoStackRef.current.push(existing);
    textRedoStackRef.current = [];
    setUndoCount(undoStackRef.current.length + shapeUndoStackRef.current.length + textUndoStackRef.current.length);
    setRedoCount(redoStackRef.current.length + shapeRedoStackRef.current.length + textRedoStackRef.current.length);
    publishText(updated);
    void persistLines(linesRef.current).catch((error) => {
      console.error("Lỗi lưu văn bản:", error);
    });
    setEditingTextId(null);
  }, [editingTextId, editingTextValue, persistLines, publishText]);

  const updateEditingText = useCallback(
    (patch: Partial<Pick<TextEvent, "color" | "fontSize" | "align">>) => {
      if (!editingTextId) return;
      const existing = textsRef.current.find((text) => text.textId === editingTextId);
      if (!existing) return;
      const updated = { ...existing, ...patch, roomVersion: roomVersionRef.current };
      textsRef.current = textsRef.current.map((text) =>
        text.textId === editingTextId ? updated : text
      );
      setTexts(textsRef.current);
      textUndoStackRef.current.push(existing);
      textRedoStackRef.current = [];
      publishText(updated);
    },
    [editingTextId, publishText]
  );

  const handleMouseDown = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!clientRef.current?.connected) return;

    const point = e.target.getStage()?.getPointerPosition();
    if (!point) return;

    if (tool === "select") {
      const targetId = (e.target as Konva.Node).getAttr("objectId") as string | undefined;
      if (targetId) {
        selectObject(targetId, "shiftKey" in e.evt && e.evt.shiftKey);
      } else {
        setSelectedObjectIds([]);
      }
      return;
    }

    if (tool === "text") {
      const text: TextEvent = {
        roomId,
        textId: crypto.randomUUID(),
        x: point.x,
        y: point.y,
        text: "Text",
        color,
        fontSize,
        fontFamily: "Arial",
        fontStyle: "normal",
        align: "left",
        width: 0,
        roomVersion: roomVersionRef.current,
      };
      textsRef.current = [...textsRef.current, text];
      setTexts(textsRef.current);
      textUndoStackRef.current.push(text);
      textRedoStackRef.current = [];
      setUndoCount(undoStackRef.current.length + shapeUndoStackRef.current.length + textUndoStackRef.current.length);
      setRedoCount(redoStackRef.current.length + shapeRedoStackRef.current.length + textRedoStackRef.current.length);
      publishText(text);
      setEditingTextId(text.textId);
      setEditingTextValue(text.text);
      return;
    }

    if (tool !== "pen" && tool !== "eraser") {
      const shape: ShapeEvent = {
        roomId, shapeId: crypto.randomUUID(), type: tool.toUpperCase() as ShapeType,
        x: point.x, y: point.y, width: 0, height: 0,
        startX: point.x, startY: point.y, endX: point.x, endY: point.y,
        radius: 1, color, strokeWidth: width, roomVersion: roomVersionRef.current,
      };
      currentShapeRef.current = shape;
      shapesRef.current = [...shapesRef.current, shape];
      setShapes(shapesRef.current);
      shapeUndoStackRef.current.push(shape);
      shapeRedoStackRef.current = [];
      setUndoCount(undoStackRef.current.length + shapeUndoStackRef.current.length + textUndoStackRef.current.length);
      setRedoCount(redoStackRef.current.length + shapeRedoStackRef.current.length + textRedoStackRef.current.length);
      setIsDrawing(true);
      publishShape(shape);
      return;
    }

    const strokeId = crypto.randomUUID();
    const points = [point.x, point.y];

    currentStrokeIdRef.current = strokeId;
    currentPointsRef.current = points;
    setIsDrawing(true);

    const line: DrawEvent = {
      roomId: roomId,
      strokeId,
      points,
      color: tool === "eraser" ? "#ffffff" : color,
      width: tool === "eraser" ? Math.max(width, 18) : width,
      roomVersion: roomVersionRef.current,
    };

    linesRef.current = [...linesRef.current, line];
    setLines(linesRef.current);
    undoStackRef.current.push(line);
    redoStackRef.current = [];
    setUndoCount(undoStackRef.current.length + shapeUndoStackRef.current.length);
    setRedoCount(redoStackRef.current.length + shapeRedoStackRef.current.length);
    publishStroke(points);
  };

  const handleMouseMove = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const point = e.target.getStage()?.getPointerPosition();
    if (!point) return;

    sendCursorPosition(point.x, point.y);

    if (!isDrawing) return;

    if (currentShapeRef.current) {
      const initial = currentShapeRef.current;
      const next: ShapeEvent = {
        ...initial,
        x: Math.min(initial.startX, point.x),
        y: Math.min(initial.startY, point.y),
        width: Math.abs(point.x - initial.startX),
        height: Math.abs(point.y - initial.startY),
        endX: point.x,
        endY: point.y,
        radius: Math.max(1, Math.hypot(point.x - initial.startX, point.y - initial.startY)),
      };
      currentShapeRef.current = next;
      shapesRef.current = shapesRef.current.map((shape) =>
        shape.shapeId === next.shapeId ? next : shape
      );
      setShapes(shapesRef.current);
      publishShape(next);
      return;
    }
    if (!currentStrokeIdRef.current) return;

    // Giảm thiểu lưu lượng và tối ưu cộng tác đồng thời: bỏ qua các điểm di chuyển quá nhỏ (< 2px)
    const pointsArray = currentPointsRef.current;
    if (pointsArray.length >= 2) {
      const lastX = pointsArray[pointsArray.length - 2];
      const lastY = pointsArray[pointsArray.length - 1];
      if (Math.hypot(point.x - lastX, point.y - lastY) < 2) {
        return;
      }
    }

    const points = [...pointsArray, point.x, point.y];
    currentPointsRef.current = points;

    const strokeId = currentStrokeIdRef.current;

    linesRef.current = linesRef.current.map((line) =>
        line.strokeId === strokeId
          ? {
              ...line,
              points,
              color: tool === "eraser" ? "#ffffff" : color,
              width: tool === "eraser" ? Math.max(width, 18) : width,
            }
          : line
    );
    setLines(linesRef.current);

    publishStroke(points);
  };

  const stopDrawing = () => {
    if (editingTextId) return;
    if (currentShapeRef.current) {
      publishShape(currentShapeRef.current);
      currentShapeRef.current = null;
      setIsDrawing(false);
      return;
    }
    if (currentStrokeIdRef.current) {
      publishStroke([...currentPointsRef.current]);
    }

    currentStrokeIdRef.current = null;
    currentPointsRef.current = [];
    setIsDrawing(false);
  };

  const handleSave = async () => {
    if (isSaving) return;

    setIsSaving(true);
    setStorageStatus("Đang lưu vào PostgreSQL...");

    try {
      await persistLines(lines);
      setStorageStatus(`Đã lưu ${lines.length} nét vẽ vào PostgreSQL`);
    } catch (error) {
      console.error("Lỗi lưu bảng vẽ:", error);
      setStorageStatus("Lưu thất bại. Kiểm tra backend và PostgreSQL.");
    } finally {
      setIsSaving(false);
    }
  };

  const clearCanvas = () => {
    const client = clientRef.current;
    if (!client?.connected) return;

    client.publish({
      destination: "/app/clear",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roomId }),
    });
  };

  const requestUndo = useCallback(() => {
    const client = clientRef.current;
    if (!client?.connected || undoStackRef.current.length + shapeUndoStackRef.current.length + textUndoStackRef.current.length === 0) return;

    client.publish({
      destination: "/app/undo",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roomId, requestId: crypto.randomUUID() }),
    });
  }, [roomId]);

  const requestRedo = useCallback(() => {
    const client = clientRef.current;
    if (!client?.connected || redoStackRef.current.length + shapeRedoStackRef.current.length + textRedoStackRef.current.length === 0) return;

    client.publish({
      destination: "/app/redo",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roomId, requestId: crypto.randomUUID() }),
    });
  }, [roomId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key === "Delete" || event.key === "Backspace") && selectedObjectIds.length > 0) {
        event.preventDefault();
        deleteSelected();
        return;
      }
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier || event.altKey) return;

      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.metaKey && event.shiftKey) {
          requestRedo();
        } else {
          requestUndo();
        }
      } else if (event.ctrlKey && event.key.toLowerCase() === "y") {
        event.preventDefault();
        requestRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteSelected, requestRedo, requestUndo, selectedObjectIds.length]);

  const handleLeave = () => {
    const client = clientRef.current;
    if (client?.connected) {
      try {
        client.publish({
          destination: `/app/rooms/${roomId}/leave`,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
      } catch {
        // ignore
      }
    }
    onLeaveRoom();
  };

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!displayName) {
    return <UserNameModal onSubmit={handleDisplayNameSubmit} />;
  }

  return (
    <main className="app">
      <header className="toolbar">
        <div className="toolbar-info">
          <h1>WBS Whiteboard</h1>
          <div className="room-badge-container">
            <span>Phòng: <strong className="room-code-display">{roomId}</strong></span>
            <button
              type="button"
              className="btn-copy-sm"
              onClick={handleCopyRoomId}
              title="Sao chép mã phòng"
            >
              {copied ? "✓ Đã sao chép" : "📋 Sao chép mã"}
            </button>
            <button
              type="button"
              className="btn-leave-room"
              onClick={handleLeave}
              title="Quay về sảnh chờ"
            >
              🚪 Rời phòng
            </button>
          </div>
          <p>
            Trạng thái kết nối:{" "}
            <strong style={{ color: connected ? "green" : "crimson" }}>
              {connected ? "Đã kết nối" : "Đang kết nối..."}
            </strong>
            {" · "}
            <span aria-live="polite">{storageStatus}</span>
          </p>
        </div>

        <div className="toolbar-actions">
          <button onClick={handleSave} disabled={!connected || isSaving} className="btn-action">
            {isSaving ? "Đang lưu..." : "💾 Lưu bảng vẽ"}
          </button>

          <button onClick={clearCanvas} disabled={!connected} className="btn-action btn-danger">
            🗑️ Xóa toàn bộ
          </button>
          <button
            onClick={requestUndo}
            disabled={!connected || undoCount === 0}
            className="btn-action"
            title="Ctrl/Cmd + Z"
          >
            ↶ Undo
          </button>
          <button
            onClick={requestRedo}
            disabled={!connected || redoCount === 0}
            className="btn-action"
            title="Ctrl + Y hoặc Cmd + Shift + Z"
          >
            ↷ Redo
          </button>
        </div>
      </header>

      <section className="drawing-toolbar">
        <button
          className={tool === "select" ? "tool-active" : ""}
          onClick={() => setTool("select")}
        >
          🖱️ Chọn
        </button>
        <button
          className={tool === "pen" ? "tool-active" : ""}
          onClick={() => setTool("pen")}
        >
          ✏️ Bút vẽ
        </button>

        <button
          className={tool === "eraser" ? "tool-active" : ""}
          onClick={() => setTool("eraser")}
        >
          🧹 Tẩy
        </button>
        <button className={tool === "rectangle" ? "tool-active" : ""} onClick={() => setTool("rectangle")}>
          ▭ Rectangle
        </button>
        <button className={tool === "circle" ? "tool-active" : ""} onClick={() => setTool("circle")}>
          ◯ Circle
        </button>
        <button className={tool === "line" ? "tool-active" : ""} onClick={() => setTool("line")}>
          ／ Line
        </button>
        <button className={tool === "arrow" ? "tool-active" : ""} onClick={() => setTool("arrow")}>
          ➜ Arrow
        </button>
        <button className={tool === "text" ? "tool-active" : ""} onClick={() => setTool("text")}>
          T Text
        </button>

        <label>
          Màu:
          <input
            type="color"
            value={color}
            onChange={(e) => {
              setColor(e.target.value);
              if (editingTextId) {
                updateEditingText({ color: e.target.value });
              } else {
                setTool("pen");
              }
            }}
          />
        </label>

        <label>
          Độ dày: {width}px
          <input
            type="range"
            min="1"
            max="20"
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          />
        </label>
        <label>
          Cỡ chữ: {fontSize}px
          <input
            type="range"
            min="8"
            max="96"
            value={fontSize}
            onChange={(e) => {
              const nextFontSize = Number(e.target.value);
              setFontSize(nextFontSize);
              updateEditingText({ fontSize: nextFontSize });
            }}
          />
        </label>
      </section>

      <section className="canvas-container">
        <div className="canvas-wrapper">
          <Stage
            width={Math.max(300, window.innerWidth - 80)}
            height={Math.max(300, window.innerHeight - 260)}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={stopDrawing}
          >
            <Layer>
              {lines.map((line) => (
                <Line
                  key={line.strokeId}
                  ref={(node) => {
                    if (node) nodeRefs.current.set(line.strokeId, node);
                  }}
                  objectId={line.strokeId}
                  points={line.points}
                  stroke={line.color}
                  strokeWidth={line.width}
                  lineCap="round"
                  lineJoin="round"
                  tension={0.3}
                  draggable={tool === "select" && selectedObjectIds.includes(line.strokeId)}
                  onClick={(event) => {
                    if (tool === "select") selectObject(line.strokeId, event.evt.shiftKey);
                  }}
                  onTap={(event) => {
                    if (tool === "select") selectObject(line.strokeId, event.evt.shiftKey);
                  }}
                  onDragEnd={(event) => updateObjectFromNode(line.strokeId, event.target)}
                />
              ))}
              {shapes.map((shape) => {
                if (shape.type === "RECTANGLE") {
                  return <Rect key={shape.shapeId} ref={(node) => { if (node) nodeRefs.current.set(shape.shapeId, node); }} objectId={shape.shapeId} x={shape.x} y={shape.y} width={shape.width} height={shape.height} rotation={shape.rotation ?? 0} stroke={shape.color} strokeWidth={shape.strokeWidth} draggable={tool === "select" && selectedObjectIds.includes(shape.shapeId)} onClick={(event) => { if (tool === "select") selectObject(shape.shapeId, event.evt.shiftKey); }} onTap={(event) => { if (tool === "select") selectObject(shape.shapeId, event.evt.shiftKey); }} onDragEnd={(event) => updateObjectFromNode(shape.shapeId, event.target)} />;
                }
                if (shape.type === "CIRCLE") {
                  return <Circle key={shape.shapeId} ref={(node) => { if (node) nodeRefs.current.set(shape.shapeId, node); }} objectId={shape.shapeId} x={shape.startX} y={shape.startY} radius={shape.radius} rotation={shape.rotation ?? 0} stroke={shape.color} strokeWidth={shape.strokeWidth} draggable={tool === "select" && selectedObjectIds.includes(shape.shapeId)} onClick={(event) => { if (tool === "select") selectObject(shape.shapeId, event.evt.shiftKey); }} onTap={(event) => { if (tool === "select") selectObject(shape.shapeId, event.evt.shiftKey); }} onDragEnd={(event) => updateObjectFromNode(shape.shapeId, event.target)} />;
                }
                if (shape.type === "ARROW") {
                  return <Arrow key={shape.shapeId} ref={(node) => { if (node) nodeRefs.current.set(shape.shapeId, node); }} objectId={shape.shapeId} points={[shape.startX, shape.startY, shape.endX, shape.endY]} stroke={shape.color} fill={shape.color} strokeWidth={shape.strokeWidth} pointerLength={10} pointerWidth={10} draggable={tool === "select" && selectedObjectIds.includes(shape.shapeId)} onClick={(event) => { if (tool === "select") selectObject(shape.shapeId, event.evt.shiftKey); }} onTap={(event) => { if (tool === "select") selectObject(shape.shapeId, event.evt.shiftKey); }} onDragEnd={(event) => updateObjectFromNode(shape.shapeId, event.target)} />;
                }
                return <Line key={shape.shapeId} ref={(node) => { if (node) nodeRefs.current.set(shape.shapeId, node); }} objectId={shape.shapeId} points={[shape.startX, shape.startY, shape.endX, shape.endY]} rotation={shape.rotation ?? 0} stroke={shape.color} strokeWidth={shape.strokeWidth} draggable={tool === "select" && selectedObjectIds.includes(shape.shapeId)} onClick={(event) => { if (tool === "select") selectObject(shape.shapeId, event.evt.shiftKey); }} onTap={(event) => { if (tool === "select") selectObject(shape.shapeId, event.evt.shiftKey); }} onDragEnd={(event) => updateObjectFromNode(shape.shapeId, event.target)} />;
              })}
              {texts.map((text) => (
                <Text
                  key={text.textId}
                  ref={(node) => { if (node) nodeRefs.current.set(text.textId, node); }}
                  objectId={text.textId}
                  x={text.x}
                  y={text.y}
                  rotation={text.rotation ?? 0}
                  text={text.text}
                  fill={text.color}
                  fontSize={text.fontSize}
                  fontFamily={text.fontFamily}
                  fontStyle={text.fontStyle}
                  align={text.align}
                  width={text.width || undefined}
                  lineHeight={1.2}
                  draggable={tool === "select" && selectedObjectIds.includes(text.textId)}
                  onClick={(event) => {
                    if (tool === "select") selectObject(text.textId, event.evt.shiftKey);
                  }}
                  onTap={(event) => {
                    if (tool === "select") selectObject(text.textId, event.evt.shiftKey);
                  }}
                  onDragEnd={(event) => updateObjectFromNode(text.textId, event.target)}
                  onDblClick={() => {
                    setEditingTextId(text.textId);
                    setEditingTextValue(text.text);
                  }}
                  onDblTap={() => {
                    setEditingTextId(text.textId);
                    setEditingTextValue(text.text);
                  }}
                />
              ))}
              <Transformer
                ref={(node) => {
                  transformerRef.current = node;
                }}
                rotateEnabled={selectedObjectIds.length === 1}
                keepRatio={false}
                enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
                onTransformEnd={(event) => {
                  if (selectedObjectIds.length === 1) {
                    updateObjectFromNode(selectedObjectIds[0], event.target);
                  } else {
                    commitSelectedTransforms();
                  }
                }}
                onDragEnd={commitSelectedTransforms}
              />
            </Layer>
            <LiveCursorsLayer cursors={Array.from(remoteCursors.values())} />
          </Stage>
          {editingTextId && (
            <textarea
              autoFocus
              value={editingTextValue}
              onChange={(event) => setEditingTextValue(event.target.value)}
              onBlur={commitTextEdit}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setEditingTextId(null);
                }
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  commitTextEdit();
                }
              }}
              style={{
                position: "absolute",
                left: texts.find((text) => text.textId === editingTextId)?.x ?? 0,
                top: texts.find((text) => text.textId === editingTextId)?.y ?? 0,
                minWidth: 120,
                minHeight: 40,
                fontSize: texts.find((text) => text.textId === editingTextId)?.fontSize ?? fontSize,
                color,
                zIndex: 5,
              }}
            />
          )}
          <ParticipantsPanel
            participants={participants}
            currentUserDisplayName={displayName}
          />
        </div>
      </section>
    </main>
  );
};
