package com.wisdom.wbs.service;

import com.wisdom.wbs.dto.ChatMessageDTO;
import java.util.List;
import java.util.UUID;

public interface RoomService {
    void saveCanvasSnapshot(UUID roomId, String canvasSnapshotJson);
    String getCanvasSnapshot(UUID roomId);
    void saveChatMessage(UUID roomId, ChatMessageDTO chatMessage);
    List<ChatMessageDTO> getRecentMessages(UUID roomId, int limit);
}