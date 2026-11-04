package com.wisdom.wbs.controller;

import com.wisdom.wbs.dto.CreateRoomResponse;
import com.wisdom.wbs.dto.RoomResponse;
import com.wisdom.wbs.service.WhiteboardRoomService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/rooms")
@CrossOrigin(origins = "http://localhost:5173")
public class RoomController {

    private final WhiteboardRoomService roomService;

    public RoomController(WhiteboardRoomService roomService) {
        this.roomService = roomService;
    }

    private boolean validRoomId(String roomId) {
        return roomId != null && roomId.matches("^[a-zA-Z0-9_-]{1,50}$");
    }

    @PostMapping
    public ResponseEntity<?> createRoom() {
        try {
            CreateRoomResponse response = roomService.createRoom();
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to create room"));
        }
    }

    @GetMapping("/{roomId}")
    public ResponseEntity<?> getRoom(@PathVariable String roomId) {
        if (!validRoomId(roomId)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Invalid room ID"));
        }

        return roomService.findRoom(roomId)
                .map(room -> ResponseEntity.ok((Object) new RoomResponse(
                        room.getRoomId(),
                        room.getCreatedAt(),
                        room.getUpdatedAt()
                )))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body((Object) Map.of("error", "Room not found")));
    }
}
