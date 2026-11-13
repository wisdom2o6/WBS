package com.wisdom.wbs.controller;

import com.wisdom.wbs.dto.ChatMessageDTO;
import com.wisdom.wbs.dto.ChatSendRequest;
import com.wisdom.wbs.service.RoomChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class RoomChatController {

    private final RoomChatService chatService;
    private final SimpMessagingTemplate messagingTemplate;

    // --- REST Endpoints ---
    @GetMapping("/api/v1/rooms/{roomId}/messages")
    public List<ChatMessageDTO> getMessages(
            @PathVariable UUID roomId,
            @RequestParam(required = false) UUID before,
            @RequestParam(required = false) UUID after,
            Authentication auth) {
        return chatService.getHistory(roomId, before, after, auth.getName());
    }

    @PostMapping("/api/v1/rooms/{roomId}/messages")
    public ResponseEntity<ChatMessageDTO> postMessage(
            @PathVariable UUID roomId,
            @RequestBody ChatSendRequest request,
            Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(chatService.sendMessage(roomId, request, auth.getName()));
    }

    @PatchMapping("/api/v1/rooms/{roomId}/messages/{messageId}")
    public ChatMessageDTO editMessage(
            @PathVariable UUID roomId,
            @PathVariable UUID messageId,
            @RequestBody Map<String, String> body,
            Authentication auth) {
        return chatService.editMessage(roomId, messageId, body.getOrDefault("message", ""), auth.getName());
    }

    @DeleteMapping("/api/v1/rooms/{roomId}/messages/{messageId}")
    public ResponseEntity<Void> deleteMessage(
            @PathVariable UUID roomId,
            @PathVariable UUID messageId,
            Authentication auth) {
        chatService.deleteMessage(roomId, messageId, auth.getName());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/v1/rooms/{roomId}/messages/{messageId}/pin")
    public ChatMessageDTO pinMessage(
            @PathVariable UUID roomId,
            @PathVariable UUID messageId,
            @RequestBody Map<String, Boolean> body,
            Authentication auth) {
        return chatService.togglePin(roomId, messageId, body.getOrDefault("pinned", true), auth.getName());
    }

    @PostMapping("/api/v1/rooms/{roomId}/messages/{messageId}/reactions")
    public ChatMessageDTO toggleReaction(
            @PathVariable UUID roomId,
            @PathVariable UUID messageId,
            @RequestBody Map<String, String> body,
            Authentication auth) {
        return chatService.toggleReaction(roomId, messageId, body.get("icon"), auth.getName());
    }

    // --- E2EE Key Endpoints ---
    @PutMapping("/api/v1/users/me/public-key")
    public ResponseEntity<Void> updatePublicKey(@RequestBody Map<String, String> body, Authentication auth) {
        chatService.saveUserPublicKey(auth.getName(), body.get("publicKeyJwk"));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/v1/rooms/{roomId}/e2ee-key")
    public Map<String, Object> getRoomKey(@PathVariable UUID roomId, Authentication auth) {
        return chatService.getRoomKeyEnvelope(roomId, auth.getName());
    }

    @PostMapping("/api/v1/rooms/{roomId}/e2ee-key")
    public ResponseEntity<Void> distributeRoomKey(
            @PathVariable UUID roomId,
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        int keyVersion = ((Number) body.getOrDefault("keyVersion", 1)).intValue();
        @SuppressWarnings("unchecked")
        Map<String, String> rawEnvelopes = (Map<String, String>) body.get("envelopes");
        Map<UUID, String> parsed = new HashMap<>();
        rawEnvelopes.forEach((k, v) -> parsed.put(UUID.fromString(k), v));
        chatService.distributeRoomKeys(roomId, keyVersion, parsed, auth.getName());
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    // --- Typing Indicator ---
    @MessageMapping("/room/{roomId}/typing")
    public void handleTyping(
            @DestinationVariable UUID roomId,
            @Payload Map<String, Object> payload,
            Principal principal) {
        Map<String, Object> event = Map.of(
                "username", principal != null ? principal.getName() : "Member",
                "typing", Boolean.TRUE.equals(payload.get("typing"))
        );
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/typing", (Object) event);
    }
}