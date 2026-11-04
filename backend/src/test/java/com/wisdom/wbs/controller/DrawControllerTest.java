package com.wisdom.wbs.controller;

import com.wisdom.wbs.controller.DrawController.ClearEvent;
import com.wisdom.wbs.controller.DrawController.ClearRequest;
import com.wisdom.wbs.controller.DrawController.DrawEvent;
import com.wisdom.wbs.service.WhiteboardRoomService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class DrawControllerTest {

    private DrawController controller;
    private List<SentMessage> sentMessages;

    private record SentMessage(String destination, Object payload) {}

    @BeforeEach
    void setUp() {
        sentMessages = new ArrayList<>();
        WhiteboardRoomService fakeRoomService = new WhiteboardRoomService(null, null) {
            @Override
            public boolean roomExists(String roomId) {
                return "room1".equals(roomId) || "room2".equals(roomId);
            }
        };

        SimpMessagingTemplate fakeMessagingTemplate = new SimpMessagingTemplate((message, timeout) -> true) {
            @Override
            public void convertAndSend(String destination, Object payload) {
                sentMessages.add(new SentMessage(destination, payload));
            }
        };

        controller = new DrawController(fakeMessagingTemplate, fakeRoomService);
    }

    @Test
    void testDrawValidEventBroadcasts() {
        DrawEvent event = new DrawEvent(
                "room1",
                "stroke-123",
                new double[]{10.0, 20.0, 15.0, 25.0},
                "#2563eb",
                3.0,
                0 // initial roomVersion
        );

        controller.draw(event);

        assertEquals(1, sentMessages.size());
        assertEquals("/topic/rooms/room1/draw", sentMessages.get(0).destination());
        assertEquals(event, sentMessages.get(0).payload());
    }

    @Test
    void testClearIncrementsRoomVersionAndBroadcasts() {
        controller.clear(new ClearRequest("room1"));

        assertEquals(1, sentMessages.size());
        assertEquals("/topic/rooms/room1/clear", sentMessages.get(0).destination());
        assertTrue(sentMessages.get(0).payload() instanceof ClearEvent);

        ClearEvent clearEvent = (ClearEvent) sentMessages.get(0).payload();
        assertEquals("room1", clearEvent.roomId());
        assertEquals(1, clearEvent.roomVersion());
        assertEquals(1, controller.getRoomVersion("room1"));
    }

    @Test
    void testDrawOutdatedRoomVersionIgnored() {
        // Increment version of room1 to 1 via clear
        controller.clear(new ClearRequest("room1"));
        sentMessages.clear();

        // Late event with old roomVersion = 0
        DrawEvent lateEvent = new DrawEvent(
                "room1",
                "stroke-late",
                new double[]{10.0, 20.0, 15.0, 25.0},
                "#2563eb",
                3.0,
                0 // outdated version
        );

        controller.draw(lateEvent);

        // Must be dropped
        assertEquals(0, sentMessages.size());

        // Event with matching roomVersion = 1 must succeed
        DrawEvent validEvent = new DrawEvent(
                "room1",
                "stroke-current",
                new double[]{10.0, 20.0, 15.0, 25.0},
                "#2563eb",
                3.0,
                1 // current version
        );

        controller.draw(validEvent);
        assertEquals(1, sentMessages.size());
    }

    @Test
    void testDrawNonExistentRoomIgnored() {
        DrawEvent event = new DrawEvent(
                "non_existent",
                "stroke-123",
                new double[]{10.0, 20.0},
                "#2563eb",
                3.0,
                0
        );

        controller.draw(event);
        assertEquals(0, sentMessages.size());
    }

    @Test
    void testRoomVersionIsolationBetweenRooms() {
        controller.clear(new ClearRequest("room1"));

        assertEquals(1, controller.getRoomVersion("room1"));
        assertEquals(0, controller.getRoomVersion("room2"));
    }
}

