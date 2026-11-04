package com.wisdom.wbs.controller;

import com.wisdom.wbs.dto.JoinRoomRequest;
import com.wisdom.wbs.dto.ParticipantDto;
import com.wisdom.wbs.dto.PresenceUpdateEvent;
import com.wisdom.wbs.service.PresenceService;
import com.wisdom.wbs.service.WhiteboardRoomService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageHeaders;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class PresenceControllerTest {

    private PresenceService presenceService;
    private PresenceController controller;
    private List<SentMessage> sentMessages;

    private record SentMessage(String destination, Object payload) {}

    @BeforeEach
    void setUp() {
        sentMessages = new ArrayList<>();
        WhiteboardRoomService fakeRoomService = new WhiteboardRoomService(null, null) {
            @Override
            public boolean roomExists(String roomId) {
                return "room123".equals(roomId);
            }
        };

        presenceService = new PresenceService(fakeRoomService);

        SimpMessagingTemplate fakeMessagingTemplate = new SimpMessagingTemplate((message, timeout) -> true) {
            @Override
            public void convertAndSend(String destination, Object payload) {
                sentMessages.add(new SentMessage(destination, payload));
            }
        };

        controller = new PresenceController(presenceService, fakeMessagingTemplate);
    }

    private SimpMessageHeaderAccessor createHeaderAccessor(String sessionId) {
        SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.create();
        accessor.setSessionId(sessionId);
        accessor.setLeaveMutable(true);
        return accessor;
    }

    @Test
    void testJoinRoomBroadcastsPresence() {
        SimpMessageHeaderAccessor accessor = createHeaderAccessor("session-xyz");
        controller.joinRoom("room123", new JoinRoomRequest("Wisdom"), accessor);

        assertEquals(1, sentMessages.size());
        assertEquals("/topic/rooms/room123/presence", sentMessages.get(0).destination());
        assertTrue(sentMessages.get(0).payload() instanceof PresenceUpdateEvent);

        PresenceUpdateEvent event = (PresenceUpdateEvent) sentMessages.get(0).payload();
        assertEquals("PRESENCE_UPDATE", event.type());
        assertEquals("room123", event.roomId());
        assertEquals(1, event.participants().size());
        assertEquals("Wisdom", event.participants().get(0).displayName());
        assertEquals("session-xyz", event.participants().get(0).sessionId());
    }

    @Test
    void testLeaveRoomBroadcastsPresence() {
        SimpMessageHeaderAccessor accessor = createHeaderAccessor("session-xyz");
        controller.joinRoom("room123", new JoinRoomRequest("Wisdom"), accessor);
        sentMessages.clear();

        controller.leaveRoom("room123", accessor);

        assertEquals(1, sentMessages.size());
        assertEquals("/topic/rooms/room123/presence", sentMessages.get(0).destination());

        PresenceUpdateEvent event = (PresenceUpdateEvent) sentMessages.get(0).payload();
        assertEquals(0, event.participants().size());
    }
}

