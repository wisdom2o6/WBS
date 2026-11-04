package com.wisdom.wbs.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "whiteboard_rooms")
public class WhiteboardRoom {

    @Id
    @Column(name = "room_id", length = 50, nullable = false)
    private String roomId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public WhiteboardRoom() {
    }

    public WhiteboardRoom(String roomId) {
        this.roomId = roomId;
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    public WhiteboardRoom(String roomId, LocalDateTime createdAt, LocalDateTime updatedAt) {
        this.roomId = roomId;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public String getRoomId() {
        return roomId;
    }

    public void setRoomId(String roomId) {
        this.roomId = roomId;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}

