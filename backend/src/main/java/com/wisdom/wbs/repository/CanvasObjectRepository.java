package com.wisdom.wbs.repository;

import com.wisdom.wbs.entity.CanvasObject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CanvasObjectRepository extends JpaRepository<CanvasObject, String> {
    List<CanvasObject> findByRoomIdOrderByCreatedAtAsc(UUID roomId);
    void deleteByRoomIdAndId(UUID roomId, String id);
    void deleteByRoomId(UUID roomId);
}