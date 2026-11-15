package com.wisdom.wbs.controller;

import com.wisdom.wbs.entity.*;
import com.wisdom.wbs.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZonedDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/members")
@RequiredArgsConstructor
@Transactional
public class WorkspaceMemberController {

    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository memberRepository;
    private final UserRepository userRepository;

    // 1. Lấy danh sách thành viên trong Workspace
    @GetMapping
    @Transactional(readOnly = true)
    public List listMembers(
            @PathVariable UUID workspaceId,
            Authentication auth) {
        requireMember(workspaceId, auth.getName());
        return memberRepository.findByIdWorkspaceId(workspaceId).stream()
                .map(this::toMemberResponse)
                .toList();
    }

    // 2. Mời thành viên qua Email hoặc Username (Chỉ OWNER)
    @PostMapping
    public ResponseEntity<?> inviteMember(
            @PathVariable UUID workspaceId,
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        requireOwner(workspaceId, auth.getName());

        String identifier = Optional.ofNullable(body.get("email"))
                .or(() -> Optional.ofNullable(body.get("usernameOrEmail")))
                .or(() -> Optional.ofNullable(body.get("username")))
                .or(() -> Optional.ofNullable(body.get("identifier")))
                .map(Object::toString)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email hoặc username là bắt buộc"));

        Object rawRole = body.get("role");
        String roleStr = (rawRole != null && !rawRole.toString().isBlank())
                ? rawRole.toString().trim().toUpperCase()
                : "MEMBER";

        UserRole role;
        try {
            role = UserRole.valueOf(roleStr);
        } catch (IllegalArgumentException e) {
            role = UserRole.MEMBER;
        }

        if (role == UserRole.OWNER) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không thể mời trực tiếp với quyền OWNER");
        }

        User targetUser = (identifier.contains("@")
                ? userRepository.findByEmail(identifier)
                : userRepository.findByUsername(identifier).or(() -> userRepository.findByEmail(identifier)))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy tài khoản: " + identifier));

        if (memberRepository.existsByIdWorkspaceIdAndIdUserId(workspaceId, targetUser.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Người dùng đã là thành viên của workspace");
        }

        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workspace không tồn tại"));

        WorkspaceMember saved = memberRepository.save(WorkspaceMember.builder()
                .id(new WorkspaceMemberId(workspaceId, targetUser.getId()))
                .workspace(workspace)
                .user(targetUser)
                .role(role)
                .joinedAt(ZonedDateTime.now())
                .build());

        return ResponseEntity.status(HttpStatus.CREATED).body(toMemberResponse(saved));
    }

    // 3. Cập nhật vai trò thành viên (Chỉ OWNER)
    @PatchMapping("/{userId}/role")
    public Map<String, Object> updateRole(
            @PathVariable UUID workspaceId,
            @PathVariable UUID userId,
            @RequestBody Map<String, String> body,
            Authentication auth) {
        WorkspaceMember actor = requireOwner(workspaceId, auth.getName());
        if (actor.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không thể tự thay đổi quyền của chính mình");
        }

        UserRole newRole = UserRole.valueOf(body.getOrDefault("role", "MEMBER").toUpperCase());
        WorkspaceMember target = memberRepository.findByIdWorkspaceIdAndIdUserId(workspaceId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Thành viên không tồn tại"));

        target.setRole(newRole);
        return toMemberResponse(memberRepository.save(target));
    }

    // 4. Xóa thành viên khỏi Workspace (OWNER xóa người khác, hoặc thành viên tự rời)
    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> removeMember(
            @PathVariable UUID workspaceId,
            @PathVariable UUID userId,
            Authentication auth) {
        WorkspaceMember actor = requireMember(workspaceId, auth.getName());
        boolean isSelf = actor.getUser().getId().equals(userId);

        if (!isSelf && actor.getRole() != UserRole.OWNER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ OWNER mới có quyền xóa thành viên khác");
        }

        WorkspaceMember target = memberRepository.findByIdWorkspaceIdAndIdUserId(workspaceId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Thành viên không tồn tại"));

        if (target.getRole() == UserRole.OWNER) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không thể xóa OWNER khỏi workspace");
        }

        memberRepository.delete(target);
        return ResponseEntity.noContent().build();
    }

    // --- Helper kiểm tra RBAC ---
    private WorkspaceMember requireMember(UUID workspaceId, String principalName) {
        User user = userRepository.findByUsername(principalName)
                .orElseGet(() -> userRepository.findByEmail(principalName)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED)));
        return memberRepository.findByIdWorkspaceIdAndIdUserId(workspaceId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không thuộc workspace này"));
    }

    private WorkspaceMember requireOwner(UUID workspaceId, String principalName) {
        WorkspaceMember member = requireMember(workspaceId, principalName);
        if (member.getRole() != UserRole.OWNER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Yêu cầu quyền OWNER");
        }
        return member;
    }

    private Map<String, Object> toMemberResponse(WorkspaceMember m) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", m.getId());
        map.put("userId", m.getUser().getId());
        map.put("email", m.getUser().getEmail());
        map.put("fullName", m.getUser().getFullName());
        map.put("role", m.getRole().name());
        map.put("joinedAt", m.getJoinedAt() != null ? m.getJoinedAt().toString() : null);
        return map;
    }
}