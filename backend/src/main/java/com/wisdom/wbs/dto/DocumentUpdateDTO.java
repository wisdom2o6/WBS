package com.wisdom.wbs.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
public class DocumentUpdateDTO {
    private String senderId;
    private UUID documentId;
    private UUID projectId;
    private UUID roomId;
    private String title;
    private String description;
    private List blocks;
    private String updatedAt;
}