-- 1. Bổ sung cột lưu trạng thái Canvas & State Vector CRDT
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS yjs_state_vector BYTEA,
ADD COLUMN IF NOT EXISTS canvas_snapshot TEXT;

-- 2. Bảng quản lý Tệp đính kèm & Tài nguyên Media (phục vụ Media.tsx & Documents.tsx)
CREATE TABLE IF NOT EXISTS workspace_assets (
    id BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    uploaded_by BIGINT REFERENCES users(id),
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- IMAGE, DOCUMENT, VIDEO, UNKNOWN
    file_size BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bảng lưu tin nhắn Chat phòng
CREATE TABLE IF NOT EXISTS room_messages (
    id BIGSERIAL PRIMARY KEY,
    room_id BIGINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    sender_id BIGINT NOT NULL REFERENCES users(id),
    sender_name VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    attachment_url VARCHAR(512),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);