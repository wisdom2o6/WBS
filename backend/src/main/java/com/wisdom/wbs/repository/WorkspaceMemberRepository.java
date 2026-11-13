package com.wisdom.wbs.repository;

import com.wisdom.wbs.entity.WorkspaceMember;
import com.wisdom.wbs.entity.WorkspaceMemberId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WorkspaceMemberRepository extends JpaRepository<WorkspaceMember, WorkspaceMemberId> {

    // Các hàm gốc dùng cho WorkspaceService & các file cũ
    List<WorkspaceMember> findByIdUserId(UUID userId);
    boolean existsByIdWorkspaceIdAndIdUserId(UUID workspaceId, UUID userId);

    @EntityGraph(attributePaths = {"user"})
    List<WorkspaceMember> findByIdWorkspaceId(UUID workspaceId);

    @EntityGraph(attributePaths = {"user"})
    Optional<WorkspaceMember> findByIdWorkspaceIdAndIdUserId(UUID workspaceId, UUID userId);

    void deleteByWorkspaceId(UUID workspaceId);
    
}