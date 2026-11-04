package com.wisdom.wbs.dto;

public record CursorEvent(
        String roomId,
        String sessionId,
        String displayName,
        double x,
        double y
) {}

