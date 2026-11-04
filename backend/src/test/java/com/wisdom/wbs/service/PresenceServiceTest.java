package com.wisdom.wbs.service;

import com.wisdom.wbs.dto.ParticipantDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class PresenceServiceTest {

    private PresenceService presenceService;

    @BeforeEach
    void setUp() {
        WhiteboardRoomService fakeRoomService = new WhiteboardRoomService(null, null) {
            @Override
            public boolean roomExists(String roomId) {
                return roomId != null && !roomId.equals("non_existent_room");
            }
        };
        presenceService = new PresenceService(fakeRoomService);
    }

    @Test
    void testRegisterParticipantSuccess() {
        Optional<List<ParticipantDto>> result = presenceService.registerParticipant(
                "room123", "sess-1", "Alice"
        );

        assertTrue(result.isPresent());
        List<ParticipantDto> participants = result.get();
        assertEquals(1, participants.size());
        assertEquals("sess-1", participants.get(0).sessionId());
        assertEquals("Alice", participants.get(0).displayName());
        assertNotNull(participants.get(0).joinedAt());
    }

    @Test
    void testRegisterParticipantInvalidDisplayName() {
        Optional<List<ParticipantDto>> emptyName = presenceService.registerParticipant(
                "room123", "sess-1", "   "
        );
        assertTrue(emptyName.isEmpty());

        Optional<List<ParticipantDto>> nullName = presenceService.registerParticipant(
                "room123", "sess-1", null
        );
        assertTrue(nullName.isEmpty());

        Optional<List<ParticipantDto>> tooLongName = presenceService.registerParticipant(
                "room123", "sess-1", "A".repeat(31)
        );
        assertTrue(tooLongName.isEmpty());
    }

    @Test
    void testRegisterParticipantNonExistentRoom() {
        Optional<List<ParticipantDto>> result = presenceService.registerParticipant(
                "non_existent_room", "sess-1", "Alice"
        );
        assertTrue(result.isEmpty());
    }

    @Test
    void testMultipleParticipantsSameRoom() {
        presenceService.registerParticipant("room123", "sess-1", "Alice");
        Optional<List<ParticipantDto>> result = presenceService.registerParticipant(
                "room123", "sess-2", "Bob"
        );

        assertTrue(result.isPresent());
        List<ParticipantDto> participants = result.get();
        assertEquals(2, participants.size());
        assertTrue(participants.stream().anyMatch(p -> p.displayName().equals("Alice")));
        assertTrue(participants.stream().anyMatch(p -> p.displayName().equals("Bob")));
    }

    @Test
    void testRemoveParticipant() {
        presenceService.registerParticipant("room123", "sess-1", "Alice");
        presenceService.registerParticipant("room123", "sess-2", "Bob");

        Optional<List<ParticipantDto>> afterRemove = presenceService.removeParticipant("room123", "sess-1");

        assertTrue(afterRemove.isPresent());
        List<ParticipantDto> participants = afterRemove.get();
        assertEquals(1, participants.size());
        assertEquals("Bob", participants.get(0).displayName());
    }

    @Test
    void testRemoveParticipantCleansUpEmptyRoom() {
        presenceService.registerParticipant("room123", "sess-1", "Alice");

        Optional<List<ParticipantDto>> afterRemove = presenceService.removeParticipant("room123", "sess-1");

        assertTrue(afterRemove.isPresent());
        assertTrue(afterRemove.get().isEmpty());
        assertTrue(presenceService.getParticipants("room123").isEmpty());
    }

    @Test
    void testRemoveSessionOnDisconnect() {
        presenceService.registerParticipant("room1", "sess-1", "Alice");
        presenceService.registerParticipant("room2", "sess-1", "Alice");
        presenceService.registerParticipant("room1", "sess-2", "Bob");

        Map<String, List<ParticipantDto>> affected = presenceService.removeSession("sess-1");

        assertEquals(2, affected.size());
        assertTrue(affected.containsKey("room1"));
        assertTrue(affected.containsKey("room2"));

        assertEquals(1, affected.get("room1").size());
        assertEquals("Bob", affected.get("room1").get(0).displayName());

        assertTrue(affected.get("room2").isEmpty());
    }

    @Test
    void testRoomIsolation() {
        presenceService.registerParticipant("roomA", "sess-1", "User A");
        presenceService.registerParticipant("roomB", "sess-2", "User B");

        List<ParticipantDto> roomAParticipants = presenceService.getParticipants("roomA");
        List<ParticipantDto> roomBParticipants = presenceService.getParticipants("roomB");

        assertEquals(1, roomAParticipants.size());
        assertEquals("User A", roomAParticipants.get(0).displayName());

        assertEquals(1, roomBParticipants.size());
        assertEquals("User B", roomBParticipants.get(0).displayName());
    }
}

