package com.wisdom.wbs.controller;

import com.wisdom.wbs.entity.*;
import com.wisdom.wbs.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.ZonedDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/v1/projects/{projectId}/members")
@RequiredArgsConstructor
@Transactional
public class ProjectMemberController {

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final UserRepository userRepository;

    // 1. Lấy danh sách thành viên đang được phân công trong Project
    @GetMapping
    @Transactional(readOnly = true)
    public List listProjectMembers(
            @PathVariable UUID projectId,
            Authentication auth) {
        Project project = getProjectOrThrow(projectId);
        User currentUser = getCurrentUser(auth.getName());
        requireWorkspaceMember(project.getWorkspace().getId(), currentUser.getId());

        return projectMemberRepository.findByIdProjectId(projectId).stream()
                .map(this::toResponse)
                .toList();
    }

    // 2. Phân công thành viên Workspace vào Project (Chỉ OWNER của Workspace)
    @PostMapping
    public ResponseEntity assignMember(
            @PathVariable UUID projectId,
            @RequestBody Map<String, String> body,
            Authentication auth) {
        Project project = getProjectOrThrow(projectId);
        UUID workspaceId = project.getWorkspace().getId();
        User currentUser = getCurrentUser(auth.getName());
        requireWorkspaceOwner(workspaceId, currentUser.getId());

        String userIdStr = body.get("userId");
        if (userIdStr == null || userIdStr.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId là bắt buộc");
        }

        UUID targetUserId;
        try {
            targetUserId = UUID.fromString(userIdStr.trim());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId không hợp lệ");
        }

        // Bắt buộc người được phân công phải thuộc Workspace này trước
        if (!workspaceMemberRepository.existsByIdWorkspaceIdAndIdUserId(workspaceId, targetUserId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Người dùng chưa thuộc Workspace này");
        }

        if (projectMemberRepository.existsByIdProjectIdAndIdUserId(projectId, targetUserId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Thành viên đã được phân công vào Project này");
        }

        User targetUser = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Người dùng không tồn tại"));

        ProjectMember saved = projectMemberRepository.save(ProjectMember.builder()
                .id(new ProjectMemberId(projectId, targetUserId))
                .project(project)
                .user(targetUser)
                .assignedAt(ZonedDateTime.now())
                .build());

        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    // 3. Hủy phân công thành viên khỏi Project (Chỉ OWNER của Workspace)
    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> unassignMember(
            @PathVariable UUID projectId,
            @PathVariable UUID userId,
            Authentication auth) {
        Project project = getProjectOrThrow(projectId);
        User currentUser = getCurrentUser(auth.getName());
        requireWorkspaceOwner(project.getWorkspace().getId(), currentUser.getId());

        ProjectMember assignment = projectMemberRepository.findByIdProjectIdAndIdUserId(projectId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Thành viên không nằm trong Project này"));

        projectMemberRepository.delete(assignment);
        return ResponseEntity.noContent().build();
    }

    // --- Helpers ---
    private Project getProjectOrThrow(UUID projectId) {
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project không tồn tại"));
    }

    private User getCurrentUser(String principalName) {
        return userRepository.findByUsername(principalName)
                .orElseGet(() -> userRepository.findByEmail(principalName)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED)));
    }

    private WorkspaceMember requireWorkspaceMember(UUID workspaceId, UUID userId) {
        return workspaceMemberRepository.findByIdWorkspaceIdAndIdUserId(workspaceId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không thuộc workspace này"));
    }

    private void requireWorkspaceOwner(UUID workspaceId, UUID userId) {
        WorkspaceMember member = requireWorkspaceMember(workspaceId, userId);
        if (member.getRole() != UserRole.OWNER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ OWNER mới có quyền phân công Project");
        }
    }

    private Map<String, Object> toResponse(ProjectMember pm) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("projectId", pm.getId().getProjectId());
        map.put("userId", pm.getUser().getId());
        map.put("email", pm.getUser().getEmail());
        map.put("fullName", pm.getUser().getFullName());
        map.put("assignedAt", pm.getAssignedAt() != null ? pm.getAssignedAt().toString() : null);
        return map;
    }
}