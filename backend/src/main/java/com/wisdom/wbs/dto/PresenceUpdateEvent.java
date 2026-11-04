package com.wisdom.wbs.dto;

import java.util.List;

public record PresenceUpdateEvent(
        String type,
        String roomId,
        List<ParticipantDto> participants
) {}

