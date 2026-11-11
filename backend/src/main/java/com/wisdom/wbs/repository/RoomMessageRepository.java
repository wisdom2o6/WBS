package com.wisdom.wbs.repository;

import com.wisdom.wbs.entity.RoomMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface RoomMessageRepository extends JpaRepository<RoomMessage, UUID> {
    Page<RoomMessage> findByRoomId(UUID roomId, Pageable pageable);
}