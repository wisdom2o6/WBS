package com.wisdom.wbs.controller;

import com.wisdom.wbs.dto.CanvasUpdateDTO;
import com.wisdom.wbs.dto.ChatMessageDTO;
import com.wisdom.wbs.dto.PresencePayload;
import com.wisdom.wbs.entity.User;
import com.wisdom.wbs.repository.UserRepository;
import com.wisdom.wbs.service.RoomService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Controller
@RequiredArgsConstructor
public class RoomRealtimeController {

    private final RoomService roomService;
    private final UserRepository userRepository;

    @MessageMapping("/room/{roomId}/canvas.update")
    @SendTo("/topic/room/{roomId}/canvas")
    public CanvasUpdateDTO handleCanvasUpdate(
            @DestinationVariable UUID roomId,
            @Payload CanvasUpdateDTO updatePayload,
            Principal principal) {
        
        if (updatePayload.getTimestamp() == null) {
            updatePayload.setTimestamp(System.currentTimeMillis());
        }
        return updatePayload;
    }

    @MessageMapping("/room/{roomId}/presence.cursor")
    @SendTo("/topic/room/{roomId}/presence")
    public PresencePayload handleCursorMove(
            @DestinationVariable UUID roomId,
            @Payload PresencePayload presence,
            Principal principal) {
        
        if (principal != null) {
            presence.setUserId(principal.getName());
        }
        return presence;
    }

    @MessageMapping("/room/{roomId}/chat.send")
    @SendTo("/topic/room/{roomId}/chat")
    public ChatMessageDTO handleChatMessage(
            @DestinationVariable UUID roomId,
            @Payload ChatMessageDTO message,
            Principal principal) {
        
        message.setRoomId(roomId.toString());
        if (message.getTimestamp() == null) {
            message.setTimestamp(Instant.now().toString());
        }

        // 1. Tìm User trong DB dựa vào JWT Principal hoặc thông tin senderId/senderName từ DTO
        String identifier = (principal != null) ? principal.getName() : message.getSenderId();
        Optional<User> userOpt = findUser(identifier);

        if (userOpt.isEmpty() && message.getSenderName() != null) {
            userOpt = findUser(message.getSenderName());
        }

        if (userOpt.isPresent()) {
            User user = userOpt.get();
            message.setSenderId(user.getId().toString());
            message.setSenderName(user.getFullName() != null ? user.getFullName() : user.getUsername());
        } else {
            if (message.getSenderName() == null || message.getSenderName().isBlank()) {
                message.setSenderName("Wisdom");
            }
        }

        // 2. Tiến hành lưu tin nhắn chat vào Database
        try {
            roomService.saveChatMessage(roomId, message);
            log.info("Lưu tin nhắn thành công cho phòng: {}", roomId);
        } catch (Exception e) {
            log.error("Lỗi lưu tin nhắn chat vào DB: ", e);
        }

        return message;
    }

    private Optional<User> findUser(String identifier) {
        if (identifier == null || identifier.isBlank()) return Optional.empty();

        // 1. Tìm theo UUID
        try {
            UUID uuid = UUID.fromString(identifier);
            Optional<User> byId = userRepository.findById(uuid);
            if (byId.isPresent()) return byId;
        } catch (IllegalArgumentException ignored) {}

        // 2. Tìm theo Email
        Optional<User> byEmail = userRepository.findByEmail(identifier);
        if (byEmail.isPresent()) return byEmail;

        // 3. Tìm theo Username
        return userRepository.findByUsername(identifier);
    }
}