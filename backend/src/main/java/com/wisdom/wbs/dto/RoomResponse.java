package com.wisdom.wbs.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomResponse {
    private UUID id;
    private UUID projectId;
    private String name;
    private String description;
    private UUID createdById;
    private String createdByName;
    private Instant createdAt;
}