package com.wisdom.wbs.dto;

import com.wisdom.wbs.entity.UserRole;
import lombok.Builder;
import lombok.Data;

import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@Builder
public class WorkspaceResponse {
    private UUID id;
    private String name;
    private String slug;
    private String description;
    private UUID ownerId;
    private String ownerName;
    private UserRole currentUserRole;
    private ZonedDateTime createdAt;
}