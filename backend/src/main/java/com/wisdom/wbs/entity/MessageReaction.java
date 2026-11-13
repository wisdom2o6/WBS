package com.wisdom.wbs.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "message_reactions")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class MessageReaction {

    @EmbeddedId
    private MessageReactionId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("userId")
    @JoinColumn(name = "user_id")
    private User user;

    @Builder.Default
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}