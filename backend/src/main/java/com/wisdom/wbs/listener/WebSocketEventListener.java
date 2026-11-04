package com.wisdom.wbs.listener;

import com.wisdom.wbs.dto.ParticipantDto;
import com.wisdom.wbs.dto.PresenceUpdateEvent;
import com.wisdom.wbs.service.PresenceService;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.List;
import java.util.Map;

@Component
public class WebSocketEventListener {

    private final PresenceService presenceService;
    private final SimpMessagingTemplate messagingTemplate;

    public WebSocketEventListener(
            PresenceService presenceService,
            SimpMessagingTemplate messagingTemplate) {
        this.presenceService = presenceService;
        this.messagingTemplate = messagingTemplate;
    }

    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        if (sessionId == null) {
            return;
        }

        Map<String, List<ParticipantDto>> affectedRooms = presenceService.removeSession(sessionId);

        affectedRooms.forEach((roomId, participants) -> messagingTemplate.convertAndSend(
                "/topic/rooms/" + roomId + "/presence",
                new PresenceUpdateEvent("PRESENCE_UPDATE", roomId, participants)
        ));
    }
}

