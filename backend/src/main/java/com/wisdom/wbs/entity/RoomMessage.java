package com.wisdom.wbs.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "room_messages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoomMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "room_id", nullable = false)
    private UUID roomId;

    @Column(name = "sender_id")
    private UUID senderId;

    @Column(name = "sender_name", nullable = false)
    private String senderName;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "attachment_url")
    private String attachmentUrl;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "client_message_id")
    private UUID clientMessageId;

    @Column(name = "reply_to_id")
    private UUID replyToId;

    @Builder.Default
    @Column(name = "encryption_mode", nullable = false, length = 20)
    private String encryptionMode = "E2EE_AES_GCM";

    @Builder.Default
    @Column(name = "key_version", nullable = false)
    private Integer keyVersion = 1;

    @Column(name = "edited_at")
    private Instant editedAt;

    @Column(name = "pinned_at")
    private Instant pinnedAt;

    @Column(name = "pinned_by")
    private UUID pinnedBy;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Column(name = "attachment_file_id")
    private UUID attachmentFileId;
}