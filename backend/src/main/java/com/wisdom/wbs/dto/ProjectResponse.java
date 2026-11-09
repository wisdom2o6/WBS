package com.wisdom.wbs.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProjectResponse {
    private UUID id;
    private UUID workspaceId;
    private String name;
    private String description;
    private UUID createdById;
    private String createdByName;
    private List<RoomResponse> rooms;
    private ZonedDateTime createdAt;
}