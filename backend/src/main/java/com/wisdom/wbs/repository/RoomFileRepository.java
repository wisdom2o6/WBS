package com.wisdom.wbs.repository;

import com.wisdom.wbs.entity.RoomFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RoomFileRepository extends JpaRepository<RoomFile, UUID> {
    List<RoomFile> findByRoomIdOrderByCreatedAtDesc(UUID roomId);
}