package com.wisdom.wbs.repository;

import com.wisdom.wbs.entity.WorkspaceMember;
import com.wisdom.wbs.entity.WorkspaceMemberId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WorkspaceMemberRepository extends JpaRepository<WorkspaceMember, WorkspaceMemberId> {
    List<WorkspaceMember> findByIdWorkspaceId(UUID workspaceId);
    Optional<WorkspaceMember> findByIdWorkspaceIdAndIdUserId(UUID workspaceId, UUID userId);
    boolean existsByIdWorkspaceIdAndIdUserId(UUID workspaceId, UUID userId);
}