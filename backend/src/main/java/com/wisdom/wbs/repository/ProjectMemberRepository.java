package com.wisdom.wbs.repository;

import com.wisdom.wbs.entity.ProjectMember;
import com.wisdom.wbs.entity.ProjectMemberId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectMemberRepository extends JpaRepository<ProjectMember, ProjectMemberId> {
    List<ProjectMember> findByIdProjectId(UUID projectId);
    List<ProjectMember> findByIdUserId(UUID userId);
    boolean existsByIdProjectIdAndIdUserId(UUID projectId, UUID userId);
    Optional<ProjectMember> findByIdProjectIdAndIdUserId(UUID projectId, UUID userId);
}