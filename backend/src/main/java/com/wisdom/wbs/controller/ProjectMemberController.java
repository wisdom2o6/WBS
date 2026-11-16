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

    // 1. Lấy danh sách thành viên được phân công vào Project
    @GetMapping
    @Transactional(readOnly = true)
    public List listProjectMembers(
            @PathVariable UUID projectId,
            Authentication auth) {
        Project project = getProjectOrThrow(projectId);
        requireProjectAccess(project, auth.getName());

        return projectMemberRepository.findByIdProjectId(projectId).stream()
                .map(this::toMemberResponse)
                .toList();
    }

    // 2. Phân công thành viên vào Project kèm role (MEMBER hoặc VIEWER)
    @PostMapping
    public ResponseEntity assignMember(
            @PathVariable UUID projectId,
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        Project project = getProjectOrThrow(projectId);
        requireWorkspaceOwner(project.getWorkspace().getId(), auth.getName());

        User targetUser = resolveTargetUser(body);
        UUID workspaceId = project.getWorkspace().getId();

        if (!workspaceMemberRepository.existsByIdWorkspaceIdAndIdUserId(workspaceId, targetUser.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Thành viên phải thuộc Workspace trước khi phân công vào Project"
            );
        }

        UserRole role = parseAssignableRole(body.get("role"));

        ProjectMember member = projectMemberRepository
                .findByIdProjectIdAndIdUserId(projectId, targetUser.getId())
                .orElseGet(() -> ProjectMember.builder()
                        .id(new ProjectMemberId(projectId, targetUser.getId()))
                        .project(project)
                        .user(targetUser)
                        .assignedAt(ZonedDateTime.now())
                        .build());

        member.setRole(role);
        ProjectMember saved = projectMemberRepository.save(member);
        return ResponseEntity.status(HttpStatus.CREATED).body(toMemberResponse(saved));
    }

    // 3. Chuyển đổi vai trò của thành viên trong Project (MEMBER <-> VIEWER)
    @PatchMapping("/{userId}/role")
    public Map<String, Object> updateProjectMemberRole(
            @PathVariable UUID projectId,
            @PathVariable UUID userId,
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        Project project = getProjectOrThrow(projectId);
        requireWorkspaceOwner(project.getWorkspace().getId(), auth.getName());

        ProjectMember target = projectMemberRepository
                .findByIdProjectIdAndIdUserId(projectId, userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Thành viên chưa được phân công vào Project này"
                ));

        if (target.getRole() == UserRole.OWNER) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không thể đổi vai trò của OWNER");
        }

        UserRole newRole = parseAssignableRole(body.get("role"));
        target.setRole(newRole);
        return toMemberResponse(projectMemberRepository.save(target));
    }

    // 4. Hủy phân công thành viên khỏi Project
    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> unassignMember(
            @PathVariable UUID projectId,
            @PathVariable UUID userId,
            Authentication auth) {
        Project project = getProjectOrThrow(projectId);
        requireWorkspaceOwner(project.getWorkspace().getId(), auth.getName());

        ProjectMember target = projectMemberRepository
                .findByIdProjectIdAndIdUserId(projectId, userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Thành viên chưa được phân công vào Project này"
                ));

        if (target.getRole() == UserRole.OWNER) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không thể hủy phân công OWNER");
        }

        projectMemberRepository.delete(target);
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

    private void requireProjectAccess(Project project, String principalName) {
        User user = getCurrentUser(principalName);
        UUID workspaceId = project.getWorkspace().getId();

        WorkspaceMember wsMember = workspaceMemberRepository
                .findByIdWorkspaceIdAndIdUserId(workspaceId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không thuộc workspace này"));

        if (wsMember.getRole() != UserRole.OWNER
                && !projectMemberRepository.existsByIdProjectIdAndIdUserId(project.getId(), user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn chưa được phân công vào Project này");
        }
    }

    private void requireWorkspaceOwner(UUID workspaceId, String principalName) {
        User user = getCurrentUser(principalName);
        WorkspaceMember member = workspaceMemberRepository
                .findByIdWorkspaceIdAndIdUserId(workspaceId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không thuộc workspace này"));

        if (member.getRole() != UserRole.OWNER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ OWNER mới có quyền phân công Project");
        }
    }

    private User resolveTargetUser(Map<String, Object> body) {
        Object rawUserId = body.get("userId");
        if (rawUserId != null && !rawUserId.toString().isBlank()) {
            try {
                UUID uid = UUID.fromString(rawUserId.toString().trim());
                return userRepository.findById(uid)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng"));
            } catch (IllegalArgumentException ignored) {
            }
        }

        String email = Optional.ofNullable(body.get("email"))
                .map(Object::toString)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cần cung cấp userId hoặc email"));

        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy email: " + email));
    }

    private UserRole parseAssignableRole(Object rawRole) {
        String roleStr = (rawRole != null && !rawRole.toString().isBlank())
                ? rawRole.toString().trim().toUpperCase()
                : "MEMBER";
        try {
            UserRole role = UserRole.valueOf(roleStr);
            if (role == UserRole.OWNER) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không thể gán quyền OWNER trong Project");
            }
            return role;
        } catch (IllegalArgumentException e) {
            return UserRole.MEMBER;
        }
    }

    private Map<String, Object> toMemberResponse(ProjectMember m) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("userId", m.getUser().getId());
        map.put("email", m.getUser().getEmail());
        map.put("fullName", m.getUser().getFullName());
        map.put("role", m.getRole().name());
        map.put("assignedAt", m.getAssignedAt() != null ? m.getAssignedAt().toString() : null);
        return map;
    }
}