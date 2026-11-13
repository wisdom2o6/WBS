package com.wisdom.wbs.controller;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import com.wisdom.wbs.dto.DocumentUpdateDTO;
import com.wisdom.wbs.entity.RoomDocument;
import com.wisdom.wbs.repository.RoomDocumentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class RoomDocumentController {

    private final RoomDocumentRepository documentRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

    @GetMapping("/workspaces/{workspaceId}/documents")
    public List getDocuments(
            @PathVariable UUID workspaceId,
            @RequestParam(required = false) UUID roomId) {
        List<RoomDocument> docs = (roomId != null)
                ? documentRepository.findByWorkspaceIdAndRoomIdOrderByUpdatedAtDesc(workspaceId, roomId)
                : documentRepository.findByWorkspaceIdOrderByUpdatedAtDesc(workspaceId);
        return docs.stream().map(this::toResponse).toList();
    }

    @PostMapping("/workspaces/{workspaceId}/documents")
    public Map<String, Object> createDocument(
            @PathVariable UUID workspaceId,
            @RequestBody DocumentUpdateDTO dto,
            Authentication auth) throws Exception {
        RoomDocument doc = RoomDocument.builder()
                .workspaceId(workspaceId)
                .projectId(dto.getProjectId())
                .roomId(dto.getRoomId())
                .title(dto.getTitle() != null ? dto.getTitle() : "Untitled")
                .description(dto.getDescription() != null ? dto.getDescription() : "")
                .author(auth != null ? auth.getName() : "Member")
                .blocksJson(objectMapper.writeValueAsString(
                        dto.getBlocks() != null ? dto.getBlocks() : List.of()))
                .updatedAt(Instant.now())
                .build();
        return toResponse(documentRepository.save(doc));
    }

    @PutMapping("/documents/{documentId}")
    public ResponseEntity updateDocument(
            @PathVariable UUID documentId,
            @RequestBody DocumentUpdateDTO dto) throws Exception {
        return documentRepository.findById(documentId)
                .map(doc -> {
                    try {
                        if (dto.getTitle() != null) doc.setTitle(dto.getTitle());
                        if (dto.getDescription() != null) doc.setDescription(dto.getDescription());
                        if (dto.getBlocks() != null) {
                            doc.setBlocksJson(objectMapper.writeValueAsString(dto.getBlocks()));
                        }
                        doc.setUpdatedAt(Instant.now());
                        return ResponseEntity.ok(toResponse(documentRepository.save(doc)));
                    } catch (Exception e) {
                        throw new RuntimeException(e);
                    }
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/documents/{documentId}")
    public ResponseEntity<Void> deleteDocument(@PathVariable UUID documentId) {
        if (!documentRepository.existsById(documentId)) {
            return ResponseEntity.notFound().build();
        }
        documentRepository.deleteById(documentId);
        return ResponseEntity.noContent().build();
    }

    @MessageMapping("/doc.{documentId}.update")
    public void broadcastDocumentUpdate(
            @DestinationVariable UUID documentId,
            DocumentUpdateDTO payload) {
        messagingTemplate.convertAndSend("/topic/doc." + documentId, payload);
    }

    private Map<String, Object> toResponse(RoomDocument doc) {
        List blocks = List.of();
        try {
            if (doc.getBlocksJson() != null) {
                blocks = objectMapper.readValue(doc.getBlocksJson(), new TypeReference<>() {});
            }
        } catch (Exception ignored) {}

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("id", doc.getId());
        res.put("workspaceId", doc.getWorkspaceId());
        res.put("projectId", doc.getProjectId());
        res.put("roomId", doc.getRoomId());
        res.put("title", doc.getTitle());
        res.put("description", doc.getDescription() != null ? doc.getDescription() : "");
        res.put("author", doc.getAuthor() != null ? doc.getAuthor() : "Member");
        res.put("blocks", blocks);
        res.put("updatedAt", doc.getUpdatedAt() != null ? doc.getUpdatedAt().toString() : Instant.now().toString());
        return res;
    }
}