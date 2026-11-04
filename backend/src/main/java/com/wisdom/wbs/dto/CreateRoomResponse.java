package com.wisdom.wbs.dto;

import java.time.LocalDateTime;

public record CreateRoomResponse(
        String roomId,
        String message,
        LocalDateTime createdAt
) {
}

