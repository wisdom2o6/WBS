package com.wisdom.wbs.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wisdom.wbs.dto.CanvasDrawEvent;
import com.wisdom.wbs.entity.CanvasObject;
import com.wisdom.wbs.repository.CanvasObjectRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CanvasPersistenceService {

    private final CanvasObjectRepository canvasObjectRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public void saveOrUpdateEvent(CanvasDrawEvent event) {
        try {
            if (event.getRoomId() == null) {
                System.err.println("❌ Lỗi: RoomId bị null trong CanvasDrawEvent");
                return;
            }
            
            UUID roomId = UUID.fromString(event.getRoomId());
            String type = event.getType();

            // Safely convert payload to Map using ObjectMapper to avoid ClassCastException
            Map<String, Object> payload = objectMapper.convertValue(event.getPayload(), Map.class);
            if (payload == null) {
                System.err.println("❌ Lỗi: Payload của sự kiện trống hoặc không thể chuyển đổi thành Map.");
                return;
            }

            if ("ERASER".equals(type)) {
                String idToDelete = (String) payload.get("id");
                if (idToDelete != null) {
                    canvasObjectRepository.deleteByRoomIdAndId(roomId, idToDelete);
                    System.out.println("🗑️ Đã xóa Canvas Object: " + idToDelete);
                }
            } else {
                String shapeId = (String) payload.get("id");
                if (shapeId == null) {
                    System.err.println("❌ Lỗi: Thiếu ID của shape trong payload.");
                    return;
                }
                
                String payloadJson = objectMapper.writeValueAsString(payload);

                CanvasObject canvasObject = CanvasObject.builder()
                        .id(shapeId)
                        .roomId(roomId)
                        .type(type)
                        .payloadJson(payloadJson)
                        .build();

                canvasObjectRepository.save(canvasObject);
                System.out.println("✅ Đã lưu thành công Canvas Object: " + shapeId + " (Type: " + type + ")");
            }
        } catch (Exception e) {
            System.err.println("❌ Lỗi khi lưu Canvas Object vào Database: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @Transactional(readOnly = true)
    public List getRoomCanvasShapes(UUID roomId) {
        List<CanvasObject> objects = canvasObjectRepository.findByRoomIdOrderByCreatedAtAsc(roomId);
        return objects.stream().map(obj -> {
            try {
                return (Map<String, Object>) objectMapper.readValue(obj.getPayloadJson(), Map.class);
            } catch (Exception e) {
                System.err.println("❌ Lỗi khi deserialize Canvas Object ID " + obj.getId() + ": " + e.getMessage());
                return null;
            }
        }).filter(obj -> obj != null).toList();
    }
}