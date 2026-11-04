package com.wisdom.wbs.service;

import com.wisdom.wbs.dto.CreateRoomResponse;
import com.wisdom.wbs.entity.WhiteboardRoom;
import com.wisdom.wbs.entity.WhiteboardState;
import com.wisdom.wbs.repository.WhiteboardRoomRepository;
import com.wisdom.wbs.repository.WhiteboardStateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Example;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.repository.query.FluentQuery;

import java.util.*;
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.*;

class WhiteboardRoomServiceTest {

    private Map<String, WhiteboardRoom> roomStore;
    private Map<String, WhiteboardState> stateStore;
    private WhiteboardRoomService service;

    @BeforeEach
    void setUp() {
        roomStore = new HashMap<>();
        stateStore = new HashMap<>();

        WhiteboardRoomRepository fakeRoomRepo = new FakeRoomRepository(roomStore);
        WhiteboardStateRepository fakeStateRepo = new FakeStateRepository(stateStore);

        service = new WhiteboardRoomService(fakeRoomRepo, fakeStateRepo);
    }

    @Test
    void testCreateRoomCreatesStateAndSaves() {
        CreateRoomResponse response = service.createRoom();

        assertNotNull(response);
        assertNotNull(response.roomId());
        assertEquals(8, response.roomId().length());
        assertEquals("Room created successfully", response.message());

        assertTrue(roomStore.containsKey(response.roomId()));
        assertTrue(stateStore.containsKey(response.roomId()));
        assertEquals("{\"lines\":[]}", stateStore.get(response.roomId()).getData());
    }

    @Test
    void testFindRoomExisting() {
        WhiteboardRoom room = new WhiteboardRoom("abc12345");
        roomStore.put("abc12345", room);

        Optional<WhiteboardRoom> found = service.findRoom("abc12345");
        assertTrue(found.isPresent());
        assertEquals("abc12345", found.get().getRoomId());
    }

    @Test
    void testFindRoomLegacyRoom1Migration() {
        // Giả lập phòng legacy room-1 chỉ có trong stateStore, chưa có trong roomStore
        WhiteboardState oldState = new WhiteboardState("room-1", "{\"lines\":[{\"strokeId\":\"s1\"}]}");
        stateStore.put("room-1", oldState);

        Optional<WhiteboardRoom> found = service.findRoom("room-1");
        assertTrue(found.isPresent());
        assertEquals("room-1", found.get().getRoomId());
        // Đảm bảo room-1 đã được tự động lưu vào roomStore
        assertTrue(roomStore.containsKey("room-1"));
    }

    @Test
    void testFindRoomNotFound() {
        Optional<WhiteboardRoom> found = service.findRoom("notExistRoom");
        assertFalse(found.isPresent());
    }

    // Fake in-memory repositories
    private static class FakeRoomRepository implements WhiteboardRoomRepository {
        private final Map<String, WhiteboardRoom> store;

        FakeRoomRepository(Map<String, WhiteboardRoom> store) {
            this.store = store;
        }

        @Override
        public boolean existsById(String id) {
            return store.containsKey(id);
        }

        @Override
        public Optional<WhiteboardRoom> findById(String id) {
            return Optional.ofNullable(store.get(id));
        }

        @Override
        public <S extends WhiteboardRoom> S save(S entity) {
            store.put(entity.getRoomId(), entity);
            return entity;
        }

