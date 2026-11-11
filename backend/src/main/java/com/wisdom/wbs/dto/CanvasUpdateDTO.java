package com.wisdom.wbs.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CanvasUpdateDTO {
    private Long roomId;
    private String senderId;
    private String type;        // "DRAW", "UPDATE", "DELETE", "CLEAR", "YJS_SYNC"
    private String payload;     // JSON String của đối tượng Konva hoặc Yjs Base64 delta
    private Long timestamp;
}