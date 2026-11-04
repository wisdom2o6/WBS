package com.wisdom.wbs.controller;

import com.wisdom.wbs.dto.CursorEvent;
import com.wisdom.wbs.dto.CursorRequest;
import com.wisdom.wbs.service.PresenceService;
import com.wisdom.wbs.service.WhiteboardRoomService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class CursorControllerTest {

    private PresenceService presenceService;
    private CursorController controller;
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

        controller = new CursorController(presenceService, fakeMessagingTemplate);
    }

    private SimpMessageHeaderAccessor createHeaderAccessor(String sessionId) {
        SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.create();
        accessor.setSessionId(sessionId);
        accessor.setLeaveMutable(true);
        return accessor;
    }

    @Test
    void testMoveCursorSuccess() {
        presenceService.registerParticipant("room123", "sess-1", "Wisdom");

        SimpMessageHeaderAccessor accessor = createHeaderAccessor("sess-1");
        controller.moveCursor("room123", new CursorRequest(150.5, 200.0), accessor);

        assertEquals(1, sentMessages.size());
        assertEquals("/topic/rooms/room123/cursor", sentMessages.get(0).destination());
        assertTrue(sentMessages.get(0).payload() instanceof CursorEvent);

        CursorEvent event = (CursorEvent) sentMessages.get(0).payload();
        assertEquals("room123", event.roomId());
        assertEquals("sess-1", event.sessionId());
        assertEquals("Wisdom", event.displayName());
        assertEquals(150.5, event.x());
        assertEquals(200.0, event.y());
    }

    @Test
    void testMoveCursorUnregisteredSessionIgnored() {
        SimpMessageHeaderAccessor accessor = createHeaderAccessor("unregistered-sess");
        controller.moveCursor("room123", new CursorRequest(100, 100), accessor);

        assertEquals(0, sentMessages.size());
    }

    @Test
    void testMoveCursorInvalidCoordinatesIgnored() {
        presenceService.registerParticipant("room123", "sess-1", "Wisdom");
        SimpMessageHeaderAccessor accessor = createHeaderAccessor("sess-1");

        controller.moveCursor("room123", new CursorRequest(Double.NaN, 100), accessor);
        controller.moveCursor("room123", new CursorRequest(100, Double.POSITIVE_INFINITY), accessor);
        controller.moveCursor("room123", new CursorRequest(99999999, 100), accessor);

        assertEquals(0, sentMessages.size());
    }

    @Test
    void testMoveCursorInvalidRoomIgnored() {
        presenceService.registerParticipant("room123", "sess-1", "Wisdom");
        SimpMessageHeaderAccessor accessor = createHeaderAccessor("sess-1");

        controller.moveCursor("invalid/room!", new CursorRequest(100, 100), accessor);

        assertEquals(0, sentMessages.size());
    }
}

