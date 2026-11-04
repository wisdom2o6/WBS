package com.wisdom.wbs.controller;

import tools.jackson.databind.ObjectMapper;
import com.wisdom.wbs.entity.WhiteboardState;
import com.wisdom.wbs.repository.WhiteboardStateRepository;
import com.wisdom.wbs.service.WhiteboardRoomService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class WhiteboardStateControllerTest {

    private WhiteboardStateController controller;
    private DrawController drawController;

    @BeforeEach
    void setUp() {
        WhiteboardStateRepository fakeRepo = new WhiteboardStateRepository() {
            @Override
            public Optional<WhiteboardState> findById(String s) {
                if ("room1".equals(s)) {
                    return Optional.of(new WhiteboardState("room1", "{\"lines\":[{\"strokeId\":\"s1\"}]}"));
                }
                return Optional.empty();
            }

            @Override public boolean existsById(String s) { return "room1".equals(s) || "emptyRoom".equals(s); }
            @Override public <S extends WhiteboardState> S save(S entity) { return entity; }
            @Override public void flush() {}
            @Override public <S extends WhiteboardState> S saveAndFlush(S entity) { return entity; }
            @Override public <S extends WhiteboardState> java.util.List<S> saveAllAndFlush(Iterable<S> entities) { return java.util.List.of(); }
            @Override public void deleteAllInBatch(Iterable<WhiteboardState> entities) {}
            @Override public void deleteAllByIdInBatch(Iterable<String> strings) {}
            @Override public void deleteAllInBatch() {}
            @Override public WhiteboardState getOne(String s) { return null; }
            @Override public WhiteboardState getById(String s) { return null; }
            @Override public WhiteboardState getReferenceById(String s) { return null; }
            @Override public <S extends WhiteboardState> Optional<S> findOne(org.springframework.data.domain.Example<S> example) { return Optional.empty(); }
            @Override public <S extends WhiteboardState> java.util.List<S> findAll(org.springframework.data.domain.Example<S> example) { return java.util.List.of(); }
            @Override public <S extends WhiteboardState> java.util.List<S> findAll(org.springframework.data.domain.Example<S> example, org.springframework.data.domain.Sort sort) { return java.util.List.of(); }
            @Override public <S extends WhiteboardState> org.springframework.data.domain.Page<S> findAll(org.springframework.data.domain.Example<S> example, org.springframework.data.domain.Pageable pageable) { return org.springframework.data.domain.Page.empty(); }
            @Override public <S extends WhiteboardState> long count(org.springframework.data.domain.Example<S> example) { return 0; }
            @Override public <S extends WhiteboardState> boolean exists(org.springframework.data.domain.Example<S> example) { return false; }
            @Override public <S extends WhiteboardState, R> R findBy(org.springframework.data.domain.Example<S> example, java.util.function.Function<org.springframework.data.repository.query.FluentQuery.FetchableFluentQuery<S>, R> queryFunction) { return null; }
            @Override public <S extends WhiteboardState> java.util.List<S> saveAll(Iterable<S> entities) { return java.util.List.of(); }
            @Override public java.util.List<WhiteboardState> findAll() { return java.util.List.of(); }
            @Override public java.util.List<WhiteboardState> findAllById(Iterable<String> strings) { return java.util.List.of(); }
            @Override public long count() { return 0; }
            @Override public void deleteById(String s) {}
            @Override public void delete(WhiteboardState entity) {}
            @Override public void deleteAllById(Iterable<? extends String> strings) {}
            @Override public void deleteAll(Iterable<? extends WhiteboardState> entities) {}
            @Override public void deleteAll() {}
            @Override public java.util.List<WhiteboardState> findAll(org.springframework.data.domain.Sort sort) { return java.util.List.of(); }
            @Override public org.springframework.data.domain.Page<WhiteboardState> findAll(org.springframework.data.domain.Pageable pageable) { return org.springframework.data.domain.Page.empty(); }
        };

        WhiteboardRoomService fakeRoomService = new WhiteboardRoomService(null, null) {
            @Override
            public boolean roomExists(String roomId) {
                return "room1".equals(roomId) || "emptyRoom".equals(roomId);
            }
        };

        SimpMessagingTemplate fakeMessagingTemplate = new SimpMessagingTemplate((message, timeout) -> true);
        drawController = new DrawController(fakeMessagingTemplate, fakeRoomService);

        // Advance room1 version to 3
        drawController.clear(new DrawController.ClearRequest("room1"));
        drawController.clear(new DrawController.ClearRequest("room1"));
        drawController.clear(new DrawController.ClearRequest("room1"));

        ObjectMapper objectMapper = new ObjectMapper();

        controller = new WhiteboardStateController(fakeRepo, fakeRoomService, objectMapper, drawController);
    }

    @Test
    void testLoadStateIncludesRoomVersion() {
        ResponseEntity<?> response = controller.loadState("room1");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody() instanceof Map);
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals("room1", body.get("roomId"));
        assertEquals(3L, body.get("roomVersion"));
    }

    @Test
    void testLoadStateEmptyRoomIncludesRoomVersion() {
        ResponseEntity<?> response = controller.loadState("emptyRoom");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody() instanceof Map);
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals("emptyRoom", body.get("roomId"));
        assertEquals(0L, body.get("roomVersion"));
    }

    @Test
    void testLoadStateNonExistentRoomReturns404() {
        ResponseEntity<?> response = controller.loadState("nonExistent");
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }
}

