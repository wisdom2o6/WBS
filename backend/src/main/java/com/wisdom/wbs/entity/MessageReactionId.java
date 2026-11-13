package com.wisdom.wbs.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

import java.io.Serializable;
import java.util.UUID;

@Embeddable
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@EqualsAndHashCode
public class MessageReactionId implements Serializable {
    @Column(name = "message_id")
    private UUID messageId;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "icon", length = 30)
    private String icon;
}