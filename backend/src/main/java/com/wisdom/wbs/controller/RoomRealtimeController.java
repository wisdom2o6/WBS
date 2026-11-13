package com.wisdom.wbs.controller;

import com.wisdom.wbs.dto.*;
import com.wisdom.wbs.entity.User;
import com.wisdom.wbs.repository.UserRepository;
import com.wisdom.wbs.service.RoomChatService;
import com.wisdom.wbs.service.RoomService;
import com.wisdom.wbs.repository.RoomDocumentRepository;
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

    private final RoomChatService roomChatService;
    private final RoomDocumentRepository roomDocumentRepository;
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
        String text = message.getContent() != null ? message.getContent() : message.getMessage();
        ChatSendRequest req = new ChatSendRequest();
        req.setClientMessageId(message.getClientMessageId());
        req.setMessage(text);
        req.setReplyToId(message.getReplyToId());
        req.setAttachmentFileId(message.getAttachmentFileId());
        req.setEncryptionMode(message.getEncryptionMode());
        req.setKeyVersion(message.getKeyVersion());

        String identifier = principal != null ? principal.getName()
                : (message.getSenderName() != null ? message.getSenderName() : "Wisdom");
        return roomChatService.saveMessageOnly(roomId, req, identifier);
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