package com.wisdom.wbs.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CanvasDrawEvent {
    private String roomId;
    private String senderUsername;
    private String type; // 'RECTANGLE', 'CIRCLE', 'FREEHAND', 'STICKY_NOTE', 'TEXT', 'ARROW', 'ERASER', 'UPDATE'
    private Object payload;
}