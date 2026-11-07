package com.wisdom.wbs.controller;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import com.wisdom.wbs.service.PresenceService;
import com.wisdom.wbs.service.WhiteboardRoomService;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.beans.factory.annotation.Autowired;

@Controller
public class DrawController {

    private final SimpMessagingTemplate messagingTemplate;
    private final WhiteboardRoomService roomService;
    private final PresenceService presenceService;

    // Phiên bản hiện tại của từng phòng.
    private final ConcurrentHashMap<String, AtomicLong> roomVersions =
            new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, RoomHistory> roomHistories =
            new ConcurrentHashMap<>();

    @Autowired
    public DrawController(
            SimpMessagingTemplate messagingTemplate,
            WhiteboardRoomService roomService,
            PresenceService presenceService) {
        this.messagingTemplate = messagingTemplate;
        this.roomService = roomService;
        this.presenceService = presenceService;
    }

    public DrawController(
            SimpMessagingTemplate messagingTemplate,
            WhiteboardRoomService roomService) {
        this.messagingTemplate = messagingTemplate;
        this.roomService = roomService;
        this.presenceService = null;
    }

    public record DrawEvent(
        String roomId,
        String strokeId,
        double[] points,
        String color,
        double width,
        long roomVersion
    ) {}

    public record ShapeEvent(
        String roomId,
        String shapeId,
        String type,
        double x,
        double y,
        double width,
        double height,
        double startX,
        double startY,
        double endX,
        double endY,
        double radius,
        String color,
        double strokeWidth,
        long roomVersion
    ) {}

    public record ClearRequest(String roomId) {}

    public record ClearEvent(String roomId, long roomVersion) {}

    public record UndoRedoRequest(String roomId, String requestId) {
        public UndoRedoRequest(String roomId) {
            this(roomId, null);
        }
    }

    public record UndoRedoEvent(
            String action,
            String roomId,
            String strokeId,
            double[] points,
            String color,
            double width,
            long roomVersion
    ) {}

    public record ShapeUndoRedoEvent(
            String action,
            String roomId,
            String shapeId,
            String type,
            double x,
            double y,
            double width,
            double height,
            double startX,
            double startY,
            double endX,
            double endY,
            double radius,
            String color,
            double strokeWidth,
            long roomVersion
    ) {}

    private record Operation(
            String elementType,
            String strokeId,
            double[] points,
            String color,
            double width,
            ShapeEvent shape
    ) {}

    private static final class RoomHistory {
        private final ConcurrentHashMap<String, java.util.LinkedHashMap<String, Operation>> activeByParticipant =
                new ConcurrentHashMap<>();
        private final ConcurrentHashMap<String, java.util.ArrayDeque<Operation>> redoByParticipant =
                new ConcurrentHashMap<>();
        private final ConcurrentHashMap<String, java.util.Set<String>> processedRequestsByParticipant =
                new ConcurrentHashMap<>();
    }

    private boolean validRoomId(String roomId) {
        return roomId != null
                && roomId.matches("^[a-zA-Z0-9_-]{1,50}$");
    }

    public long getRoomVersion(String roomId) {
        return roomVersions
                .computeIfAbsent(roomId, id -> new AtomicLong(0))
                .get();
    }

    public void draw(DrawEvent event) {
        draw(event, null);
    }

    @MessageMapping("/draw")
    public void draw(DrawEvent event, SimpMessageHeaderAccessor headerAccessor) {
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

        String participantId = participantId(event.roomId(), headerAccessor);
        if (participantId == null) {
            return;
        }

        long currentVersion = getRoomVersion(event.roomId());

        if (event.roomVersion() != currentVersion) {
            return;
        }

        RoomHistory history = roomHistories.computeIfAbsent(
                event.roomId(), id -> new RoomHistory());
        synchronized (history) {
            java.util.LinkedHashMap<String, Operation> active =
                    history.activeByParticipant.computeIfAbsent(
                            participantId, id -> new java.util.LinkedHashMap<>());
            if (active.containsKey(event.strokeId())) {
                active.put(event.strokeId(), operationOf(event));
            } else {
                for (java.util.ArrayDeque<Operation> redo
                        : history.redoByParticipant.values()) {
                    if (redo.stream().anyMatch(op -> op.strokeId().equals(event.strokeId()))) {
                        return;
                    }
                }
                active.put(event.strokeId(), operationOf(event));
                history.redoByParticipant
                        .computeIfAbsent(participantId, id -> new java.util.ArrayDeque<>())
                        .clear();
            }
        }

        messagingTemplate.convertAndSend(
            "/topic/rooms/" + event.roomId() + "/draw",
            event
        );
    }

