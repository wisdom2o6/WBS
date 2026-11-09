package com.wisdom.wbs.dto;

import lombok.Builder;
import lombok.Data;

import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@Builder
public class ProjectResponse {
    private UUID id;
    private UUID workspaceId;
    private String name;
    private String description;
    private UUID createdById;
    private String createdByName;
    private ZonedDateTime createdAt;
}