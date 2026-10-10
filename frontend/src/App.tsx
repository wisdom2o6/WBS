
import { useState } from "react";
import { Stage, Layer, Line } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import "./App.css";

type DrawLine = {
  points: number[];
  color: string;
  width: number;
};

function App() {
  const [lines, setLines] = useState<DrawLine[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const handleMouseDown = (
    e: KonvaEventObject<MouseEvent | TouchEvent>
  ) => {
    const stage = e.target.getStage();
    if (!stage) return;

    const point = stage.getPointerPosition();
    if (!point) return;

    setLines((prev) => [
      ...prev,
      {
        points: [point.x, point.y],
        color: "#2563eb",
        width: 3,
      },
    ]);

    setIsDrawing(true);
  };

  const handleMouseMove = (
    e: KonvaEventObject<MouseEvent | TouchEvent>
  ) => {
    if (!isDrawing) return;

    const stage = e.target.getStage();
    const point = stage?.getPointerPosition();
    if (!point) return;

    setLines((prev) => {
      if (prev.length === 0) return prev;

      const updated = [...prev];
      const last = updated[updated.length - 1];

      updated[updated.length - 1] = {
        ...last,
        points: [...last.points, point.x, point.y],
      };

      return updated;
    });
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearCanvas = () => setLines([]);

  return (
    <main className="app">
      <header className="toolbar">
        <div>
          <h1>WBS Whiteboard</h1>
          <p>Real-time Collaborative Whiteboard</p>
        </div>

        <button onClick={clearCanvas}>Clear canvas</button>
      </header>

      <section className="canvas-container">
        <Stage
          width={window.innerWidth - 48}
          height={window.innerHeight - 140}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={stopDrawing}
        >
          <Layer>
            {lines.map((line, index) => (
              <Line
                key={index}
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
}

export default App;
