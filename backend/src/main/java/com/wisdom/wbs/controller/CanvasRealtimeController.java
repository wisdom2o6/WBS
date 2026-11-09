package com.wisdom.wbs.controller;

import com.wisdom.wbs.dto.CanvasDrawEvent;
import com.wisdom.wbs.dto.ChatMessageEvent;
import com.wisdom.wbs.service.CanvasPersistenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.Map;

@Controller
@RequiredArgsConstructor
public class CanvasRealtimeController {

    private final SimpMessagingTemplate messagingTemplate;
    private final CanvasPersistenceService canvasPersistenceService;

    @MessageMapping("/room.{roomId}.draw")
    public void handleDrawEvent(@DestinationVariable String roomId,
                                @Payload CanvasDrawEvent event,
                                Principal principal) {
        if (principal != null) {
            event.setSenderUsername(principal.getName());
        }
        event.setRoomId(roomId);
        
        // 1. Lưu hoặc Cập nhật/Xóa vào PostgreSQL
        canvasPersistenceService.saveOrUpdateEvent(event);

        // 2. Broadcast sự kiện đến các client đang online
        messagingTemplate.convertAndSend("/topic/room." + roomId, event);
    }

    @MessageMapping("/room.{roomId}.cursor")
    public void handleCursorEvent(@DestinationVariable String roomId,
                                    @Payload Map<String, Object> cursorData,
                                    Principal principal) {
        if (principal != null) {
            cursorData.put("username", principal.getName());
        }
        // Explicitly cast to Object to resolve method ambiguity
        messagingTemplate.convertAndSend("/topic/room." + roomId + ".cursors", (Object) cursorData);
    }

    @MessageMapping("/room.{roomId}.chat")
    public void handleChatMessage(@DestinationVariable String roomId,
                                @Payload ChatMessageEvent chatMessage,
                                Principal principal) {
        if (principal != null) {
            chatMessage.setSenderUsername(principal.getName());
        }
        chatMessage.setRoomId(roomId);
        chatMessage.setTimestamp(java.time.LocalTime.now().format(java.time.format.DateTimeFormatter.ofPattern("HH:mm")));
        
        // Broadcast tin nhắn chat đến tất cả thành viên trong room
        messagingTemplate.convertAndSend("/topic/room." + roomId + ".chat", chatMessage);
    }

}