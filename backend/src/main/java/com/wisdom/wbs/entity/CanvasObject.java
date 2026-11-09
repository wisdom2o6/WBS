package com.wisdom.wbs.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.ZonedDateTime;
import java.util.UUID;

@Entity
@Table(name = "canvas_objects")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CanvasObject {

    @Id
    private String id; // Sử dụng ID trùng với client ID (shape-123456789)

    @Column(name = "room_id", nullable = false)
    private UUID roomId;

    @Column(nullable = false)
    private String type; // RECTANGLE, CIRCLE, FREEHAND, STICKY_NOTE, TEXT, ARROW

    @Column(columnDefinition = "TEXT", nullable = false)
    private String payloadJson; // Chuỗi JSON chứa tọa độ, màu sắc, points, text,...

    @Column(name = "created_at")
    private ZonedDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = ZonedDateTime.now();
    }
}