    @MessageMapping("/shape")
    public void shape(ShapeEvent event, SimpMessageHeaderAccessor headerAccessor) {
        if (event == null
                || !validRoomId(event.roomId())
                || event.shapeId() == null
                || !event.shapeId().matches("^[a-zA-Z0-9_-]{1,100}$")
                || event.type() == null
                || !event.type().matches("^(RECTANGLE|CIRCLE|LINE|ARROW)$")
                || event.color() == null
                || !event.color().matches("^#[0-9a-fA-F]{6}$")
                || !Double.isFinite(event.strokeWidth())
                || event.strokeWidth() < 1
                || event.strokeWidth() > 50
                || !validGeometry(event)) {
            return;
        }
        if (!roomService.roomExists(event.roomId())) {
            return;
        }
        String participantId = participantId(event.roomId(), headerAccessor);
        if (participantId == null || event.roomVersion() != getRoomVersion(event.roomId())) {
            return;
        }

        RoomHistory history = roomHistories.computeIfAbsent(
                event.roomId(), id -> new RoomHistory());
        synchronized (history) {
            java.util.LinkedHashMap<String, Operation> active =
                    history.activeByParticipant.computeIfAbsent(
                            participantId, id -> new java.util.LinkedHashMap<>());
            if (active.containsKey(event.shapeId())) {
                active.put(event.shapeId(), operationOf(event));
            } else {
                for (java.util.ArrayDeque<Operation> redo : history.redoByParticipant.values()) {
                    if (redo.stream().anyMatch(op -> event.shapeId().equals(op.strokeId()))) {
                        return;
                    }
                }
                active.put(event.shapeId(), operationOf(event));
                history.redoByParticipant
                        .computeIfAbsent(participantId, id -> new java.util.ArrayDeque<>())
                        .clear();
            }
        }
        messagingTemplate.convertAndSend(
                "/topic/rooms/" + event.roomId() + "/shape", event);
    }

    public void clear(ClearRequest request) {
        clear(request, null);
    }

    @MessageMapping("/clear")
    public void clear(ClearRequest request, SimpMessageHeaderAccessor headerAccessor) {
        if (request == null || !validRoomId(request.roomId())) {
            return;
        }

        // Xác thực phòng có tồn tại trong hệ thống trước khi broadcast
        if (!roomService.roomExists(request.roomId())) {
            return;
        }

        if (participantId(request.roomId(), headerAccessor) == null) {
            return;
        }

        AtomicLong version = roomVersions.computeIfAbsent(
            request.roomId(), id -> new AtomicLong(0)
        );
        RoomHistory history = roomHistories.computeIfAbsent(
                request.roomId(), id -> new RoomHistory());

        synchronized (history) {
            history.activeByParticipant.clear();
            history.redoByParticipant.clear();
            history.processedRequestsByParticipant.clear();
            long newVersion = version.incrementAndGet();

            messagingTemplate.convertAndSend(
                    "/topic/rooms/" + request.roomId() + "/clear",
                    new ClearEvent(request.roomId(), newVersion)
            );
        }
    }

    @MessageMapping("/undo")
    public void undo(
            UndoRedoRequest request,
            SimpMessageHeaderAccessor headerAccessor) {
        applyUndoRedo(request, headerAccessor, false);
    }

    public void undo(UndoRedoRequest request) {
        undo(request, null);
    }

    @MessageMapping("/redo")
    public void redo(
            UndoRedoRequest request,
            SimpMessageHeaderAccessor headerAccessor) {
        applyUndoRedo(request, headerAccessor, true);
    }

    public void redo(UndoRedoRequest request) {
        redo(request, null);
    }

