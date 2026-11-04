package com.wisdom.wbs.service;

import com.wisdom.wbs.dto.CreateRoomResponse;
import com.wisdom.wbs.entity.WhiteboardRoom;
import com.wisdom.wbs.entity.WhiteboardState;
import com.wisdom.wbs.repository.WhiteboardRoomRepository;
import com.wisdom.wbs.repository.WhiteboardStateRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Optional;

@Service
public class WhiteboardRoomService {

    private static final String ROOM_CODE_CHARACTERS = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
    private static final int ROOM_CODE_LENGTH = 8;
    private static final String EMPTY_WHITEBOARD_DATA = "{\"lines\":[]}";
    private static final String LEGACY_ROOM_ID = "room-1";

    private final WhiteboardRoomRepository roomRepository;
    private final WhiteboardStateRepository stateRepository;
    private final SecureRandom random = new SecureRandom();

    public WhiteboardRoomService(
            WhiteboardRoomRepository roomRepository,
            WhiteboardStateRepository stateRepository) {
        this.roomRepository = roomRepository;
        this.stateRepository = stateRepository;
    }

    private String generateRandomCode() {
        StringBuilder builder = new StringBuilder(ROOM_CODE_LENGTH);
        for (int i = 0; i < ROOM_CODE_LENGTH; i++) {
            int index = random.nextInt(ROOM_CODE_CHARACTERS.length());
            builder.append(ROOM_CODE_CHARACTERS.charAt(index));
        }
        return builder.toString();
    }

    @Transactional
    public CreateRoomResponse createRoom() {
        String roomId = null;
        for (int attempt = 0; attempt < 5; attempt++) {
            String candidate = generateRandomCode();
            if (!roomRepository.existsById(candidate)) {
                roomId = candidate;
                break;
            }
        }

        if (roomId == null) {
            throw new IllegalStateException("Failed to generate a unique room ID");
        }

        WhiteboardRoom room = new WhiteboardRoom(roomId);
        roomRepository.save(room);

        WhiteboardState initialState = new WhiteboardState(roomId, EMPTY_WHITEBOARD_DATA);
        stateRepository.save(initialState);

        return new CreateRoomResponse(
                room.getRoomId(),
                "Room created successfully",
                room.getCreatedAt()
        );
    }

    @Transactional
    public Optional<WhiteboardRoom> findRoom(String roomId) {
        if (roomId == null || roomId.isBlank()) {
            return Optional.empty();
        }

        Optional<WhiteboardRoom> existing = roomRepository.findById(roomId);
        if (existing.isPresent()) {
            return existing;
        }

        // Tương thích ngược: Nếu là room-1 và đã có dữ liệu trong WhiteboardState
        if (LEGACY_ROOM_ID.equalsIgnoreCase(roomId)) {
            if (stateRepository.existsById(LEGACY_ROOM_ID)) {
                WhiteboardRoom legacyRoom = new WhiteboardRoom(LEGACY_ROOM_ID);
                roomRepository.save(legacyRoom);
                return Optional.of(legacyRoom);
            }
        }

        return Optional.empty();
    }

    @Transactional
    public boolean roomExists(String roomId) {
        return findRoom(roomId).isPresent();
    }
}

