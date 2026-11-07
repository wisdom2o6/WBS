package com.wisdom.wbs.controller;

import com.wisdom.wbs.controller.DrawController.ClearEvent;
import com.wisdom.wbs.controller.DrawController.ClearRequest;
import com.wisdom.wbs.controller.DrawController.DrawEvent;
import com.wisdom.wbs.controller.DrawController.UndoRedoEvent;
import com.wisdom.wbs.controller.DrawController.UndoRedoRequest;
import com.wisdom.wbs.controller.DrawController.ShapeEvent;
import com.wisdom.wbs.controller.DrawController.ShapeUndoRedoEvent;
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

    @Test
    void testUndoAndRedoBroadcastTheOwnOperation() {
        DrawEvent event = new DrawEvent(
                "room1", "stroke-undo", new double[]{1, 2}, "#2563eb", 3, 0);
        controller.draw(event);
        sentMessages.clear();

        controller.undo(new UndoRedoRequest("room1", "undo-1"), null);

        assertEquals(1, sentMessages.size());
        assertEquals("/topic/rooms/room1/undo", sentMessages.get(0).destination());
        UndoRedoEvent undo = (UndoRedoEvent) sentMessages.get(0).payload();
        assertEquals("UNDO", undo.action());
        assertEquals("stroke-undo", undo.strokeId());
        assertEquals(1, undo.roomVersion());

        sentMessages.clear();
        controller.redo(new UndoRedoRequest("room1", "redo-1"), null);

        assertEquals(1, sentMessages.size());
        UndoRedoEvent redo = (UndoRedoEvent) sentMessages.get(0).payload();
        assertEquals("REDO", redo.action());
        assertEquals("stroke-undo", redo.strokeId());
        assertEquals(2, redo.roomVersion());
    }

    @Test
    void testDuplicateUndoRequestIsIgnored() {
        controller.draw(new DrawEvent(
                "room1", "stroke-once", new double[]{1, 2}, "#2563eb", 3, 0));
        sentMessages.clear();

        UndoRedoRequest request = new UndoRedoRequest("room1", "same-request");
        controller.undo(request, null);
        controller.undo(request, null);

        assertEquals(1, sentMessages.size());
        assertEquals(1, controller.getRoomVersion("room1"));
    }

    @Test
    void testRedoIsInvalidatedByNewOperation() {
        controller.draw(new DrawEvent(
                "room1", "stroke-old", new double[]{1, 2}, "#2563eb", 3, 0));
        controller.undo(new UndoRedoRequest("room1", "undo-old"), null);
        controller.draw(new DrawEvent(
                "room1", "stroke-new", new double[]{3, 4}, "#2563eb", 1, 1));
        sentMessages.clear();

        controller.redo(new UndoRedoRequest("room1", "redo-old"), null);

        assertEquals(0, sentMessages.size());
    }

    @Test
    void testShapeIsBroadcastAndParticipatesInUndoRedo() {
        ShapeEvent shape = new ShapeEvent(
                "room1", "shape-1", "RECTANGLE",
                10, 20, 100, 50, 10, 20, 110, 70, 1,
                "#2563eb", 3, 0);

        controller.shape(shape, null);

        assertEquals(1, sentMessages.size());
        assertEquals("/topic/rooms/room1/shape", sentMessages.get(0).destination());
        assertEquals(shape, sentMessages.get(0).payload());

        sentMessages.clear();
        controller.undo(new UndoRedoRequest("room1", "shape-undo"), null);

        assertEquals(1, sentMessages.size());
        assertTrue(sentMessages.get(0).payload() instanceof ShapeUndoRedoEvent);
        ShapeUndoRedoEvent undo = (ShapeUndoRedoEvent) sentMessages.get(0).payload();
        assertEquals("UNDO", undo.action());
        assertEquals("shape-1", undo.shapeId());
        assertEquals(1, undo.roomVersion());
    }

    @Test
    void testInvalidShapeAndWrongRoomVersionAreIgnored() {
        controller.shape(new ShapeEvent(
                "room1", "bad-shape", "RECTANGLE",
                0, 0, 0, 20, 0, 0, 0, 20, 1,
                "#2563eb", 3, 0), null);
        assertEquals(0, sentMessages.size());

        controller.clear(new ClearRequest("room1"));
        controller.shape(new ShapeEvent(
                "room1", "late-shape", "CIRCLE",
                0, 0, 0, 0, 0, 0, 10, 10, 0,
                "#2563eb", 3, 0), null);
        assertEquals(1, sentMessages.size());
    }
}
