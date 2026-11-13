package com.wisdom.wbs.repository;

import com.wisdom.wbs.entity.RoomDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface RoomDocumentRepository extends JpaRepository<RoomDocument, UUID> {
    List<RoomDocument> findByWorkspaceIdOrderByUpdatedAtDesc(UUID workspaceId);
    List<RoomDocument> findByWorkspaceIdAndRoomIdOrderByUpdatedAtDesc(UUID workspaceId, UUID roomId);
}