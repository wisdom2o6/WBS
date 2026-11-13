package com.wisdom.wbs.dto;

import lombok.Data;
import java.util.UUID;

@Data
public class ChatSendRequest {
    private UUID clientMessageId;
    private String message;
    private UUID replyToId;
    private UUID attachmentFileId;
    private String encryptionMode;
    private Integer keyVersion;
}