package com.wisdom.wbs.controller;

import com.wisdom.wbs.dto.CreateRoomResponse;
import com.wisdom.wbs.dto.RoomResponse;
import com.wisdom.wbs.entity.WhiteboardRoom;
import com.wisdom.wbs.service.WhiteboardRoomService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class RoomControllerTest {

    @Test
    void testCreateRoomSuccess() {
        LocalDateTime now = LocalDateTime.now();
        WhiteboardRoomService fakeService = new WhiteboardRoomService(null, null) {
            @Override
            public CreateRoomResponse createRoom() {
                return new CreateRoomResponse("a8F3kP2x", "Room created successfully", now);
            }
        };

        RoomController controller = new RoomController(fakeService);
        ResponseEntity<?> response = controller.createRoom();

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertTrue(response.getBody() instanceof CreateRoomResponse);
        assertEquals("a8F3kP2x", ((CreateRoomResponse) response.getBody()).roomId());
    }

    @Test
    void testGetRoomFound() {
        LocalDateTime now = LocalDateTime.now();
        WhiteboardRoomService fakeService = new WhiteboardRoomService(null, null) {
            @Override
            public Optional<WhiteboardRoom> findRoom(String roomId) {
                if ("a8F3kP2x".equals(roomId)) {
                    return Optional.of(new WhiteboardRoom("a8F3kP2x", now, now));
                }
                return Optional.empty();
            }
        };

        RoomController controller = new RoomController(fakeService);
        ResponseEntity<?> response = controller.getRoom("a8F3kP2x");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody() instanceof RoomResponse);
        assertEquals("a8F3kP2x", ((RoomResponse) response.getBody()).roomId());
    }

    @Test
    void testGetRoomNotFound() {
        WhiteboardRoomService fakeService = new WhiteboardRoomService(null, null) {
            @Override
            public Optional<WhiteboardRoom> findRoom(String roomId) {
                return Optional.empty();
            }
        };

        RoomController controller = new RoomController(fakeService);
        ResponseEntity<?> response = controller.getRoom("nonexistent");

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        assertTrue(response.getBody() instanceof Map);
        assertEquals("Room not found", ((Map<?, ?>) response.getBody()).get("error"));
    }

    @Test
    void testGetRoomInvalidId() {
        WhiteboardRoomService fakeService = new WhiteboardRoomService(null, null);
        RoomController controller = new RoomController(fakeService);
        ResponseEntity<?> response = controller.getRoom("invalid/id!");

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertTrue(response.getBody() instanceof Map);
        assertEquals("Invalid room ID", ((Map<?, ?>) response.getBody()).get("error"));
    }
}
