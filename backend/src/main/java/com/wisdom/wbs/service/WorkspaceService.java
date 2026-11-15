package com.wisdom.wbs.service;

import com.wisdom.wbs.dto.*;
import com.wisdom.wbs.entity.*;
import com.wisdom.wbs.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.File;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WorkspaceService {

    private final RoomFileRepository roomFileRepository;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final RoomRepository roomRepository;
    private final CanvasObjectRepository canvasObjectRepository;
    private final ProjectMemberRepository projectMemberRepository;

    // --- WORKSPACE ---
    @Transactional
    public WorkspaceResponse createWorkspace(WorkspaceRequest request, String username) {
        User owner = findUserByPrincipal(username);

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

        return mapToWorkspaceResponse(workspace, UserRole.OWNER, username);
    }

    @Transactional(readOnly = true)
    public List<WorkspaceResponse> getUserWorkspaces(String username) {
        User user = findUserByPrincipal(username);

        List<Workspace> workspaces = workspaceRepository.findAllByUserId(user.getId());
        return workspaces.stream().map(w -> {
            UserRole role = workspaceMemberRepository.findByIdWorkspaceIdAndIdUserId(w.getId(), user.getId())
                    .map(WorkspaceMember::getRole)
                    .orElse(UserRole.MEMBER);
            return mapToWorkspaceResponse(w, role, username);
        }).toList();
    }

    @Transactional
    public void updateWorkspace(UUID id, String newName, String newDesc) {
        Workspace ws = workspaceRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workspace không tồn tại"));
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
        User user = findUserByPrincipal(username);
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workspace không tồn tại"));

        WorkspaceMember wm = workspaceMemberRepository
                .findByIdWorkspaceIdAndIdUserId(workspaceId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không thuộc workspace này"));

        Project project = Project.builder()
                .workspace(workspace)
                .name(request.getName())
                .description(request.getDescription())
                .createdBy(user)
                .build();

        projectRepository.save(project);

        // Nếu người tạo không phải OWNER thì tự động gán quyền truy cập Project này
        if (wm.getRole() != UserRole.OWNER) {
            projectMemberRepository.save(ProjectMember.builder()
                    .id(new ProjectMemberId(project.getId(), user.getId()))
                    .project(project)
                    .user(user)
                    .assignedAt(ZonedDateTime.now())
                    .build());
        }

        return mapToProjectResponse(project);
    }

    @Transactional(readOnly = true)
    public List<ProjectResponse> getProjectsByWorkspace(UUID workspaceId, String principalName) {
        User currentUser = findUserByPrincipal(principalName);
        WorkspaceMember wm = workspaceMemberRepository
                .findByIdWorkspaceIdAndIdUserId(workspaceId, currentUser.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không thuộc workspace này"));

        List<Project> projects = projectRepository.findByWorkspaceId(workspaceId);
        if (wm.getRole() != UserRole.OWNER) {
            projects = projects.stream()
                    .filter(p -> projectMemberRepository.existsByIdProjectIdAndIdUserId(p.getId(), currentUser.getId()))
                    .toList();
        }
        return projects.stream().map(this::mapToProjectResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<ProjectResponse> getProjectsByWorkspace(UUID workspaceId) {
        return projectRepository.findByWorkspaceId(workspaceId).stream()
                .map(this::mapToProjectResponse)
                .toList();
    }

    @Transactional
    public void updateProject(UUID id, String newName) {
        Project p = projectRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project không tồn tại"));
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
        User user = findUserByPrincipal(username);
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project không tồn tại"));

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
    public List<RoomResponse> getRoomsByProject(UUID projectId, String principalName) {
        User currentUser = findUserByPrincipal(principalName);
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project không tồn tại"));

        UUID workspaceId = project.getWorkspace().getId();
        WorkspaceMember wm = workspaceMemberRepository
                .findByIdWorkspaceIdAndIdUserId(workspaceId, currentUser.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không thuộc workspace này"));

        if (wm.getRole() != UserRole.OWNER
                && !projectMemberRepository.existsByIdProjectIdAndIdUserId(projectId, currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không còn quyền truy cập Project này");
        }

        return roomRepository.findByProjectId(projectId).stream()
                .map(this::mapToRoomResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RoomResponse> getRoomsByProject(UUID projectId) {
        List<Room> rooms = roomRepository.findByProjectId(projectId);
        return rooms.stream().map(this::mapToRoomResponse).toList();
    }

    @Transactional
    public void updateRoom(UUID id, String newName) {
        Room r = roomRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room không tồn tại"));
        if (newName != null && !newName.isBlank()) r.setName(newName);
        roomRepository.save(r);
    }

    @Transactional
    public void deleteRoom(UUID id) {
        // 1. Delete physical files and database records for this room
        List<RoomFile> files = roomFileRepository.findByRoomIdOrderByCreatedAtDesc(id);
        for (RoomFile file : files) {
            if (file.getFileUrl() != null) {
                String storedName = file.getFileUrl().substring(file.getFileUrl().lastIndexOf('/') + 1);
                File physicalFile = new File(System.getProperty("user.dir") + File.separator + "uploads", storedName);
                if (physicalFile.exists()) {
                    physicalFile.delete();
                }
            }
        }
        roomFileRepository.deleteAll(files);

        // 2. Delete canvas objects and room
        canvasObjectRepository.deleteByRoomId(id);
        roomRepository.deleteById(id);
    }

    // --- MEMBERSHIP ---
    @Transactional
    public void addMemberToWorkspace(UUID workspaceId, String targetUsernameOrEmail, UserRole role) {
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workspace không tồn tại"));

        User targetUser = userRepository.findByUsername(targetUsernameOrEmail)
                .orElseGet(() -> userRepository.findByEmail(targetUsernameOrEmail)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Người dùng không tồn tại: " + targetUsernameOrEmail)));

        if (workspaceMemberRepository.existsByIdWorkspaceIdAndIdUserId(workspaceId, targetUser.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Người dùng đã là thành viên của Workspace này");
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

    // --- HELPERS ---
    private User findUserByPrincipal(String principalName) {
        return userRepository.findByUsername(principalName)
                .orElseGet(() -> userRepository.findByEmail(principalName)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Không xác thực được người dùng")));
    }

    // --- MAPPER HELPERS ---
    private WorkspaceResponse mapToWorkspaceResponse(Workspace w, UserRole role, String principalName) {
        List<ProjectResponse> projectResponses = getProjectsByWorkspace(w.getId(), principalName);

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
                .workspaceId(p.getWorkspace() != null ? p.getWorkspace().getId() : null)
                .name(p.getName())
                .description(p.getDescription())
                .createdById(p.getCreatedBy() != null ? p.getCreatedBy().getId() : null)
                .createdByName(p.getCreatedBy() != null ? p.getCreatedBy().getFullName() : null)
                .rooms(roomResponses)
                .createdAt(p.getCreatedAt())
                .build();
    }

    private RoomResponse mapToRoomResponse(Room room) {
        return RoomResponse.builder()
                .id(room.getId())
                .projectId(room.getProject() != null ? room.getProject().getId() : null)
                .name(room.getName())
                .description(room.getDescription())
                .createdById(room.getCreatedBy() != null ? room.getCreatedBy().getId() : null)
                .createdByName(room.getCreatedBy() != null ? room.getCreatedBy().getFullName() : null)
                .createdAt(room.getCreatedAt())
                .build();
    }
}