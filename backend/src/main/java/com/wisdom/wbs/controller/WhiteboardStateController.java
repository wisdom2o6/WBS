package com.wisdom.wbs.controller;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import com.wisdom.wbs.entity.WhiteboardState;
import com.wisdom.wbs.repository.WhiteboardStateRepository;
import com.wisdom.wbs.service.WhiteboardRoomService;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/rooms")
@CrossOrigin(origins = "http://localhost:5173")
public class WhiteboardStateController {

    private final WhiteboardStateRepository repository;
    private final WhiteboardRoomService roomService;
    private final ObjectMapper objectMapper;
    private final DrawController drawController;

    public WhiteboardStateController(
            WhiteboardStateRepository repository,
            WhiteboardRoomService roomService,
            ObjectMapper objectMapper,
            DrawController drawController) {
        this.repository = repository;
        this.roomService = roomService;
        this.objectMapper = objectMapper;
        this.drawController = drawController;
    }

    private boolean validRoomId(String roomId) {
        return roomId != null
                && roomId.matches("^[a-zA-Z0-9_-]{1,50}$");
    }

    @GetMapping("/{roomId}/state")
    public ResponseEntity<?> loadState(@PathVariable String roomId) {
        if (!validRoomId(roomId)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Invalid room ID"));
        }

        if (!roomService.roomExists(roomId)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Room not found"));
        }

        long roomVersion = drawController.getRoomVersion(roomId);

        return repository.findById(roomId)
                .map(state -> {
                    try {
                        JsonNode data =
                                objectMapper.readTree(state.getData());

                        return ResponseEntity.ok(Map.of(
                                "roomId", state.getRoomId(),
                                "data", data,
                                "roomVersion", roomVersion,
                                "updatedAt", state.getUpdatedAt()
                        ));
                    } catch (Exception e) {
                        return ResponseEntity
                                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                                .body(Map.of("error",
                                        "Cannot read saved whiteboard"));
                    }
                })
                .orElseGet(() -> ResponseEntity.ok(Map.of(
                        "roomId", roomId,
                        "data", Map.of("lines", new Object[0]),
                        "roomVersion", roomVersion,
                        "updatedAt", ""
                )));
    }

    @PutMapping(
            value = "/{roomId}/state",
            consumes = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<?> saveState(
            @PathVariable String roomId,
            @RequestBody JsonNode body) {

        if (!validRoomId(roomId)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Invalid room ID"));
        }

        if (!roomService.roomExists(roomId)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Room not found"));
        }

        if (body == null || !body.isObject()
                || !body.has("lines")
                || !body.get("lines").isArray()
                || (body.has("shapes") && !body.get("shapes").isArray())
                || (body.has("texts") && !body.get("texts").isArray())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Expected lines, shapes, and texts arrays"));
        }

        int shapeCount = body.has("shapes") ? body.get("shapes").size() : 0;
        int textCount = body.has("texts") ? body.get("texts").size() : 0;
        if (body.get("lines").size() + shapeCount + textCount > 10000) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Too many drawing elements"));
        }

        try {
            String json = objectMapper.writeValueAsString(body);

            WhiteboardState state = repository.findById(roomId)
                    .orElseGet(() -> new WhiteboardState(roomId, json));

            state.setData(json);
            state.setUpdatedAt(LocalDateTime.now());

            repository.save(state);

            return ResponseEntity.ok(Map.of(
                "message", "Whiteboard saved",
                "roomId", roomId,
                "updatedAt", state.getUpdatedAt()
            ));
        } catch (Exception e) {
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Cannot save whiteboard"));
        }
    }
}
