package com.wisdom.wbs.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.*;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class FileUploadController {

    private final String UPLOAD_DIR = "uploads/";

    @PostMapping("/upload")
    public ResponseEntity uploadFile(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "File rỗng"));
        }

        try {
            File dir = new File(UPLOAD_DIR);
            if (!dir.exists()) {
                dir.mkdirs();
            }

            String fileName = UUID.randomUUID() + "_" + file.getOriginalFilename();
            Path filePath = Paths.get(UPLOAD_DIR + fileName);
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

            String fileUrl = "http://localhost:8080/uploads/" + fileName;
            return ResponseEntity.ok(Map.of("url", fileUrl));
        } catch (IOException e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("message", "Lỗi upload file"));
        }
    }
}