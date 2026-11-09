package com.wisdom.wbs.dto;

import com.wisdom.wbs.entity.UserRole;
import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class WorkspaceMemberResponse {
    private UUID userId;
    private String username;
    private String fullName;
    private String email;
    private UserRole role;
}