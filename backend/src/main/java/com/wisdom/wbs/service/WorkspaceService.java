package com.wisdom.wbs.service;

import com.wisdom.wbs.dto.*;
import com.wisdom.wbs.entity.*;
import com.wisdom.wbs.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WorkspaceService {

    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final RoomRepository roomRepository;
    private final CanvasObjectRepository canvasObjectRepository;

    // --- WORKSPACE ---
    @Transactional
    public WorkspaceResponse createWorkspace(WorkspaceRequest request, String username) {
        User owner = userRepository.findByUsername(username)
                .orElseGet(() -> userRepository.findByEmail(username)
                        .orElseThrow(() -> new RuntimeException("User not found: " + username)));

        String slug = (request.getSlug() != null && !request.getSlug().isBlank()) 
                ? request.getSlug() 
                : request.getName().toLowerCase().replaceAll("[^a-z0-9]", "-");

        if (workspaceRepository.existsBySlug(slug)) {
            slug = slug + "-" + System.currentTimeMillis() % 1000;
        }

        Workspace workspace = Workspace.builder()
                .name(request.getName())
                .slug(slug)
                .description(request.getDescription())
                .owner(owner)
                .build();

        workspaceRepository.save(workspace);

        WorkspaceMember member = WorkspaceMember.builder()
                .id(new WorkspaceMemberId(workspace.getId(), owner.getId()))
                .workspace(workspace)
                .user(owner)
                .role(UserRole.OWNER)
                .build();

        workspaceMemberRepository.save(member);

        return mapToWorkspaceResponse(workspace, UserRole.OWNER);
    }

    @Transactional(readOnly = true)
    public List<WorkspaceResponse> getUserWorkspaces(String username) {
        User user = userRepository.findByUsername(username)
                .orElseGet(() -> userRepository.findByEmail(username)
                        .orElseThrow(() -> new RuntimeException("User not found: " + username)));

        List<Workspace> workspaces = workspaceRepository.findAllByUserId(user.getId());
        return workspaces.stream().map(w -> {
            UserRole role = workspaceMemberRepository.findByIdWorkspaceIdAndIdUserId(w.getId(), user.getId())
                    .map(WorkspaceMember::getRole)
                    .orElse(UserRole.MEMBER);
            return mapToWorkspaceResponse(w, role);
        }).toList();
    }

    @Transactional
    public void updateWorkspace(UUID id, String newName, String newDesc) {
        Workspace ws = workspaceRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Workspace không tồn tại"));
        if (newName != null && !newName.isBlank()) ws.setName(newName);
        if (newDesc != null) ws.setDescription(newDesc);
        workspaceRepository.save(ws);
    }

    @Transactional
    public void deleteWorkspace(UUID id) {
        List<Project> projects = projectRepository.findByWorkspaceId(id);

        for (Project project : projects) {
            List<Room> rooms = roomRepository.findByProjectId(project.getId());
            for (Room room : rooms) {
                canvasObjectRepository.deleteByRoomId(room.getId());
            }
            roomRepository.deleteAll(rooms);
        }

        projectRepository.deleteAll(projects);
        workspaceMemberRepository.deleteByWorkspaceId(id);
        workspaceRepository.deleteById(id);
    }

    // --- PROJECT ---
    @Transactional
    public ProjectResponse createProject(UUID workspaceId, ProjectRequest request, String username) {
        User user = userRepository.findByUsername(username)
                .orElseGet(() -> userRepository.findByEmail(username)
                        .orElseThrow(() -> new RuntimeException("User not found: " + username)));
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new RuntimeException("Workspace not found: " + workspaceId));

        Project project = Project.builder()
                .workspace(workspace)
                .name(request.getName())
                .description(request.getDescription())
                .createdBy(user)
                .build();

        projectRepository.save(project);

        return mapToProjectResponse(project);
    }

    @Transactional(readOnly = true)
    public List<ProjectResponse> getProjectsByWorkspace(UUID workspaceId) {
        List<Project> projects = projectRepository.findByWorkspaceId(workspaceId);
        return projects.stream().map(this::mapToProjectResponse).toList();
    }

    @Transactional
    public void updateProject(UUID id, String newName) {
        Project p = projectRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Project không tồn tại"));
        if (newName != null && !newName.isBlank()) p.setName(newName);
        projectRepository.save(p);
    }

    @Transactional
    public void deleteProject(UUID id) {
        List<Room> rooms = roomRepository.findByProjectId(id);
        for (Room room : rooms) {
            canvasObjectRepository.deleteByRoomId(room.getId());
        }
        roomRepository.deleteAll(rooms);
        projectRepository.deleteById(id);
    }

    // --- ROOM ---
    @Transactional
    public RoomResponse createRoom(UUID projectId, RoomRequest request, String username) {
        User user = userRepository.findByUsername(username)
                .orElseGet(() -> userRepository.findByEmail(username)
                        .orElseThrow(() -> new RuntimeException("User not found: " + username)));
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found: " + projectId));

        Room room = Room.builder()
                .project(project)
                .name(request.getName())
                .description(request.getDescription())
                .createdBy(user)
                .build();

        roomRepository.save(room);

        return mapToRoomResponse(room);
    }

    @Transactional(readOnly = true)
    public List<RoomResponse> getRoomsByProject(UUID projectId) {
        List<Room> rooms = roomRepository.findByProjectId(projectId);
        return rooms.stream().map(this::mapToRoomResponse).toList();
    }

    @Transactional
    public void updateRoom(UUID id, String newName) {
        Room r = roomRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Room không tồn tại"));
        if (newName != null && !newName.isBlank()) r.setName(newName);
        roomRepository.save(r);
    }

    @Transactional
    public void deleteRoom(UUID id) {
        canvasObjectRepository.deleteByRoomId(id);
        roomRepository.deleteById(id);
    }

    // --- MEMBERSHIP ---
    @Transactional
    public void addMemberToWorkspace(UUID workspaceId, String targetUsernameOrEmail, UserRole role) {
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new RuntimeException("Workspace không tồn tại"));

        User targetUser = userRepository.findByUsername(targetUsernameOrEmail)
                .orElseGet(() -> userRepository.findByEmail(targetUsernameOrEmail)
                        .orElseThrow(() -> new RuntimeException("Người dùng không tồn tại: " + targetUsernameOrEmail)));

        if (workspaceMemberRepository.existsByIdWorkspaceIdAndIdUserId(workspaceId, targetUser.getId())) {
            throw new IllegalArgumentException("Người dùng đã là thành viên của Workspace này");
        }

        WorkspaceMember member = WorkspaceMember.builder()
                .id(new WorkspaceMemberId(workspaceId, targetUser.getId()))
                .workspace(workspace)
                .user(targetUser)
                .role(role != null ? role : UserRole.MEMBER)
                .build();

        workspaceMemberRepository.save(member);
    }

    @Transactional(readOnly = true)
    public List<WorkspaceMemberResponse> getWorkspaceMembers(UUID workspaceId) {
        List<WorkspaceMember> members = workspaceMemberRepository.findByIdWorkspaceId(workspaceId);
        return members.stream().map(m -> WorkspaceMemberResponse.builder()
                .userId(m.getUser().getId())
                .username(m.getUser().getUsername())
                .fullName(m.getUser().getFullName())
                .email(m.getUser().getEmail())
                .role(m.getRole())
                .build()
        ).toList();
    }

    // --- MAPPER HELPERS ---
    private WorkspaceResponse mapToWorkspaceResponse(Workspace w, UserRole role) {
        List<ProjectResponse> projectResponses = getProjectsByWorkspace(w.getId());

        return WorkspaceResponse.builder()
                .id(w.getId())
                .name(w.getName())
                .slug(w.getSlug())
                .description(w.getDescription())
                .ownerId(w.getOwner().getId())
                .ownerName(w.getOwner().getFullName())
                .currentUserRole(role)
                .projects(projectResponses)
                .createdAt(w.getCreatedAt())
                .build();
    }

    private ProjectResponse mapToProjectResponse(Project p) {
        List<RoomResponse> roomResponses = getRoomsByProject(p.getId());

        return ProjectResponse.builder()
                .id(p.getId())
                .workspaceId(p.getWorkspace().getId())
                .name(p.getName())
                .description(p.getDescription())
                .createdById(p.getCreatedBy().getId())
                .createdByName(p.getCreatedBy().getFullName())
                .rooms(roomResponses)
                .createdAt(p.getCreatedAt())
                .build();
    }

    private RoomResponse mapToRoomResponse(Room room) {
        return RoomResponse.builder()
                .id(room.getId())
                .projectId(room.getProject().getId())
                .name(room.getName())
                .description(room.getDescription())
                .createdById(room.getCreatedBy().getId())
                .createdByName(room.getCreatedBy().getFullName())
                .createdAt(room.getCreatedAt())
                .build();
    }
}