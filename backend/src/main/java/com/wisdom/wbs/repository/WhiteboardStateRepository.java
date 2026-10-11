
package com.wisdom.wbs.repository;

import com.wisdom.wbs.entity.WhiteboardState;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WhiteboardStateRepository
        extends JpaRepository<WhiteboardState, String> {
}
