package com.wisdom.wbs.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PresencePayload {
    private Long roomId;
    private String userId;
    private String username;
    private String avatarUrl;
    private String color;       // Màu sắc hiển thị con trỏ chuột của user
    private double x;
    private double y;
    private String currentTool; // "pen", "select", "rectangle", "text"...
    private String status;      // "JOINED", "MOVING", "LEFT"
}