package com.wisdom.wbs.repository;

import com.wisdom.wbs.entity.RoomMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RoomMessageRepository extends JpaRepository<RoomMessage, UUID> {
    // Giữ lại cho RoomServiceImpl cũ
    Page<RoomMessage> findByRoomId(UUID roomId, Pageable pageable);

    // Các hàm mở rộng Phase 5
    Optional<RoomMessage> findByRoomIdAndClientMessageId(UUID roomId, UUID clientMessageId);
    List<RoomMessage> findTop50ByRoomIdOrderByCreatedAtDesc(UUID roomId);
    List<RoomMessage> findTop50ByRoomIdAndCreatedAtBeforeOrderByCreatedAtDesc(UUID roomId, Instant before);
    List<RoomMessage> findByRoomIdAndCreatedAtAfterOrderByCreatedAtAsc(UUID roomId, Instant after);
    List<RoomMessage> findByIdIn(Collection<UUID> ids);
}