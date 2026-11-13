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
public class RoomKeyEnvelopeId implements Serializable {
    @Column(name = "room_id")
    private UUID roomId;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "key_version")
    private Integer keyVersion;
}