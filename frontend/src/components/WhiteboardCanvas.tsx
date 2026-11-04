import React, { useCallback, useEffect, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import { Stage, Layer, Line } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";

type DrawEvent = {
  roomId: string;
  strokeId: string;
  points: number[];
  color: string;
  width: number;
  roomVersion: number;
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
  };
  updatedAt: string;
};

type Tool = "pen" | "eraser";

interface WhiteboardCanvasProps {
  roomId: string;
  onLeaveRoom: () => void;
}

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  roomId,
  onLeaveRoom,
}) => {
  const [lines, setLines] = useState<DrawEvent[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#2563eb");
  const [width, setWidth] = useState(3);
  const [isSaving, setIsSaving] = useState(false);
  const [storageStatus, setStorageStatus] = useState("Chưa tải dữ liệu");
  const [copied, setCopied] = useState(false);

  const clientRef = useRef<Client | null>(null);
  const currentStrokeIdRef = useRef<string | null>(null);
  const currentPointsRef = useRef<number[]>([]);
  const roomVersionRef = useRef(0);

  const apiStateUrl = `http://localhost:8080/api/rooms/${roomId}/state`;

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
        }),
      });

      if (!response.ok) {
        throw new Error(`Lưu thất bại: HTTP ${response.status}`);
      }

      return response.json();
    },
    [apiStateUrl]
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

      // Không khôi phục dữ liệu cũ nếu bảng đã bị xóa trong lúc tải.
      if (versionAtStart !== roomVersionRef.current) {
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

      // Giữ các nét vẽ realtime vừa nhận được trong lúc tải dữ liệu.
      setLines((previous) => {
        const merged = new Map<string, DrawEvent>();

        for (const line of restoredLines) {
          merged.set(line.strokeId, line);
        }

        for (const line of previous) {
          merged.set(line.strokeId, line);
        }

        return Array.from(merged.values());
      });

      setStorageStatus(`Đã tải ${restoredLines.length} nét vẽ từ PostgreSQL`);
    } catch (error) {
      console.error("Lỗi tải bảng vẽ:", error);
      setStorageStatus("Không tải được dữ liệu đã lưu");
    }
  }, [apiStateUrl, roomId]);

  useEffect(() => {
    const client = new Client({
      brokerURL: "ws://localhost:8080/ws",
      reconnectDelay: 3000,

      onConnect: () => {
        setConnected(true);

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
                return [...previous, event];
              }

              const updated = [...previous];
              updated[index] = event;
              return updated;
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
            setLines([]);

            // Lưu trạng thái rỗng để tải lại trang không phục hồi nét đã xóa.
            void saveLines([])
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

        // Chỉ tải sau khi đã đăng ký nhận sự kiện realtime.
        void loadLines();
      },

      onWebSocketClose: () => setConnected(false),

      onStompError: (frame) => {
        console.error("STOMP error:", frame.headers.message);
      },
    });

    clientRef.current = client;
    void client.activate();

    return () => {
      clientRef.current = null;
      void client.deactivate();
    };
  }, [roomId, loadLines, saveLines]);

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

  const handleMouseDown = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!clientRef.current?.connected) return;

    const point = e.target.getStage()?.getPointerPosition();
    if (!point) return;

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

    setLines((previous) => [...previous, line]);
    publishStroke(points);
  };

  const handleMouseMove = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!isDrawing || !currentStrokeIdRef.current) return;

    const point = e.target.getStage()?.getPointerPosition();
    if (!point) return;

    const points = [...currentPointsRef.current, point.x, point.y];
    currentPointsRef.current = points;

    const strokeId = currentStrokeIdRef.current;

    setLines((previous) =>
      previous.map((line) =>
        line.strokeId === strokeId
          ? {
              ...line,
              points,
              color: tool === "eraser" ? "#ffffff" : color,
              width: tool === "eraser" ? Math.max(width, 18) : width,
            }
          : line
      )
    );

    publishStroke(points);
  };

  const stopDrawing = () => {
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
      await saveLines(lines);
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

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

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
              onClick={onLeaveRoom}
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
          </Layer>
        </Stage>
      </section>
    </main>
  );
};