        @Override public void flush() {}
        @Override public <S extends WhiteboardRoom> S saveAndFlush(S entity) { return save(entity); }
        @Override public <S extends WhiteboardRoom> List<S> saveAllAndFlush(Iterable<S> entities) { return List.of(); }
        @Override public void deleteAllInBatch(Iterable<WhiteboardRoom> entities) {}
        @Override public void deleteAllByIdInBatch(Iterable<String> strings) {}
        @Override public void deleteAllInBatch() {}
        @Override public WhiteboardRoom getOne(String s) { return store.get(s); }
        @Override public WhiteboardRoom getById(String s) { return store.get(s); }
        @Override public WhiteboardRoom getReferenceById(String s) { return store.get(s); }
        @Override public <S extends WhiteboardRoom> Optional<S> findOne(Example<S> example) { return Optional.empty(); }
        @Override public <S extends WhiteboardRoom> List<S> findAll(Example<S> example) { return List.of(); }
        @Override public <S extends WhiteboardRoom> List<S> findAll(Example<S> example, Sort sort) { return List.of(); }
        @Override public <S extends WhiteboardRoom> Page<S> findAll(Example<S> example, Pageable pageable) { return Page.empty(); }
        @Override public <S extends WhiteboardRoom> long count(Example<S> example) { return 0; }
        @Override public <S extends WhiteboardRoom> boolean exists(Example<S> example) { return false; }
        @Override public <S extends WhiteboardRoom, R> R findBy(Example<S> example, Function<FluentQuery.FetchableFluentQuery<S>, R> queryFunction) { return null; }
        @Override public <S extends WhiteboardRoom> List<S> saveAll(Iterable<S> entities) { return List.of(); }
        @Override public List<WhiteboardRoom> findAll() { return new ArrayList<>(store.values()); }
        @Override public List<WhiteboardRoom> findAllById(Iterable<String> strings) { return List.of(); }
        @Override public long count() { return store.size(); }
        @Override public void deleteById(String s) { store.remove(s); }
        @Override public void delete(WhiteboardRoom entity) { store.remove(entity.getRoomId()); }
        @Override public void deleteAllById(Iterable<? extends String> strings) {}
        @Override public void deleteAll(Iterable<? extends WhiteboardRoom> entities) {}
        @Override public void deleteAll() { store.clear(); }
        @Override public List<WhiteboardRoom> findAll(Sort sort) { return findAll(); }
        @Override public Page<WhiteboardRoom> findAll(Pageable pageable) { return Page.empty(); }
    }

    private static class FakeStateRepository implements WhiteboardStateRepository {
        private final Map<String, WhiteboardState> store;

        FakeStateRepository(Map<String, WhiteboardState> store) {
            this.store = store;
        }

        @Override
        public boolean existsById(String id) {
            return store.containsKey(id);
        }

        @Override
        public Optional<WhiteboardState> findById(String id) {
            return Optional.ofNullable(store.get(id));
        }

        @Override
        public <S extends WhiteboardState> S save(S entity) {
            store.put(entity.getRoomId(), entity);
            return entity;
        }

        @Override public void flush() {}
        @Override public <S extends WhiteboardState> S saveAndFlush(S entity) { return save(entity); }
        @Override public <S extends WhiteboardState> List<S> saveAllAndFlush(Iterable<S> entities) { return List.of(); }
        @Override public void deleteAllInBatch(Iterable<WhiteboardState> entities) {}
        @Override public void deleteAllByIdInBatch(Iterable<String> strings) {}
        @Override public void deleteAllInBatch() {}
        @Override public WhiteboardState getOne(String s) { return store.get(s); }
        @Override public WhiteboardState getById(String s) { return store.get(s); }
        @Override public WhiteboardState getReferenceById(String s) { return store.get(s); }
        @Override public <S extends WhiteboardState> Optional<S> findOne(Example<S> example) { return Optional.empty(); }
        @Override public <S extends WhiteboardState> List<S> findAll(Example<S> example) { return List.of(); }
        @Override public <S extends WhiteboardState> List<S> findAll(Example<S> example, Sort sort) { return List.of(); }
        @Override public <S extends WhiteboardState> Page<S> findAll(Example<S> example, Pageable pageable) { return Page.empty(); }
        @Override public <S extends WhiteboardState> long count(Example<S> example) { return 0; }
        @Override public <S extends WhiteboardState> boolean exists(Example<S> example) { return false; }
        @Override public <S extends WhiteboardState, R> R findBy(Example<S> example, Function<FluentQuery.FetchableFluentQuery<S>, R> queryFunction) { return null; }
        @Override public <S extends WhiteboardState> List<S> saveAll(Iterable<S> entities) { return List.of(); }
        @Override public List<WhiteboardState> findAll() { return new ArrayList<>(store.values()); }
        @Override public List<WhiteboardState> findAllById(Iterable<String> strings) { return List.of(); }
        @Override public long count() { return store.size(); }
        @Override public void deleteById(String s) { store.remove(s); }
        @Override public void delete(WhiteboardState entity) { store.remove(entity.getRoomId()); }
        @Override public void deleteAllById(Iterable<? extends String> strings) {}
        @Override public void deleteAll(Iterable<? extends WhiteboardState> entities) {}
        @Override public void deleteAll() { store.clear(); }
        @Override public List<WhiteboardState> findAll(Sort sort) { return findAll(); }
        @Override public Page<WhiteboardState> findAll(Pageable pageable) { return Page.empty(); }
    }
}
