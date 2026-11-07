import React from "react";
import { Layer, Group, Path, Rect, Text } from "react-konva";
import type { CursorEvent } from "../types/cursor";
import { getParticipantColor } from "../utils/colors";

interface LiveCursorsLayerProps {
  cursors: CursorEvent[];
}

export const LiveCursorsLayer: React.FC<LiveCursorsLayerProps> = ({ cursors }) => {
  return (
    <Layer name="export-excluded" listening={false}>
      {cursors.map((cursor) => {
        const color = getParticipantColor(cursor.displayName);
        const nameLength = cursor.displayName ? cursor.displayName.length : 4;
        const badgeWidth = Math.max(36, nameLength * 7.5 + 10);

        return (
          <Group key={cursor.sessionId} x={cursor.x} y={cursor.y}>
            {/* SVG Cursor Pointer Arrow */}
            <Path
              data="M0,0 L0,16 L4.5,12.5 L8.5,21 L11.5,19.5 L7.5,11 L13,11 Z"
              fill={color}
              stroke="#ffffff"
              strokeWidth={1}
            />

            {/* Display Name Pill */}
            <Rect
              x={14}
              y={10}
              width={badgeWidth}
              height={18}
              fill={color}
              cornerRadius={4}
              opacity={0.92}
            />

            {/* Display Name Text */}
            <Text
              x={19}
              y={14}
              text={cursor.displayName}
              fontSize={10}
              fill="#ffffff"
              fontStyle="bold"
            />
          </Group>
        );
      })}
    </Layer>
  );
};
