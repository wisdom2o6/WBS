package com.wisdom.wbs.listener;

import com.wisdom.wbs.dto.PresenceUpdateEvent;
import com.wisdom.wbs.service.PresenceService;
import com.wisdom.wbs.service.WhiteboardRoomService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class WebSocketEventListenerTest {

    private PresenceService presenceService;
    private WebSocketEventListener listener;
    private List<SentMessage> sentMessages;

    private record SentMessage(String destination, Object payload) {}

    @BeforeEach
    void setUp() {
        sentMessages = new ArrayList<>();
        WhiteboardRoomService fakeRoomService = new WhiteboardRoomService(null, null) {
            @Override
            public boolean roomExists(String roomId) {
                return true;
            }
        };

        presenceService = new PresenceService(fakeRoomService);

        SimpMessagingTemplate fakeMessagingTemplate = new SimpMessagingTemplate((message, timeout) -> true) {
            @Override
            public void convertAndSend(String destination, Object payload) {
                sentMessages.add(new SentMessage(destination, payload));
            }
        };

        listener = new WebSocketEventListener(presenceService, fakeMessagingTemplate);
    }

    @Test
    void testHandleSessionDisconnectBroadcastsUpdate() {
        presenceService.registerParticipant("room1", "sess-1", "Alice");
        presenceService.registerParticipant("room1", "sess-2", "Bob");

        Message<byte[]> message = MessageBuilder.withPayload(new byte[0]).build();
        SessionDisconnectEvent disconnectEvent = new SessionDisconnectEvent(
                this,
                message,
                "sess-1",
                CloseStatus.NORMAL
        );

        listener.handleSessionDisconnect(disconnectEvent);

        assertEquals(1, sentMessages.size());
        assertEquals("/topic/rooms/room1/presence", sentMessages.get(0).destination());

        PresenceUpdateEvent event = (PresenceUpdateEvent) sentMessages.get(0).payload();
        assertEquals("PRESENCE_UPDATE", event.type());
        assertEquals("room1", event.roomId());
        assertEquals(1, event.participants().size());
        assertEquals("Bob", event.participants().get(0).displayName());
    }
}
