package com.wisdom.wbs.service;

import com.wisdom.wbs.dto.ChatEventDto;
import com.wisdom.wbs.dto.ChatMessageDTO;
import com.wisdom.wbs.dto.ChatSendRequest;
import com.wisdom.wbs.entity.*;
import com.wisdom.wbs.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class RoomChatService {

    private final RoomRepository roomRepository;
    private final WorkspaceMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final RoomMessageRepository messageRepository;
    private final MessageReactionRepository reactionRepository;
    private final RoomFileRepository fileRepository;
    private final RoomKeyEnvelopeRepository keyEnvelopeRepository;
    private final SimpMessagingTemplate messagingTemplate;

    // 1. Lấy lịch sử tin nhắn (trả về thứ tự thời gian tăng dần ASC)
    @Transactional(readOnly = true)
    public List<ChatMessageDTO> getHistory(UUID roomId, UUID beforeId, UUID afterId, String principal) {
        requireAccess(roomId, principal, false);

        List<RoomMessage> raw;
        if (afterId != null) {
            RoomMessage anchor = messageRepository.findById(afterId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            raw = messageRepository.findByRoomIdAndCreatedAtAfterOrderByCreatedAtAsc(roomId, anchor.getCreatedAt());
        } else if (beforeId != null) {
            RoomMessage anchor = messageRepository.findById(beforeId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            raw = new ArrayList<>(messageRepository.findTop50ByRoomIdAndCreatedAtBeforeOrderByCreatedAtDesc(roomId, anchor.getCreatedAt()));
            Collections.reverse(raw);
        } else {
            raw = new ArrayList<>(messageRepository.findTop50ByRoomIdOrderByCreatedAtDesc(roomId));
            Collections.reverse(raw);
        }

        return toDtoList(raw);
    }

    // 2a. Lưu tin nhắn mới (dùng cho @SendTo trong RoomRealtimeController để tránh gửi trùng 2 lần)
    public ChatMessageDTO saveMessageOnly(UUID roomId, ChatSendRequest req, String principal) {
        WorkspaceMember member = requireAccess(roomId, principal, true);
        User sender = member.getUser();

        if (req.getClientMessageId() != null) {
            Optional<RoomMessage> existing = messageRepository.findByRoomIdAndClientMessageId(roomId, req.getClientMessageId());
            if (existing.isPresent()) {
                return toDtoList(List.of(existing.get())).getFirst();
            }
        }

        String attachmentUrl = null;
        if (req.getAttachmentFileId() != null) {
            attachmentUrl = fileRepository.findById(req.getAttachmentFileId())
                    .map(RoomFile::getFileUrl)
                    .orElse(null);
        }

        RoomMessage msg = RoomMessage.builder()
                .roomId(roomId)
                .senderId(sender.getId())
                .senderName(sender.getUsername())
                .content(req.getMessage())
                .clientMessageId(req.getClientMessageId())
                .replyToId(req.getReplyToId())
                .attachmentFileId(req.getAttachmentFileId())
                .attachmentUrl(attachmentUrl)
                .encryptionMode(req.getEncryptionMode() != null ? req.getEncryptionMode() : "E2EE_AES_GCM")
                .keyVersion(req.getKeyVersion() != null ? req.getKeyVersion() : 1)
                .createdAt(Instant.now())
                .build();

        RoomMessage saved = messageRepository.save(msg);
        return toDtoList(List.of(saved)).getFirst();
    }

    // 2b. Lưu và broadcast tin nhắn mới (dùng cho REST POST /messages)
    public ChatMessageDTO sendMessage(UUID roomId, ChatSendRequest req, String principal) {
        ChatMessageDTO dto = saveMessageOnly(roomId, req, principal);
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/chat", dto);
        return dto;
    }

    // 3. Chỉnh sửa tin nhắn (Chỉ tác giả)
    public ChatMessageDTO editMessage(UUID roomId, UUID messageId, String newContent, String principal) {
        WorkspaceMember member = requireAccess(roomId, principal, true);
        RoomMessage msg = getRoomMessage(roomId, messageId);

        if (!member.getUser().getId().equals(msg.getSenderId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ có thể sửa tin nhắn của chính mình");
        }
        if (msg.getDeletedAt() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tin nhắn đã bị xóa");
        }

        msg.setContent(newContent);
        msg.setEditedAt(Instant.now());
        ChatMessageDTO dto = toDtoList(List.of(messageRepository.save(msg))).getFirst();
        broadcastEvent(roomId, "UPDATED", dto);
        return dto;
    }

    // 4. Xóa mềm tin nhắn (Tác giả hoặc OWNER)
    public void deleteMessage(UUID roomId, UUID messageId, String principal) {
        WorkspaceMember member = requireAccess(roomId, principal, true);
        RoomMessage msg = getRoomMessage(roomId, messageId);

        boolean isAuthor = member.getUser().getId().equals(msg.getSenderId());
        boolean isOwner = member.getRole() == UserRole.OWNER;
        if (!isAuthor && !isOwner) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không có quyền xóa tin nhắn này");
        }

        msg.setDeletedAt(Instant.now());
        msg.setContent("");
        ChatMessageDTO dto = toDtoList(List.of(messageRepository.save(msg))).getFirst();
        broadcastEvent(roomId, "DELETED", dto);
    }

    // 5. Ghim / Bỏ ghim tin nhắn (OWNER & MEMBER)
    public ChatMessageDTO togglePin(UUID roomId, UUID messageId, boolean pinned, String principal) {
        WorkspaceMember member = requireAccess(roomId, principal, true);
        RoomMessage msg = getRoomMessage(roomId, messageId);

        msg.setPinnedAt(pinned ? Instant.now() : null);
        msg.setPinnedBy(pinned ? member.getUser().getId() : null);
        ChatMessageDTO dto = toDtoList(List.of(messageRepository.save(msg))).getFirst();
        broadcastEvent(roomId, "PINNED", dto);
        return dto;
    }

    // 6. Toggle Reaction (heart, check, star)
    public ChatMessageDTO toggleReaction(UUID roomId, UUID messageId, String icon, String principal) {
        WorkspaceMember member = requireAccess(roomId, principal, true);
        RoomMessage msg = getRoomMessage(roomId, messageId);

        MessageReactionId rid = new MessageReactionId(messageId, member.getUser().getId(), icon);
        if (reactionRepository.existsById(rid)) {
            reactionRepository.deleteById(rid);
        } else {
            reactionRepository.save(MessageReaction.builder()
                    .id(rid)
                    .user(member.getUser())
                    .createdAt(Instant.now())
                    .build());
        }

        ChatMessageDTO dto = toDtoList(List.of(msg)).getFirst();
        broadcastEvent(roomId, "REACTED", dto);
        return dto;
    }

    // 7. Quản lý khóa E2EE (Public Key & Room Key Envelope)
    public void saveUserPublicKey(String principal, String publicKeyJwk) {
        User user = resolveUser(principal);
        user.setPublicKeyJwk(publicKeyJwk);
        userRepository.save(user);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getRoomKeyEnvelope(UUID roomId, String principal) {
        WorkspaceMember member = requireAccess(roomId, principal, false);
        return keyEnvelopeRepository
                .findTopByIdRoomIdAndIdUserIdOrderByIdKeyVersionDesc(roomId, member.getUser().getId())
                .map(env -> Map.<String, Object>of(
                        "roomId", roomId,
                        "keyVersion", env.getId().getKeyVersion(),
                        "encryptedRoomKey", env.getEncryptedRoomKey()
                ))
                .orElse(Map.of("roomId", roomId, "keyVersion", 0));
    }

    public void distributeRoomKeys(UUID roomId, int keyVersion, Map<UUID, String> envelopesByUserId, String principal) {
        requireAccess(roomId, principal, true);
        envelopesByUserId.forEach((uid, encKey) -> {
            RoomKeyEnvelopeId id = new RoomKeyEnvelopeId(roomId, uid, keyVersion);
            keyEnvelopeRepository.save(RoomKeyEnvelope.builder()
                    .id(id)
                    .encryptedRoomKey(encKey)
                    .createdAt(Instant.now())
                    .build());
        });
    }

    // --- Helper Methods ---
    private void broadcastEvent(UUID roomId, String type, ChatMessageDTO payload) {
        // Kênh riêng cho sự kiện sửa/xóa/ghim/reaction để không xung đột kênh nhận tin mới
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/chat.events", new ChatEventDto(type, payload));
    }

    private RoomMessage getRoomMessage(UUID roomId, UUID messageId) {
        RoomMessage msg = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tin nhắn không tồn tại"));
        if (!msg.getRoomId().equals(roomId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tin nhắn không thuộc phòng này");
        }
        return msg;
    }

    private WorkspaceMember requireAccess(UUID roomId, String principal, boolean requireWrite) {
        User user = resolveUser(principal);
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room không tồn tại"));
        UUID workspaceId = room.getProject().getWorkspace().getId();
        WorkspaceMember member = memberRepository.findByIdWorkspaceIdAndIdUserId(workspaceId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Không có quyền truy cập phòng này"));
        if (requireWrite && member.getRole() == UserRole.VIEWER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "VIEWER không có quyền thao tác trên Chat");
        }
        return member;
    }

    private User resolveUser(String principal) {
        return userRepository.findByUsername(principal)
                .orElseGet(() -> userRepository.findByEmail(principal)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED)));
    }

    private List<ChatMessageDTO> toDtoList(List<RoomMessage> messages) {
        if (messages.isEmpty()) return List.of();

        List<UUID> ids = messages.stream().map(RoomMessage::getId).toList();
        Map<UUID, List<MessageReaction>> reactionsByMsg = reactionRepository.findByIdMessageIdIn(ids)
                .stream().collect(Collectors.groupingBy(r -> r.getId().getMessageId()));

        Set<UUID> replyIds = messages.stream().map(RoomMessage::getReplyToId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<UUID, RoomMessage> replyMap = replyIds.isEmpty() ? Map.of()
                : messageRepository.findByIdIn(replyIds).stream().collect(Collectors.toMap(RoomMessage::getId, m -> m));

        Set<UUID> fileIds = messages.stream().map(RoomMessage::getAttachmentFileId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<UUID, RoomFile> fileMap = fileIds.isEmpty() ? Map.of()
                : fileRepository.findAllById(fileIds).stream().collect(Collectors.toMap(RoomFile::getId, f -> f));

        return messages.stream().map(m -> {
            List<ChatMessageDTO.ReactionGroupDto> reactionGroups = reactionsByMsg.getOrDefault(m.getId(), List.of())
                    .stream()
                    .collect(Collectors.groupingBy(r -> r.getId().getIcon(), LinkedHashMap::new,
                            Collectors.mapping(r -> r.getUser().getUsername(), Collectors.toList())))
                    .entrySet().stream()
                    .map(e -> ChatMessageDTO.ReactionGroupDto.builder().icon(e.getKey()).users(e.getValue()).build())
                    .toList();

            String replyPreview = null;
            if (m.getReplyToId() != null && replyMap.containsKey(m.getReplyToId())) {
                RoomMessage parent = replyMap.get(m.getReplyToId());
                replyPreview = parent.getDeletedAt() != null
                        ? parent.getSenderName() + ": [Tin nhắn đã bị xóa]"
                        : parent.getSenderName() + ": " + parent.getContent();
            }

            ChatMessageDTO.AttachmentDto attachmentDto = null;
            if (m.getAttachmentFileId() != null && fileMap.containsKey(m.getAttachmentFileId())) {
                RoomFile f = fileMap.get(m.getAttachmentFileId());
                attachmentDto = ChatMessageDTO.AttachmentDto.builder()
                        .name(f.getFileName())
                        .url(f.getFileUrl())
                        .type(f.getFileType() != null ? f.getFileType() : "application/octet-stream")
                        .build();
            }

            String displayBody = m.getDeletedAt() != null ? "[Tin nhắn đã bị xóa]" : m.getContent();

            return ChatMessageDTO.builder()
                    .id(m.getId().toString())
                    .clientMessageId(m.getClientMessageId())
                    .roomId(m.getRoomId().toString())
                    .senderId(m.getSenderId() != null ? m.getSenderId().toString() : null)
                    .senderName(m.getSenderName())
                    .senderUsername(m.getSenderName())
                    .content(displayBody)
                    .message(displayBody)
                    .attachmentUrl(m.getAttachmentUrl())
                    .timestamp(m.getCreatedAt().toString())
                    .replyToId(m.getReplyToId())
                    .replyTo(replyPreview)
                    .pinned(m.getPinnedAt() != null)
                    .edited(m.getEditedAt() != null)
                    .deleted(m.getDeletedAt() != null)
                    .encryptionMode(m.getEncryptionMode())
                    .keyVersion(m.getKeyVersion())
                    .reactions(reactionGroups)
                    .attachment(attachmentDto)
                    .build();
        }).toList();
    }
}