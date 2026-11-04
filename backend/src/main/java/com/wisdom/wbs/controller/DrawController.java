package com.wisdom.wbs.controller;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import com.wisdom.wbs.service.WhiteboardRoomService;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class DrawController {

    private final SimpMessagingTemplate messagingTemplate;
    private final WhiteboardRoomService roomService;

    // Phiên bản hiện tại của từng phòng.
    private final ConcurrentHashMap<String, AtomicLong> roomVersions =
            new ConcurrentHashMap<>();

    public DrawController(
            SimpMessagingTemplate messagingTemplate,
            WhiteboardRoomService roomService) {
        this.messagingTemplate = messagingTemplate;
        this.roomService = roomService;
    }

    public record DrawEvent(
        String roomId,
        String strokeId,
        double[] points,
        String color,
        double width,
        long roomVersion
    ) {}

    public record ClearRequest(String roomId) {}

    public record ClearEvent(String roomId, long roomVersion) {}

    private boolean validRoomId(String roomId) {
        return roomId != null
                && roomId.matches("^[a-zA-Z0-9_-]{1,50}$");
    }

    public long getRoomVersion(String roomId) {
        return roomVersions
                .computeIfAbsent(roomId, id -> new AtomicLong(0))
                .get();
    }

    @MessageMapping("/draw")
    public void draw(DrawEvent event) {
        if (event == null
                || !validRoomId(event.roomId())
                || event.strokeId() == null
                || !event.strokeId().matches("^[a-zA-Z0-9_-]{1,100}$")
                || event.points() == null
                || event.points().length < 2
                || event.points().length > 20000
                || event.points().length % 2 != 0
                || event.color() == null
                || !event.color().matches("^#[0-9a-fA-F]{6}$")
                || !Double.isFinite(event.width())
                || event.width() < 1
                || event.width() > 50) {
            return;
        }

        for (double point : event.points()) {
            if (!Double.isFinite(point) || Math.abs(point) > 100000) {
                return;
            }
        }

        // Xác thực phòng có tồn tại trong hệ thống trước khi broadcast
        if (!roomService.roomExists(event.roomId())) {
            return;
        }

        long currentVersion = getRoomVersion(event.roomId());

        if (event.roomVersion() != currentVersion) {
            return;
        }

        messagingTemplate.convertAndSend(
            "/topic/rooms/" + event.roomId() + "/draw",
            event
        );
    }

    @MessageMapping("/clear")
    public void clear(ClearRequest request) {
        if (request == null || !validRoomId(request.roomId())) {
            return;
        }

        // Xác thực phòng có tồn tại trong hệ thống trước khi broadcast
        if (!roomService.roomExists(request.roomId())) {
            return;
        }

        AtomicLong version = roomVersions.computeIfAbsent(
            request.roomId(), id -> new AtomicLong(0)
        );

        long newVersion = version.incrementAndGet();

        messagingTemplate.convertAndSend(
            "/topic/rooms/" + request.roomId() + "/clear",
            new ClearEvent(request.roomId(), newVersion)
        );
    }
}
