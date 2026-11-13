package com.wisdom.wbs.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatEventDto {
    private String type; // CREATED, UPDATED, DELETED, PINNED, REACTED
    private ChatMessageDTO payload;
}