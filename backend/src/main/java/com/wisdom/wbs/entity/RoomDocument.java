package com.wisdom.wbs.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "room_documents")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomDocument {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "workspace_id", nullable = false)
    private UUID workspaceId;

    @Column(name = "project_id")
    private UUID projectId;

    @Column(name = "room_id")
    private UUID roomId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 120)
    private String author;

    @Column(name = "blocks_json", columnDefinition = "TEXT")
    private String blocksJson;

    @Column(name = "updated_at")
    private Instant updatedAt;
}