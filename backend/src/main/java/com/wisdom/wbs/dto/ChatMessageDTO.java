package com.wisdom.wbs.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessageDTO {
    private String roomId;
    private String senderId;
    private String senderName;
    private String senderAvatar;
    private String content;
    private String attachmentUrl;
    private String timestamp;
}