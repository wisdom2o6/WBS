package com.wisdom.wbs.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "room_key_envelopes")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class RoomKeyEnvelope {

    @EmbeddedId
    private RoomKeyEnvelopeId id;

    @Column(name = "encrypted_room_key", nullable = false, columnDefinition = "TEXT")
    private String encryptedRoomKey;

    @Builder.Default
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}