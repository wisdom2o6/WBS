package com.wisdom.wbs.controller;

import com.wisdom.wbs.entity.Room;
import com.wisdom.wbs.entity.RoomFile;
import com.wisdom.wbs.entity.User;
import com.wisdom.wbs.repository.RoomFileRepository;
import com.wisdom.wbs.repository.RoomRepository;
import com.wisdom.wbs.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class RoomFileController {

    private final RoomFileRepository roomFileRepository;
    private final UserRepository userRepository;
    private final RoomRepository roomRepository;

    @GetMapping("/api/rooms/{roomId}/files")
    public ResponseEntity<List<RoomFile>> getRoomFiles(@PathVariable UUID roomId) {
        log.info("Tải danh sách file cho phòng: {}", roomId);
        return ResponseEntity.ok(roomFileRepository.findByRoomIdOrderByCreatedAtDesc(roomId));
    }

    @GetMapping("/api/workspaces/{workspaceId}/files")
    public ResponseEntity<List<RoomFile>> getWorkspaceFiles(@PathVariable UUID workspaceId) {
        List<UUID> roomIds = roomRepository.findByProjectWorkspaceId(workspaceId)
                .stream()
                .map(Room::getId)
                .toList();
        if (roomIds.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }
        return ResponseEntity.ok(roomFileRepository.findByRoomIdInOrderByCreatedAtDesc(roomIds));
    }

    @PostMapping("/api/rooms/{roomId}/files")
    public ResponseEntity<?> uploadFile(
            @PathVariable UUID roomId,
            @RequestParam("file") MultipartFile file,
            Principal principal) {

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("File upload không được để trống");
        }

        try {
            String uploadDirPath = System.getProperty("user.dir") + File.separator + "uploads";
            File dir = new File(uploadDirPath);
            if (!dir.exists()) dir.mkdirs();

            String uniqueName = UUID.randomUUID() + "_" + file.getOriginalFilename();
            File destFile = new File(dir, uniqueName);
            file.transferTo(destFile);

            String fileUrl = "http://localhost:8080/uploads/" + uniqueName;

            String uploaderName = "Wisdom";
            if (principal != null) {
                uploaderName = userRepository.findByEmail(principal.getName())
                        .map(User::getFullName)
                        .orElse(principal.getName());
            }

            RoomFile roomFile = RoomFile.builder()
                    .roomId(roomId)
                    .fileName(file.getOriginalFilename())
                    .fileUrl(fileUrl)
                    .fileType(file.getContentType())
                    .fileSize(file.getSize())
                    .uploadedByName(uploaderName)
                    .createdAt(Instant.now())
                    .build();

            RoomFile saved = roomFileRepository.save(roomFile);
            log.info("Đã lưu file thành công vào DB với ID: {}", saved.getId());
            return ResponseEntity.ok(saved);

        } catch (IOException e) {
            log.error("Lỗi lưu file upload: ", e);
            return ResponseEntity.internalServerError().body("Không thể lưu file trên Server");
        }
    }

    @PatchMapping("/api/rooms/{roomId}/files/{fileId}")
    public ResponseEntity<RoomFile> renameFile(
            @PathVariable UUID roomId,
            @PathVariable UUID fileId,
            @RequestBody Map<String, String> body) {
        String newName = body.getOrDefault("fileName", "").trim();
        if (newName.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return roomFileRepository.findById(fileId).map(roomFile -> {
            roomFile.setFileName(newName);
            return ResponseEntity.ok(roomFileRepository.save(roomFile));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/api/rooms/{roomId}/files/{fileId}")
    public ResponseEntity<?> deleteFile(@PathVariable UUID roomId, @PathVariable UUID fileId) {
        return roomFileRepository.findById(fileId).map(roomFile -> {
            if (roomFile.getFileUrl() != null) {
                String storedName = roomFile.getFileUrl().substring(roomFile.getFileUrl().lastIndexOf('/') + 1);
                File physicalFile = new File(System.getProperty("user.dir") + File.separator + "uploads", storedName);
                if (physicalFile.exists()) {
                    physicalFile.delete();
                }
            }
            roomFileRepository.delete(roomFile);
            return ResponseEntity.noContent().build();
        }).orElse(ResponseEntity.notFound().build());
    }
}