    private void applyUndoRedo(
            UndoRedoRequest request,
            SimpMessageHeaderAccessor headerAccessor,
            boolean redo) {
        if (request == null || !validRoomId(request.roomId())
                || !roomService.roomExists(request.roomId())) {
            return;
        }

        String participantId = participantId(request.roomId(), headerAccessor);
        if (participantId == null) {
            return;
        }

        RoomHistory history = roomHistories.computeIfAbsent(
                request.roomId(), id -> new RoomHistory());
        synchronized (history) {
            if (request.requestId() != null
                    && !request.requestId().matches("^[a-zA-Z0-9_-]{1,100}$")) {
                return;
            }
            java.util.Set<String> processedRequests =
                    history.processedRequestsByParticipant.computeIfAbsent(
                            participantId, id -> ConcurrentHashMap.newKeySet());
            if (request.requestId() != null
                    && !processedRequests.add(request.requestId())) {
                return;
            }

            java.util.LinkedHashMap<String, Operation> active =
                    history.activeByParticipant.computeIfAbsent(
                            participantId, id -> new java.util.LinkedHashMap<>());
            java.util.ArrayDeque<Operation> redoStack =
                    history.redoByParticipant.computeIfAbsent(
                            participantId, id -> new java.util.ArrayDeque<>());

            Operation operation;
            if (redo) {
                operation = redoStack.pollLast();
                if (operation == null) {
                    return;
                }
                active.put(operation.strokeId(), operation);
            } else {
                if (active.isEmpty()) {
                    return;
                }
                String strokeId = active.keySet().stream().reduce((first, second) -> second)
                        .orElse(null);
                operation = strokeId == null ? null : active.remove(strokeId);
                if (operation == null) {
                    return;
                }
                redoStack.addLast(operation);
            }

            long newVersion = roomVersions
                    .computeIfAbsent(request.roomId(), id -> new AtomicLong(0))
                    .incrementAndGet();
            if ("SHAPE".equals(operation.elementType())) {
                ShapeEvent shape = operation.shape();
                messagingTemplate.convertAndSend(
                        "/topic/rooms/" + request.roomId() + "/undo",
                        new ShapeUndoRedoEvent(
                                redo ? "REDO" : "UNDO",
                                request.roomId(),
                                shape.shapeId(),
                                shape.type(),
                                shape.x(), shape.y(), shape.width(), shape.height(),
                                shape.startX(), shape.startY(), shape.endX(), shape.endY(),
                                shape.radius(), shape.color(), shape.strokeWidth(), newVersion
                        )
                );
            } else {
                messagingTemplate.convertAndSend(
                        "/topic/rooms/" + request.roomId() + "/undo",
                        new UndoRedoEvent(
                                redo ? "REDO" : "UNDO",
                                request.roomId(),
                                operation.strokeId(),
                                operation.points(),
                                operation.color(),
                                operation.width(),
                                newVersion
                        )
                );
            }
        }
    }

    private String participantId(
            String roomId,
            SimpMessageHeaderAccessor headerAccessor) {
        if (headerAccessor == null) {
            return presenceService == null ? "test-session" : null;
        }

        String sessionId = headerAccessor.getSessionId();
        if (sessionId == null || presenceService == null
                || presenceService.getParticipant(roomId, sessionId).isEmpty()) {
            return null;
        }
        return sessionId;
    }

    private Operation operationOf(DrawEvent event) {
        return new Operation(
                "STROKE",
                event.strokeId(),
                event.points().clone(),
                event.color(),
                event.width(),
                null
        );
    }

    private Operation operationOf(ShapeEvent event) {
        return new Operation("SHAPE", event.shapeId(), null, event.color(), event.strokeWidth(), event);
    }

    private boolean validGeometry(ShapeEvent event) {
        double[] values = {
                event.x(), event.y(), event.width(), event.height(),
                event.startX(), event.startY(), event.endX(), event.endY(), event.radius()
        };
        for (double value : values) {
            if (!Double.isFinite(value) || Math.abs(value) > 100000) {
                return false;
            }
        }
        if ("CIRCLE".equals(event.type())) {
            return event.radius() > 0;
        }
        if ("RECTANGLE".equals(event.type())) {
            return event.width() > 0 && event.height() > 0;
        }
        return event.startX() != event.endX() || event.startY() != event.endY();
    }
}
