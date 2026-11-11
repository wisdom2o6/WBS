package com.wisdom.wbs.config;

import com.wisdom.wbs.dto.PresencePayload;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;

@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketEventListener {

    private final SimpMessageSendingOperations messagingTemplate;

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal user = headerAccessor.getUser();
        
        if (user != null) {
            log.info("User disconnected: {}", user.getName());
            
            // Lấy roomId từ session attributes nếu có lưu lúc CONNECT/JOIN
            String roomId = (String) headerAccessor.getSessionAttributes().get("roomId");
            if (roomId != null) {
                PresencePayload disconnectPayload = PresencePayload.builder()
                        .roomId(Long.parseLong(roomId))
                        .userId(user.getName())
                        .status("LEFT")
                        .build();

                messagingTemplate.convertAndSend("/topic/room/" + roomId + "/presence", disconnectPayload);
            }
        }
    }
}