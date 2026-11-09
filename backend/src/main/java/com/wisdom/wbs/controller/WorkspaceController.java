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

    // UPDATE Workspace
    @PutMapping("/workspaces/{id}")
    public ResponseEntity<?> updateWorkspace(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        workspaceService.updateWorkspace(id, body.get("name"), body.get("description"));
        return ResponseEntity.ok(Map.of("message", "Cập nhật Workspace thành công"));
    }

    // DELETE Workspace
    @DeleteMapping("/workspaces/{id}")
    public ResponseEntity<?> deleteWorkspace(@PathVariable UUID id) {
        workspaceService.deleteWorkspace(id);
        return ResponseEntity.ok(Map.of("message", "Xóa Workspace thành công"));
    }

    // UPDATE Project
    @PutMapping("/projects/{id}")
    public ResponseEntity<?> updateProject(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        workspaceService.updateProject(id, body.get("name"));
        return ResponseEntity.ok(Map.of("message", "Cập nhật Project thành công"));
    }

    // DELETE Project
    @DeleteMapping("/projects/{id}")
    public ResponseEntity<?> deleteProject(@PathVariable UUID id) {
        workspaceService.deleteProject(id);
        return ResponseEntity.ok(Map.of("message", "Xóa Project thành công"));
    }

    // UPDATE Room
    @PutMapping("/rooms/{id}")
    public ResponseEntity<?> updateRoom(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        workspaceService.updateRoom(id, body.get("name"));
        return ResponseEntity.ok(Map.of("message", "Cập nhật Room thành công"));
    }

    // DELETE Room
    @DeleteMapping("/rooms/{id}")
    public ResponseEntity<?> deleteRoom(@PathVariable UUID id) {
        workspaceService.deleteRoom(id);
        return ResponseEntity.ok(Map.of("message", "Xóa Room thành công"));
    }

}