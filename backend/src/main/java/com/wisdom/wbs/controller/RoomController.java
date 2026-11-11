package com.wisdom.wbs.controller;

import com.wisdom.wbs.dto.ChatMessageDTO;
import com.wisdom.wbs.service.RoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class RoomController {

    private final RoomService roomService;

    @GetMapping("/{roomId}/canvas")
    public ResponseEntity getCanvasState(@PathVariable UUID roomId) {
        String snapshot = roomService.getCanvasSnapshot(roomId);
        return ResponseEntity.ok(Map.of("canvasState", snapshot));
    }

    @PostMapping("/{roomId}/canvas/snapshot")
    public ResponseEntity<Void> saveCanvasState(
            @PathVariable UUID roomId,
            @RequestBody Map<String, String> payload) {
        String canvasData = payload.get("canvasState");
        roomService.saveCanvasSnapshot(roomId, canvasData);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{roomId}/messages")
    public ResponseEntity<List<ChatMessageDTO>> getRecentMessages(
            @PathVariable UUID roomId,
            @RequestParam(defaultValue = "50") int limit) {
        return ResponseEntity.ok(roomService.getRecentMessages(roomId, limit));
    }
}