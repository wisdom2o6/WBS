package com.wisdom.wbs.controller;

import com.wisdom.wbs.dto.*;
import com.wisdom.wbs.entity.UserRole;
import com.wisdom.wbs.service.CanvasPersistenceService;
import com.wisdom.wbs.service.WorkspaceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class WorkspaceController {

    private final WorkspaceService workspaceService;
    private final CanvasPersistenceService canvasPersistenceService;

    // WORKSPACES
    @PostMapping("/workspaces")
    public ResponseEntity<WorkspaceResponse> createWorkspace(
            @Valid @RequestBody WorkspaceRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(workspaceService.createWorkspace(request, userDetails.getUsername()));
    }

    @GetMapping("/workspaces")
    public ResponseEntity<List<WorkspaceResponse>> getUserWorkspaces(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(workspaceService.getUserWorkspaces(userDetails.getUsername()));
    }

    // PROJECTS
    @PostMapping("/workspaces/{workspaceId}/projects")
    public ResponseEntity<ProjectResponse> createProject(
            @PathVariable UUID workspaceId,
            @Valid @RequestBody ProjectRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(workspaceService.createProject(workspaceId, request, userDetails.getUsername()));
    }

    @GetMapping("/workspaces/{workspaceId}/projects")
    public ResponseEntity<List<ProjectResponse>> getProjects(@PathVariable UUID workspaceId) {
        return ResponseEntity.ok(workspaceService.getProjectsByWorkspace(workspaceId));
    }

    // ROOMS
    @PostMapping("/projects/{projectId}/rooms")
    public ResponseEntity<RoomResponse> createRoom(
            @PathVariable UUID projectId,
            @Valid @RequestBody RoomRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(workspaceService.createRoom(projectId, request, userDetails.getUsername()));
    }

    @GetMapping("/projects/{projectId}/rooms")
    public ResponseEntity<List<RoomResponse>> getRooms(@PathVariable UUID projectId) {
        return ResponseEntity.ok(workspaceService.getRoomsByProject(projectId));
    }

    // MEMBERS
    @PostMapping("/workspaces/{workspaceId}/members")
    public ResponseEntity<Map<String, String>> addMember(
            @PathVariable UUID workspaceId,
            @RequestBody Map<String, String> body) {
        String usernameOrEmail = body.get("usernameOrEmail");
        workspaceService.addMemberToWorkspace(workspaceId, usernameOrEmail, UserRole.MEMBER);
        return ResponseEntity.ok(Map.of("message", "Đã thêm thành viên thành công"));
    }

    @GetMapping("/workspaces/{workspaceId}/members")
    public ResponseEntity<List<WorkspaceMemberResponse>> getWorkspaceMembers(@PathVariable UUID workspaceId) {
        return ResponseEntity.ok(workspaceService.getWorkspaceMembers(workspaceId));
    }

    @GetMapping("/rooms/{roomId}/canvas")
    public ResponseEntity<List<Object>> getRoomCanvas(@PathVariable UUID roomId) {
        return ResponseEntity.ok(canvasPersistenceService.getRoomCanvasShapes(roomId));
    }

}