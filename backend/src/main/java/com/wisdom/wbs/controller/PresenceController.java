package com.wisdom.wbs.controller;

import com.wisdom.wbs.dto.JoinRoomRequest;
import com.wisdom.wbs.dto.ParticipantDto;
import com.wisdom.wbs.dto.PresenceUpdateEvent;
import com.wisdom.wbs.service.PresenceService;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.List;
import java.util.Optional;

@Controller
public class PresenceController {

    private final PresenceService presenceService;
    private final SimpMessagingTemplate messagingTemplate;

    public PresenceController(PresenceService presenceService, SimpMessagingTemplate messagingTemplate) {
        this.presenceService = presenceService;
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/rooms/{roomId}/join")
    public void joinRoom(
            @DestinationVariable String roomId,
            JoinRoomRequest request,
            SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        if (sessionId == null || request == null) {
            return;
        }

        Optional<List<ParticipantDto>> updatedParticipants =
                presenceService.registerParticipant(roomId, sessionId, request.displayName());

        updatedParticipants.ifPresent(participants -> messagingTemplate.convertAndSend(
                "/topic/rooms/" + roomId + "/presence",
                new PresenceUpdateEvent("PRESENCE_UPDATE", roomId, participants)
        ));
    }

    @MessageMapping("/rooms/{roomId}/leave")
    public void leaveRoom(
            @DestinationVariable String roomId,
            SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        if (sessionId == null) {
            return;
        }

        Optional<List<ParticipantDto>> updatedParticipants =
                presenceService.removeParticipant(roomId, sessionId);

        updatedParticipants.ifPresent(participants -> messagingTemplate.convertAndSend(
                "/topic/rooms/" + roomId + "/presence",
                new PresenceUpdateEvent("PRESENCE_UPDATE", roomId, participants)
        ));
    }
}

