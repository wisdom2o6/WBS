package com.wisdom.wbs.repository;

import com.wisdom.wbs.entity.MessageReaction;
import com.wisdom.wbs.entity.MessageReactionId;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MessageReactionRepository extends JpaRepository<MessageReaction, MessageReactionId> {
    @EntityGraph(attributePaths = {"user"})
    List<MessageReaction> findByIdMessageIdIn(List<UUID> messageIds);
}