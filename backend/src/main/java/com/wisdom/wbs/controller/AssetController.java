package com.wisdom.wbs.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/assets")
@CrossOrigin(origins = "*")
public class AssetController {

    private final String UPLOAD_DIR = "uploads/";

    @PostMapping("/upload")
    public ResponseEntity uploadAsset(@RequestParam("file") MultipartFile file) throws IOException {
        File dir = new File(UPLOAD_DIR);
        if (!dir.exists()) {
            dir.mkdirs();
        }

        String storedFileName = UUID.randomUUID() + "_" + file.getOriginalFilename();
        File destination = new File(dir.getAbsolutePath() + File.separator + storedFileName);
        file.transferTo(destination);

        String fileUrl = "/uploads/" + storedFileName;
        return ResponseEntity.ok(Map.of(
                "url", fileUrl,
                "fileName", file.getOriginalFilename(),
                "fileType", file.getContentType() != null ? file.getContentType() : "unknown"
        ));
    }
}