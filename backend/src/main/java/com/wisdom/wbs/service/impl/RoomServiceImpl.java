package com.wisdom.wbs.service.impl;

import com.wisdom.wbs.dto.*;
import com.wisdom.wbs.entity.Room;
import com.wisdom.wbs.entity.RoomMessage;
import com.wisdom.wbs.repository.RoomMessageRepository;
import com.wisdom.wbs.repository.RoomRepository;
import com.wisdom.wbs.repository.UserRepository;
import com.wisdom.wbs.service.RoomService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class RoomServiceImpl implements RoomService {

    private final RoomRepository roomRepository;
    private final RoomMessageRepository roomMessageRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional
    public void saveCanvasSnapshot(UUID roomId, String canvasSnapshotJson) {
        roomRepository.findById(roomId).ifPresent(room -> {
            room.setCanvasSnapshot(canvasSnapshotJson);
            roomRepository.save(room);
        });
    }

    @Override
    @Transactional(readOnly = true)
    public String getCanvasSnapshot(UUID roomId) {
        return roomRepository.findById(roomId)
                .map(Room::getCanvasSnapshot)
                .orElse("{}");
    }

    @Override
    @Transactional
    public void saveChatMessage(UUID roomId, ChatMessageDTO dto) {
        UUID senderUuid = parseUUID(dto.getSenderId());
        String senderName = dto.getSenderName();

        // Nếu có senderUuid, tra cứu fullName từ DB để lưu đúng tên
        if (senderUuid != null) {
            var userOpt = userRepository.findById(senderUuid);
            if (userOpt.isPresent()) {
                senderName = userOpt.get().getFullName();
            }
        }

        RoomMessage message = RoomMessage.builder()
                .roomId(roomId)
                .senderId(senderUuid)
                .senderName(senderName != null ? senderName : "Anonymous")
                .content(dto.getContent() != null ? dto.getContent() : "")
                .attachmentUrl(dto.getAttachmentUrl())
                .createdAt(Instant.now())
                .build();

        roomMessageRepository.save(message);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ChatMessageDTO> getRecentMessages(UUID roomId, int limit) {
        var pageable = PageRequest.of(0, limit, Sort.by("createdAt").descending());
        return roomMessageRepository.findByRoomId(roomId, pageable)
                .getContent()
                .stream()
                .map(msg -> {
                    String displayName = msg.getSenderName();

                    // Nếu trong DB bị lưu nhầm chuỗi UUID, tra cứu lại fullName
                    if (displayName != null && isUUID(displayName)) {
                        displayName = resolveFullName(displayName, msg.getSenderId());
                    }

                    return ChatMessageDTO.builder()
                            .roomId(msg.getRoomId() != null ? msg.getRoomId().toString() : null)
                            .senderId(msg.getSenderId() != null ? msg.getSenderId().toString() : null)
                            .senderName(displayName)
                            .content(msg.getContent())
                            .attachmentUrl(msg.getAttachmentUrl())
                            .timestamp(msg.getCreatedAt() != null ? msg.getCreatedAt().toString() : null)
                            .build();
                })
                .toList();
    }

    private String resolveFullName(String identifier, UUID senderId) {
        if (senderId != null) {
            var user = userRepository.findById(senderId);
            if (user.isPresent()) return user.get().getFullName();
        }
        try {
            var user = userRepository.findById(UUID.fromString(identifier));
            if (user.isPresent()) return user.get().getFullName();
        } catch (IllegalArgumentException ignored) {}

        return userRepository.findByEmail(identifier)
                .map(u -> u.getFullName())
                .orElse("Anonymous");
    }

    private boolean isUUID(String str) {
        if (str == null) return false;
        try {
            UUID.fromString(str);
            return true;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private UUID parseUUID(String uuidStr) {
        if (uuidStr == null || uuidStr.isBlank()) return null;
        try {
            return UUID.fromString(uuidStr);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}