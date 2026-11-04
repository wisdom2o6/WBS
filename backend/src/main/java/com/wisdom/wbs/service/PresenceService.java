package com.wisdom.wbs.service;

import com.wisdom.wbs.dto.ParticipantDto;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PresenceService {

    private final WhiteboardRoomService roomService;

    // Map: roomId -> (sessionId -> ParticipantDto)
    private final ConcurrentHashMap<String, ConcurrentHashMap<String, ParticipantDto>> roomParticipants =
            new ConcurrentHashMap<>();

    // Map: sessionId -> Set of roomIds (để dọn dẹp tức thì khi WebSocket disconnect)
    private final ConcurrentHashMap<String, Set<String>> sessionRooms =
            new ConcurrentHashMap<>();

    public PresenceService(WhiteboardRoomService roomService) {
        this.roomService = roomService;
    }

    private boolean validRoomId(String roomId) {
        return roomId != null && roomId.matches("^[a-zA-Z0-9_-]{1,50}$");
    }

    private String sanitizeDisplayName(String displayName) {
        if (displayName == null) {
            return null;
        }
        String trimmed = displayName.trim();
        if (trimmed.isEmpty() || trimmed.length() > 30) {
            return null;
        }
        return trimmed;
    }

    public Optional<List<ParticipantDto>> registerParticipant(
            String roomId, String sessionId, String rawDisplayName) {
        if (!validRoomId(roomId) || sessionId == null || sessionId.isBlank()) {
            return Optional.empty();
        }

        String displayName = sanitizeDisplayName(rawDisplayName);
        if (displayName == null) {
            return Optional.empty();
        }

        if (!roomService.roomExists(roomId)) {
            return Optional.empty();
        }

        ParticipantDto participant = new ParticipantDto(
                sessionId,
                displayName,
                Instant.now().toString()
        );

        ConcurrentHashMap<String, ParticipantDto> participants =
                roomParticipants.computeIfAbsent(roomId, k -> new ConcurrentHashMap<>());
        participants.put(sessionId, participant);

        sessionRooms.computeIfAbsent(sessionId, k -> ConcurrentHashMap.newKeySet()).add(roomId);

        return Optional.of(new ArrayList<>(participants.values()));
    }

    public Optional<List<ParticipantDto>> removeParticipant(String roomId, String sessionId) {
        if (!validRoomId(roomId) || sessionId == null || sessionId.isBlank()) {
            return Optional.empty();
        }

        ConcurrentHashMap<String, ParticipantDto> participants = roomParticipants.get(roomId);
        if (participants == null) {
            return Optional.empty();
        }

        participants.remove(sessionId);

        // Dọn dẹp sessionRooms
        Set<String> rooms = sessionRooms.get(sessionId);
        if (rooms != null) {
            rooms.remove(roomId);
            if (rooms.isEmpty()) {
                sessionRooms.remove(sessionId);
            }
        }

        // Nếu phòng không còn ai, dọn dẹp entry phòng khỏi bộ nhớ
        if (participants.isEmpty()) {
            roomParticipants.remove(roomId);
            return Optional.of(Collections.emptyList());
        }

        return Optional.of(new ArrayList<>(participants.values()));
    }

    public Map<String, List<ParticipantDto>> removeSession(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return Collections.emptyMap();
        }

        Set<String> rooms = sessionRooms.remove(sessionId);
        if (rooms == null || rooms.isEmpty()) {
            return Collections.emptyMap();
        }

        Map<String, List<ParticipantDto>> affectedRooms = new HashMap<>();

        for (String roomId : rooms) {
            ConcurrentHashMap<String, ParticipantDto> participants = roomParticipants.get(roomId);
            if (participants != null) {
                participants.remove(sessionId);
                if (participants.isEmpty()) {
                    roomParticipants.remove(roomId);
                    affectedRooms.put(roomId, Collections.emptyList());
                } else {
                    affectedRooms.put(roomId, new ArrayList<>(participants.values()));
                }
            }
        }

        return affectedRooms;
    }

    public List<ParticipantDto> getParticipants(String roomId) {
        if (!validRoomId(roomId)) {
            return Collections.emptyList();
        }
        ConcurrentHashMap<String, ParticipantDto> participants = roomParticipants.get(roomId);
        if (participants == null) {
            return Collections.emptyList();
        }
        return new ArrayList<>(participants.values());
    }

    public Optional<ParticipantDto> getParticipant(String roomId, String sessionId) {
        if (!validRoomId(roomId) || sessionId == null || sessionId.isBlank()) {
            return Optional.empty();
        }
        ConcurrentHashMap<String, ParticipantDto> participants = roomParticipants.get(roomId);
        if (participants == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(participants.get(sessionId));
    }
}
