package com.wisdom.wbs.repository;

import com.wisdom.wbs.entity.WhiteboardRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface WhiteboardRoomRepository
        extends JpaRepository<WhiteboardRoom, String> {
}

