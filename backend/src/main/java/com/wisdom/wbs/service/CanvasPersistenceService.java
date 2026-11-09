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
            UUID roomId = UUID.fromString(event.getRoomId());
            String type = event.getType();

            if ("ERASER".equals(type)) {
                Map<String, Object> payload = (Map<String, Object>) event.getPayload();
                String idToDelete = (String) payload.get("id");
                if (idToDelete != null) {
                    canvasObjectRepository.deleteByRoomIdAndId(roomId, idToDelete);
                }
            } else {
                Map<String, Object> payload = (Map<String, Object>) event.getPayload();
                String shapeId = (String) payload.get("id");
                String payloadJson = objectMapper.writeValueAsString(payload);

                CanvasObject canvasObject = CanvasObject.builder()
                        .id(shapeId)
                        .roomId(roomId)
                        .type(type)
                        .payloadJson(payloadJson)
                        .build();

                canvasObjectRepository.save(canvasObject);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Transactional(readOnly = true)
    public List<Object> getRoomCanvasShapes(UUID roomId) {
        List<CanvasObject> objects = canvasObjectRepository.findByRoomIdOrderByCreatedAtAsc(roomId);
        return objects.stream().map(obj -> {
            try {
                return objectMapper.readValue(obj.getPayloadJson(), Object.class);
            } catch (Exception e) {
                return null;
            }
        }).filter(obj -> obj != null).toList();
    }
}