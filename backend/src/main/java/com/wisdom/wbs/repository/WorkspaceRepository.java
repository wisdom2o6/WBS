package com.wisdom.wbs.repository;

import com.wisdom.wbs.entity.Workspace;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface WorkspaceRepository extends JpaRepository<Workspace, UUID> {
    boolean existsBySlug(String slug);
    
    @Query("SELECT DISTINCT w FROM Workspace w LEFT JOIN FETCH w.owner JOIN WorkspaceMember wm ON w.id = wm.id.workspaceId WHERE wm.id.userId = :userId")
    List<Workspace> findAllByUserId(@Param("userId") UUID userId);
}