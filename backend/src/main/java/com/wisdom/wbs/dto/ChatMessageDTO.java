package com.wisdom.wbs.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessageDTO {
    // --- Trường tương thích ngược với code cũ & RoomWorkspace.tsx ---
    private String id;
    private String roomId;
    private String senderId;
    private String senderName;
    private String content;
    private String attachmentUrl;
    private String timestamp;

    // --- Trường mở rộng Phase 5 (ChatPanel.tsx) ---
    private UUID clientMessageId;
    private String senderUsername;
    private String message;
    private UUID replyToId;
    private String replyTo;
    private UUID attachmentFileId;

    private String encryptionMode;
    private Integer keyVersion;
    private List<ReactionGroupDto> reactions;
    private AttachmentDto attachment;

    @Builder.Default
    private Boolean pinned = false;

    @Builder.Default
    private Boolean edited = false;

    @Builder.Default
    private Boolean deleted = false;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ReactionGroupDto {
        private String icon;
        private List<String> users;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class AttachmentDto {
        private String id;
        private String name;
        private String url;
        private String type;
    }
}