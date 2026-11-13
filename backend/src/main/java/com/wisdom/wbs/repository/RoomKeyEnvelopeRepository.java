package com.wisdom.wbs.repository;

import com.wisdom.wbs.entity.RoomKeyEnvelope;
import com.wisdom.wbs.entity.RoomKeyEnvelopeId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RoomKeyEnvelopeRepository extends JpaRepository<RoomKeyEnvelope, RoomKeyEnvelopeId> {
    Optional<RoomKeyEnvelope> findTopByIdRoomIdAndIdUserIdOrderByIdKeyVersionDesc(UUID roomId, UUID userId);
}