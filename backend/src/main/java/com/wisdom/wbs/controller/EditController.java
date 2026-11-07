package com.wisdom.wbs.controller;

import com.wisdom.wbs.service.PresenceService;
import com.wisdom.wbs.service.WhiteboardRoomService;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Controller
public class EditController {

    private final SimpMessagingTemplate messagingTemplate;
    private final WhiteboardRoomService roomService;
    private final PresenceService presenceService;
    private final DrawController drawController;
    private final ConcurrentHashMap<String, Set<String>> processedOperations =
            new ConcurrentHashMap<>();

    public EditController(
            SimpMessagingTemplate messagingTemplate,
            WhiteboardRoomService roomService,
            PresenceService presenceService,
            DrawController drawController) {
        this.messagingTemplate = messagingTemplate;
        this.roomService = roomService;
        this.presenceService = presenceService;
        this.drawController = drawController;
    }

    public record EditRequest(
            String roomId,
            String operationId,
            String transactionId,
            String operation,
            String objectType,
            String objectId,
            Map<String, Object> object,
            long baseRoomVersion
    ) {}

    public record EditEvent(
            String roomId,
            String operationId,
            String transactionId,
            String operation,
            String objectType,
            String objectId,
            Map<String, Object> object,
            long roomVersion
    ) {}

    public record EditConflict(
            String roomId,
            String operationId,
            long roomVersion,
            String reason
    ) {}

    @MessageMapping("/edit")
    public void edit(EditRequest request, SimpMessageHeaderAccessor headers) {
        if (!validRequest(request) || !roomService.roomExists(request.roomId())) {
            return;
        }

        String sessionId = headers == null ? null : headers.getSessionId();
        if (sessionId == null
                || presenceService.getParticipant(request.roomId(), sessionId).isEmpty()) {
            return;
        }

        Set<String> roomOperations = processedOperations.computeIfAbsent(
                request.roomId(), ignored -> ConcurrentHashMap.newKeySet());
        if (!roomOperations.add(request.operationId())) {
            return;
        }

        synchronized (roomOperations) {
            long currentVersion = drawController.getRoomVersion(request.roomId());
            if (request.baseRoomVersion() != currentVersion) {
                roomOperations.remove(request.operationId());
                messagingTemplate.convertAndSend(
                        "/topic/rooms/" + request.roomId() + "/edit-conflict",
                        new EditConflict(
                                request.roomId(),
                                request.operationId(),
                                currentVersion,
                                "STALE_ROOM_VERSION"
                        ));
                return;
            }

            long nextVersion = drawController.incrementRoomVersion(request.roomId());
            messagingTemplate.convertAndSend(
                    "/topic/rooms/" + request.roomId() + "/edit",
                    new EditEvent(
                            request.roomId(),
                            request.operationId(),
                            request.transactionId(),
                            request.operation(),
                            request.objectType(),
                            request.objectId(),
                            request.object(),
                            nextVersion
                    ));
        }
    }

    private boolean validRequest(EditRequest request) {
        return request != null
                && validRoomId(request.roomId())
                && validId(request.operationId())
                && validId(request.transactionId())
                && validId(request.objectId())
                && request.operation() != null
                && request.operation().matches("^(UPDATE|DELETE)$")
                && request.objectType() != null
                && request.objectType().matches("^(STROKE|RECTANGLE|CIRCLE|LINE|ARROW|TEXT)$")
                && request.baseRoomVersion() >= 0
                && (request.object() == null || request.object().size() <= 100);
    }

    private boolean validRoomId(String roomId) {
        return roomId != null && roomId.matches("^[a-zA-Z0-9_-]{1,50}$");
    }

    private boolean validId(String value) {
        return value != null && value.matches("^[a-zA-Z0-9_-]{1,100}$");
    }
}
