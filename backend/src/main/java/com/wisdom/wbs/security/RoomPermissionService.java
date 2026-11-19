package com.wisdom.wbs.security;

import com.wisdom.wbs.entity.ProjectMember;
import com.wisdom.wbs.entity.Room;
import com.wisdom.wbs.entity.WorkspaceMember;
import com.wisdom.wbs.repository.ProjectMemberRepository;
import com.wisdom.wbs.repository.RoomRepository;
import com.wisdom.wbs.repository.WorkspaceMemberRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

@Service("roomSecurity")
public class RoomPermissionService {

    private final RoomRepository roomRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;

    public RoomPermissionService(
            RoomRepository roomRepository,
            ProjectMemberRepository projectMemberRepository,
            WorkspaceMemberRepository workspaceMemberRepository) {
        this.roomRepository = roomRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.workspaceMemberRepository = workspaceMemberRepository;
    }

    public boolean canEdit(UUID roomId, String username) {
        Room room = roomRepository.findById(roomId).orElse(null);
        if (room == null || room.getProject() == null) return false;

        // 1. Ưu tiên kiểm tra role ở cấp Project
        Optional<ProjectMember> projectMember = projectMemberRepository
                .findByProject_IdAndUser_Username(room.getProject().getId(), username);
        if (projectMember.isPresent()) {
            String role = projectMember.get().getRole().name();
            return !role.equals("VIEWER");
        }

        // 2. Fallback về role ở cấp Workspace thông qua Project
        if (room.getProject().getWorkspace() != null) {
            Optional<WorkspaceMember> wsMember = workspaceMemberRepository
                    .findByWorkspace_IdAndUser_Username(room.getProject().getWorkspace().getId(), username);
            if (wsMember.isPresent()) {
                String role = wsMember.get().getRole().name();
                return !role.equals("VIEWER");
            }
        }

        return false;
    }

    public void assertCanEdit(UUID roomId, String username) {
        if (!canEdit(roomId, username)) {
            throw new AccessDeniedException("VIEWER role is not allowed to modify canvas in room: " + roomId);
        }
    }
}