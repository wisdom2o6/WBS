package com.wisdom.wbs.dto;

import java.time.LocalDateTime;

public record RoomResponse(
        String roomId,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}

