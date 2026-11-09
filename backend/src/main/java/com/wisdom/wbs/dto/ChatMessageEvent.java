package com.wisdom.wbs.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.ZonedDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessageEvent {
    private String roomId;
    private String senderUsername;
    private String message;
    private String timestamp;
}