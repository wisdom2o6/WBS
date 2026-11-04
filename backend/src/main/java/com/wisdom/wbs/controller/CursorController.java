package com.wisdom.wbs.controller;

import com.wisdom.wbs.dto.CursorEvent;
import com.wisdom.wbs.dto.CursorRequest;
import com.wisdom.wbs.dto.ParticipantDto;
import com.wisdom.wbs.service.PresenceService;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.Optional;

@Controller
public class CursorController {

    private final PresenceService presenceService;
    private final SimpMessagingTemplate messagingTemplate;

    public CursorController(
            PresenceService presenceService,
            SimpMessagingTemplate messagingTemplate) {
        this.presenceService = presenceService;
        this.messagingTemplate = messagingTemplate;
    }

    private boolean validRoomId(String roomId) {
        return roomId != null && roomId.matches("^[a-zA-Z0-9_-]{1,50}$");
    }

    @MessageMapping("/rooms/{roomId}/cursor")
    public void moveCursor(
            @DestinationVariable String roomId,
            CursorRequest request,
            SimpMessageHeaderAccessor headerAccessor) {
        if (!validRoomId(roomId) || request == null) {
            return;
        }

        String sessionId = headerAccessor.getSessionId();
        if (sessionId == null) {
            return;
        }

        if (!Double.isFinite(request.x()) || !Double.isFinite(request.y())
                || request.x() < -10000 || request.x() > 100000
                || request.y() < -10000 || request.y() > 100000) {
            return;
        }

        Optional<ParticipantDto> participantOpt = presenceService.getParticipant(roomId, sessionId);
        if (participantOpt.isEmpty()) {
            return;
        }

        ParticipantDto participant = participantOpt.get();

        CursorEvent event = new CursorEvent(
                roomId,
                sessionId,
                participant.displayName(),
                request.x(),
                request.y()
        );

        messagingTemplate.convertAndSend(
                "/topic/rooms/" + roomId + "/cursor",
                event
        );
    }
}

