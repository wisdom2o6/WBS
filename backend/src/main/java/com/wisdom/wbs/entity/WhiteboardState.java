
package com.wisdom.wbs.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "whiteboard_states")
public class WhiteboardState {

    @Id
    @Column(name = "room_id", length = 50, nullable = false)
    private String roomId;

    @Column(name = "data", columnDefinition = "TEXT", nullable = false)
    private String data;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public WhiteboardState() {
    }

    public WhiteboardState(String roomId, String data) {
        this.roomId = roomId;
        this.data = data;
        this.updatedAt = LocalDateTime.now();
    }

    public String getRoomId() {
        return roomId;
    }

    public void setRoomId(String roomId) {
        this.roomId = roomId;
    }

    public String getData() {
        return data;
    }

    public void setData(String data) {
        this.data = data;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
