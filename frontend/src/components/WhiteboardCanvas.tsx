import React, { useCallback, useEffect, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import { Stage, Layer, Line, Rect, Circle, Arrow } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
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
  };
  roomVersion?: number;
  updatedAt: string;
};

type Tool = "pen" | "eraser" | "rectangle" | "circle" | "line" | "arrow";

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
  const [isDrawing, setIsDrawing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#2563eb");
  const [width, setWidth] = useState(3);
  const [isSaving, setIsSaving] = useState(false);
  const [storageStatus, setStorageStatus] = useState("Chưa tải dữ liệu");
  const [copied, setCopied] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

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
  const linesRef = useRef<DrawEvent[]>([]);
  const shapesRef = useRef<ShapeEvent[]>([]);
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  const apiStateUrl = `http://localhost:8080/api/rooms/${roomId}/state`;

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

      setStorageStatus(`Đã tải ${restoredLines.length} nét và ${restoredShapes.length} hình từ PostgreSQL`);
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
          } catch (error) {
            console.error("Lỗi nhận nét vẽ:", error);
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
            undoStackRef.current = [];
            redoStackRef.current = [];
            shapeUndoStackRef.current = [];
            shapeRedoStackRef.current = [];
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
              (typeof event.shapeId !== "string" && typeof event.strokeId !== "string") ||
              (typeof event.shapeId !== "string" && !Array.isArray(event.points)) ||
              !Number.isInteger(event.roomVersion) ||
              event.roomVersion <= roomVersionRef.current
            ) {
              return;
            }

            roomVersionRef.current = event.roomVersion;
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
              setUndoCount(undoStackRef.current.length + shapeUndoStackRef.current.length);
              setRedoCount(redoStackRef.current.length + shapeRedoStackRef.current.length);
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
                setUndoCount(undoStackRef.current.length + shapeUndoStackRef.current.length);
                setRedoCount(redoStackRef.current.length + shapeRedoStackRef.current.length);
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
                setUndoCount(undoStackRef.current.length + shapeUndoStackRef.current.length);
                setRedoCount(redoStackRef.current.length + shapeRedoStackRef.current.length);
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

  const handleMouseDown = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!clientRef.current?.connected) return;

    const point = e.target.getStage()?.getPointerPosition();
    if (!point) return;

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
      setUndoCount(undoStackRef.current.length + shapeUndoStackRef.current.length);
      setRedoCount(redoStackRef.current.length);
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
    if (!client?.connected || undoStackRef.current.length + shapeUndoStackRef.current.length === 0) return;

    client.publish({
      destination: "/app/undo",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roomId, requestId: crypto.randomUUID() }),
    });
  }, [roomId]);

  const requestRedo = useCallback(() => {
    const client = clientRef.current;
    if (!client?.connected || redoStackRef.current.length + shapeRedoStackRef.current.length === 0) return;

    client.publish({
      destination: "/app/redo",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roomId, requestId: crypto.randomUUID() }),
    });
  }, [roomId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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
  }, [requestRedo, requestUndo]);

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

        <label>
          Màu:
          <input
            type="color"
            value={color}
            onChange={(e) => {
              setColor(e.target.value);
              setTool("pen");
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
                  points={line.points}
                  stroke={line.color}
                  strokeWidth={line.width}
                  lineCap="round"
                  lineJoin="round"
                  tension={0.3}
                />
              ))}
              {shapes.map((shape) => {
                if (shape.type === "RECTANGLE") {
                  return <Rect key={shape.shapeId} x={shape.x} y={shape.y} width={shape.width} height={shape.height} stroke={shape.color} strokeWidth={shape.strokeWidth} />;
                }
                if (shape.type === "CIRCLE") {
                  return <Circle key={shape.shapeId} x={shape.startX} y={shape.startY} radius={shape.radius} stroke={shape.color} strokeWidth={shape.strokeWidth} />;
                }
                if (shape.type === "ARROW") {
                  return <Arrow key={shape.shapeId} points={[shape.startX, shape.startY, shape.endX, shape.endY]} stroke={shape.color} fill={shape.color} strokeWidth={shape.strokeWidth} pointerLength={10} pointerWidth={10} />;
                }
                return <Line key={shape.shapeId} points={[shape.startX, shape.startY, shape.endX, shape.endY]} stroke={shape.color} strokeWidth={shape.strokeWidth} />;
              })}
            </Layer>
            <LiveCursorsLayer cursors={Array.from(remoteCursors.values())} />
          </Stage>
          <ParticipantsPanel
            participants={participants}
            currentUserDisplayName={displayName}
          />
        </div>
      </section>
    </main>
  );
};
