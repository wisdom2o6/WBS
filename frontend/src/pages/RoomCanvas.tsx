import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Stage, Layer, Rect, Circle, Line, Text, Group, Arrow, Transformer, Image as KonvaImage } from 'react-konva';
import jsPDF from 'jspdf';

interface ChatMessage {
  senderUsername: string;
  message: string;
  timestamp: string;
}

interface Shape {
  id: string;
  type: 'RECTANGLE' | 'CIRCLE' | 'FREEHAND' | 'STICKY_NOTE' | 'TEXT' | 'ARROW' | 'IMAGE';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radius?: number;
  points?: number[];
  text?: string;
  imageUrl?: string;
  color: string;
  strokeWidth?: number;
}

interface UserCursor {
  username: string;
  x: number;
  y: number;
  color: string;
  lastActive?: number;
}

// Component phụ render Ảnh trên Konva Canvas
const URLImage: React.FC<{ shape: Shape; isDraggable: boolean; onDragEnd: any; onClick: any; onMouseEnter: any }> = ({ shape, isDraggable, onDragEnd, onClick, onMouseEnter }) => {
  const [image, setImage] = useState<HTMLImageElement | undefined>(undefined);

  useEffect(() => {
    if (!shape.imageUrl) return;
    const img = new window.Image();
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
      draggable={isDraggable}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    />
  );
};

export const RoomCanvas: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { token, user } = useAuth();
  const navigate = useNavigate();

  // State Pan & Zoom (Infinite Canvas)
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  const [tool, setTool] = useState<'SELECT' | 'FREEHAND' | 'RECTANGLE' | 'CIRCLE' | 'STICKY_NOTE' | 'TEXT' | 'ARROW' | 'ERASER'>('FREEHAND');
  const [color, setColor] = useState('#0052cc');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Chat & File Upload State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stompClientRef = useRef<Client | null>(null);
  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);

  const [cursors, setCursors] = useState<{ [key: string]: UserCursor }>({});
  const lastCursorSend = useRef<number>(0);

  const getUserColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const c = (hash & 0x00ffffff).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
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
    if (!token || !roomId) return;

    const client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws-visual-workspace'),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => {
        // 1. Subscribe nét vẽ
        client.subscribe(`/topic/room.${roomId}`, (message) => {
          const drawEvent = JSON.parse(message.body);
          if (drawEvent.senderUsername !== user?.username) {
            if (drawEvent.type === 'ERASER') {
              setShapes((prev) => prev.filter((s) => s.id !== drawEvent.payload.id));
            } else if (drawEvent.type === 'UPDATE') {
              setShapes((prev) => prev.map((s) => (s.id === drawEvent.payload.id ? drawEvent.payload : s)));
            } else {
              setShapes((prev) => [...prev, drawEvent.payload]);
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
        client.subscribe('/topic/presence', (message) => {
          const event = JSON.parse(message.body);
          if (event.type === 'LEAVE' && event.username) {
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
    });

    client.activate();
    stompClientRef.current = client;
    return () => { client.deactivate(); };
  }, [roomId, token, user?.username]);

  useEffect(() => {
    if (tool === 'SELECT' && selectedId && transformerRef.current && stageRef.current) {
      const selectedNode = stageRef.current.findOne('#' + selectedId);
      if (selectedNode) {
        transformerRef.current.nodes([selectedNode]);
        transformerRef.current.getLayer().batchDraw();
      }
    }
  }, [selectedId, tool]);

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
    if (!roomId || !token) return;

    const fetchCanvasHistory = async () => {
      try {
        const res = await axios.get(`http://localhost:8080/api/v1/rooms/${roomId}/canvas`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (Array.isArray(res.data)) {
          setShapes(res.data);
        }
      } catch (err) {
        console.error('Lỗi khi tải lịch sử Canvas:', err);
      }
    };

    fetchCanvasHistory();
  }, [roomId, token]);

  // Bắt phím Spacebar để Pan Canvas
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isSpacePressed) {
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSpacePressed]);

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
    if (stompClientRef.current?.connected && roomId) {
      stompClientRef.current.publish({
        destination: `/app/room.${roomId}.draw`,
        body: JSON.stringify({ roomId, type: eventType, payload }),
      });
    }
  };

  const handleSendMessage = () => {
    if (!chatInput.trim() || !stompClientRef.current?.connected || !roomId) return;
    stompClientRef.current.publish({
      destination: `/app/room.${roomId}.chat`,
      body: JSON.stringify({ message: chatInput }),
    });
    setChatInput('');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post('http://localhost:8080/api/v1/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
      });

      const imageUrl = res.data.url;
      const stage = stageRef.current;
      const pos = getRelativePointerPosition(stage);

      const newId = `shape-${Date.now()}`;
      const imgShape: Shape = {
        id: newId,
        type: 'IMAGE',
        x: pos.x || 100,
        y: pos.y || 100,
        width: 250,
        height: 250,
        imageUrl: imageUrl,
        color: 'transparent',
      };

      setShapes((prev) => [...prev, imgShape]);
      broadcastEvent('IMAGE', imgShape);
      e.target.value = '';
    } catch (err) {
      console.error('Lỗi khi upload ảnh:', err);
      alert('Không thể tải ảnh lên server');
    }
  };

  const executeErase = (targetNode: any) => {
    if (!targetNode || tool !== 'ERASER') return;
    let idToDelete = targetNode.id();
    if (!idToDelete && targetNode.getParent()) {
      idToDelete = targetNode.getParent().id();
    }
    if (idToDelete) {
      setShapes((prev) => prev.filter((s) => s.id !== idToDelete));
      broadcastEvent('ERASER', { id: idToDelete });
    }
  };

  const handleMouseDown = (e: any) => {
    if (isSpacePressed) return; // Nếu đang đè Spacebar để Pan thì không vẽ

    setIsMouseDown(true);
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) setSelectedId(null);

    if (tool === 'ERASER') {
      if (!clickedOnEmpty) executeErase(e.target);
      return;
    }

    if (tool === 'SELECT') return;

    const pos = getRelativePointerPosition(stageRef.current);
    const newId = `shape-${Date.now()}`;

    if (tool === 'FREEHAND') {
      setShapes((prev) => [...prev, { id: newId, type: 'FREEHAND', points: [pos.x, pos.y], color, strokeWidth }]);
    } else if (tool === 'RECTANGLE') {
      setShapes((prev) => [...prev, { id: newId, type: 'RECTANGLE', x: pos.x, y: pos.y, width: 0, height: 0, color, strokeWidth }]);
    } else if (tool === 'CIRCLE') {
      setShapes((prev) => [...prev, { id: newId, type: 'CIRCLE', x: pos.x, y: pos.y, radius: 0, color, strokeWidth }]);
    } else if (tool === 'ARROW') {
      setShapes((prev) => [...prev, { id: newId, type: 'ARROW', points: [pos.x, pos.y, pos.x, pos.y], color, strokeWidth }]);
    } else if (tool === 'STICKY_NOTE') {
      const content = prompt('Nhập nội dung Sticky Note:', 'Idea...');
      if (!content) { setIsMouseDown(false); return; }
      const noteShape: Shape = { id: newId, type: 'STICKY_NOTE', x: pos.x, y: pos.y, width: 160, height: 160, text: content, color: '#fef08a', strokeWidth: 1 };
      setShapes((prev) => [...prev, noteShape]);
      broadcastEvent('STICKY_NOTE', noteShape);
      setIsMouseDown(false);
    } else if (tool === 'TEXT') {
      const content = prompt('Nhập văn bản:', 'Text...');
      if (!content) { setIsMouseDown(false); return; }
      const textShape: Shape = { id: newId, type: 'TEXT', x: pos.x, y: pos.y, text: content, color, strokeWidth: 1 };
      setShapes((prev) => [...prev, textShape]);
      broadcastEvent('TEXT', textShape);
      setIsMouseDown(false);
    }
  };

  const handleMouseMove = (e: any) => {
    const stage = stageRef.current;
    if (stage) {
      const relPos = getRelativePointerPosition(stage);
      const now = Date.now();
      if (now - lastCursorSend.current > 30 && stompClientRef.current?.connected && roomId) {
        lastCursorSend.current = now;
        stompClientRef.current.publish({
          destination: `/app/room.${roomId}.cursor`,
          body: JSON.stringify({ x: relPos.x, y: relPos.y }),
        });
      }
    }

    if (!isMouseDown || isSpacePressed) return;

    if (tool === 'ERASER') {
      executeErase(e.target);
      return;
    }

    if (tool === 'SELECT' || tool === 'STICKY_NOTE' || tool === 'TEXT') return;

    const pos = getRelativePointerPosition(stage);
    const lastIndex = shapes.length - 1;
    if (lastIndex < 0) return;

    const updated = [...shapes];
    const curr = { ...updated[lastIndex] };

    if (tool === 'FREEHAND' && curr.points) {
      curr.points = curr.points.concat([pos.x, pos.y]);
    } else if (tool === 'RECTANGLE' && curr.x !== undefined && curr.y !== undefined) {
      curr.width = pos.x - curr.x;
      curr.height = pos.y - curr.y;
    } else if (tool === 'CIRCLE' && curr.x !== undefined && curr.y !== undefined) {
      const dx = pos.x - curr.x;
      const dy = pos.y - curr.y;
      curr.radius = Math.sqrt(dx * dx + dy * dy);
    } else if (tool === 'ARROW' && curr.points) {
      curr.points = [curr.points[0], curr.points[1], pos.x, pos.y];
    }

    updated[lastIndex] = curr;
    setShapes(updated);
  };

  const handleMouseUp = () => {
    if (!isMouseDown) return;
    setIsMouseDown(false);
    if (tool !== 'ERASER' && tool !== 'SELECT' && tool !== 'STICKY_NOTE' && tool !== 'TEXT') {
      const lastShape = shapes[shapes.length - 1];
      if (lastShape) {
        broadcastEvent(lastShape.type, lastShape);
      }
    }
  };

  const handleDragEnd = (e: any, shape: Shape) => {
    const updatedShape = { ...shape, x: e.target.x(), y: e.target.y() };
    setShapes((prev) => prev.map((s) => (s.id === shape.id ? updatedShape : s)));
    broadcastEvent('UPDATE', updatedShape);
  };

  const handleShapeHover = (e: any) => {
    if (tool === 'ERASER' && isMouseDown) {
      executeErase(e.target);
    }
  };

  const handleExportPNG = () => {
  const stage = stageRef.current;
  if (!stage) return;

  // Tạm thời ẩn Transformer selector nếu đang chọn shape
  setSelectedId(null);

  setTimeout(() => {
    // Xuất hình ảnh với độ phân giải cao (pixelRatio: 2)
    const dataURL = stage.toDataURL({ pixelRatio: 2 });
    const link = document.createElement('a');
    link.download = `canvas-room-${roomId}-${Date.now()}.png`;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, 50);
};

  const handleExportPDF = () => {
  const stage = stageRef.current;
  if (!stage) return;

  setSelectedId(null);

  setTimeout(() => {
    const dataURL = stage.toDataURL({ pixelRatio: 2 });
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [stage.width(), stage.height()],
    });

    pdf.addImage(dataURL, 'PNG', 0, 0, stage.width(), stage.height());
    pdf.save(`canvas-room-${roomId}-${Date.now()}.pdf`);
  }, 50);
};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8f9fa', position: 'relative' }}>
      {/* Header Toolbar */}
      <div style={{ padding: '0.6rem 1.2rem', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate('/dashboard')} style={{ padding: '6px 12px', background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>← Dashboard</button>
          <h4 style={{ margin: 0 }}>Phòng: <span style={{ color: '#2563eb' }}>{roomId}</span></h4>
        </div>

        {/* Tools Selector */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
          {[
            { id: 'SELECT', label: '👆 Chọn' },
            { id: 'FREEHAND', label: '✏️ Bút' },
            { id: 'RECTANGLE', label: '🔲 Chữ nhật' },
            { id: 'CIRCLE', label: '⚪ Tròn' },
            { id: 'ARROW', label: '↗️ Mũi tên' },
            { id: 'STICKY_NOTE', label: '🟨 Sticky Note' },
            { id: 'TEXT', label: '🔤 Chữ' },
            { id: 'ERASER', label: '🧹 Tẩy kéo xóa' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => { setTool(t.id as any); setSelectedId(null); }}
              style={{
                padding: '6px 12px',
                background: tool === t.id ? '#2563eb' : 'transparent',
                color: tool === t.id ? '#fff' : '#334155',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '13px',
              }}
            >
              {t.label}
            </button>
          ))}

          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ padding: '6px 12px', background: '#ec4899', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500, fontSize: '13px' }}
          >
            🖼️ Chèn Ảnh
          </button>
          <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" style={{ display: 'none' }} />
        </div>

        {/* Dynamic Online Users & Controls */}
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          {/* Zoom Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', fontSize: '13px' }}>
            <span>🔍 {Math.round(stageScale * 100)}%</span>
            <button
              onClick={() => { setStageScale(1); setStagePos({ x: 0, y: 0 }); }}
              style={{ padding: '2px 6px', background: '#cbd5e1', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
            >
              Reset
            </button>
          </div>

          {/* Widget Danh sách Online */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#f1f5f9', padding: '4px 10px', borderRadius: '20px' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Online:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#2563eb', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80' }}></span>
              {user?.username} (Bạn)
            </div>
            {Object.values(cursors).map((c) => (
              <div key={c.username} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: c.color, color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80' }}></span>
                {c.username}
              </div>
            ))}
          </div>

          <label style={{ fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Độ dày:
            <input type="range" min="1" max="10" value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} style={{ width: '70px' }} />
          </label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: '32px', height: '32px', border: 'none', cursor: 'pointer', background: 'transparent' }} />
        </div>

        {/* Export Toolbar Button */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <button
            onClick={handleExportPNG}
            style={{
              padding: '6px 10px',
              background: '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '12px',
            }}
          >
            📥 PNG
          </button>
          <button
            onClick={handleExportPDF}
            style={{
              padding: '6px 10px',
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '12px',
            }}
          >
            📄 PDF
          </button>
        </div>
      </div>

      {/* Stage Container */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Stage
          ref={stageRef}
          width={window.innerWidth}
          height={window.innerHeight - 60}
          x={stagePos.x}
          y={stagePos.y}
          scaleX={stageScale}
          scaleY={stageScale}
          draggable={isSpacePressed || tool === 'SELECT'}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDragEnd={(e) => {
            if (e.target === stageRef.current) {
              setStagePos({ x: e.target.x(), y: e.target.y() });
            }
          }}
          style={{ cursor: isSpacePressed ? 'grab' : 'default' }}
        >
          <Layer>
            {/* Shapes */}
            {shapes.map((s) => {
              const isDraggable = tool === 'SELECT' && !isSpacePressed;
              if (s.type === 'FREEHAND' && s.points) {
                return <Line key={s.id} id={s.id} points={s.points} stroke={s.color} strokeWidth={s.strokeWidth || 3} tension={0.5} lineCap="round" lineJoin="round" draggable={isDraggable} onDragEnd={(e) => handleDragEnd(e, s)} onClick={() => setSelectedId(s.id)} onMouseEnter={handleShapeHover} />;
              } else if (s.type === 'RECTANGLE') {
                return <Rect key={s.id} id={s.id} x={s.x} y={s.y} width={s.width} height={s.height} stroke={s.color} strokeWidth={s.strokeWidth || 2} fill={`${s.color}22`} draggable={isDraggable} onDragEnd={(e) => handleDragEnd(e, s)} onClick={() => setSelectedId(s.id)} onMouseEnter={handleShapeHover} />;
              } else if (s.type === 'CIRCLE') {
                return <Circle key={s.id} id={s.id} x={s.x} y={s.y} radius={s.radius} stroke={s.color} strokeWidth={s.strokeWidth || 2} fill={`${s.color}22`} draggable={isDraggable} onDragEnd={(e) => handleDragEnd(e, s)} onClick={() => setSelectedId(s.id)} onMouseEnter={handleShapeHover} />;
              } else if (s.type === 'ARROW' && s.points) {
                return <Arrow key={s.id} id={s.id} points={s.points} stroke={s.color} fill={s.color} strokeWidth={s.strokeWidth || 3} pointerLength={10} pointerWidth={10} draggable={isDraggable} onDragEnd={(e) => handleDragEnd(e, s)} onClick={() => setSelectedId(s.id)} onMouseEnter={handleShapeHover} />;
              } else if (s.type === 'STICKY_NOTE') {
                return (
                  <Group key={s.id} id={s.id} x={s.x} y={s.y} draggable={isDraggable} onDragEnd={(e) => handleDragEnd(e, s)} onClick={() => setSelectedId(s.id)} onMouseEnter={handleShapeHover}>
                    <Rect width={s.width || 160} height={s.height || 160} fill="#fef08a" shadowBlur={5} shadowOpacity={0.2} cornerRadius={4} stroke="#eab308" strokeWidth={1} />
                    <Text text={s.text} x={12} y={12} width={136} fontSize={14} fontFamily="sans-serif" fill="#713f12" wrap="word" />
                  </Group>
                );
              } else if (s.type === 'TEXT') {
                return <Text key={s.id} id={s.id} x={s.x} y={s.y} text={s.text} fontSize={18} fontFamily="sans-serif" fill={s.color} draggable={isDraggable} onDragEnd={(e) => handleDragEnd(e, s)} onClick={() => setSelectedId(s.id)} onMouseEnter={handleShapeHover} />;
              } else if (s.type === 'IMAGE') {
                return <URLImage key={s.id} shape={s} isDraggable={isDraggable} onDragEnd={(e: any) => handleDragEnd(e, s)} onClick={() => setSelectedId(s.id)} onMouseEnter={handleShapeHover} />;
              }
              return null;
            })}

            {tool === 'SELECT' && selectedId && !isSpacePressed && <Transformer ref={transformerRef} />}

            {/* Live Cursors */}
            {Object.values(cursors).map((c) => (
              <Group key={c.username} x={c.x} y={c.y}>
                <Arrow points={[0, 0, 0, 14, 4, 10, 10, 16, 13, 14, 7, 8, 14, 8]} fill={c.color} stroke="#ffffff" strokeWidth={1} />
                <Rect x={12} y={12} width={c.username.length * 8 + 12} height={20} fill={c.color} cornerRadius={4} />
                <Text x={18} y={16} text={c.username} fontSize={11} fill="#ffffff" fontStyle="bold" />
              </Group>
            ))}
          </Layer>
        </Stage>
      </div>

      {/* Floating Chat Widget */}
      <div style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 10 }}>
        {!isChatOpen ? (
          <button
            onClick={() => setIsChatOpen(true)}
            style={{ padding: '12px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '30px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
          >
            💬 Chat Room ({messages.length})
          </button>
        ) : (
          <div style={{ width: '320px', height: '400px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '12px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: '#2563eb', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold' }}>
              <span>💬 Room Chat</span>
              <button onClick={() => setIsChatOpen(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>

            <div style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {messages.map((m, idx) => (
                <div key={idx} style={{ alignSelf: m.senderUsername === user?.username ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                  <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px', textAlign: m.senderUsername === user?.username ? 'right' : 'left' }}>
                    {m.senderUsername} • {m.timestamp}
                  </div>
                  <div style={{ padding: '8px 12px', borderRadius: '12px', background: m.senderUsername === user?.username ? '#2563eb' : '#f1f5f9', color: m.senderUsername === user?.username ? '#fff' : '#1e293b', fontSize: '13px' }}>
                    {m.message}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: '8px 10px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '6px' }}>
              <input
                type="text"
                placeholder="Nhập tin nhắn..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                style={{ flex: 1, padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
              />
              <button onClick={handleSendMessage} style={{ padding: '8px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Gửi</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};