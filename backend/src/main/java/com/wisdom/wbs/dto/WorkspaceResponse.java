package com.wisdom.wbs.dto;

import com.wisdom.wbs.entity.UserRole;
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
public class WorkspaceResponse {
    private UUID id;
    private String name;
    private String slug;
    private String description;
    private UUID ownerId;
    private String ownerName;
    private UserRole currentUserRole;
    private List<ProjectResponse> projects;
    private ZonedDateTime createdAt;
}