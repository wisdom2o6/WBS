-- ============================================================================
-- Phase 5: Room Chat Rich Interactions & E2EE Key Distribution
-- ============================================================================

-- 1. Lưu Public Key định danh của User (phục vụ bọc khóa phòng E2EE)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS public_key_jwk TEXT;

-- 2. Mở rộng bảng room_messages cho Reply, Edit, Pin, Soft Delete, Dedup & E2EE
ALTER TABLE room_messages
    ADD COLUMN IF NOT EXISTS client_message_id UUID,
    ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES room_messages(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS encryption_mode VARCHAR(20) NOT NULL DEFAULT 'E2EE_AES_GCM',
    ADD COLUMN IF NOT EXISTS key_version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS pinned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS attachment_file_id UUID REFERENCES room_files(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_room_messages_client_msg
    ON room_messages(room_id, client_message_id)
    WHERE client_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_room_messages_pinned
    ON room_messages(room_id, pinned_at DESC)
    WHERE pinned_at IS NOT NULL AND deleted_at IS NULL;

-- 3. Bảng thả biểu tượng cảm xúc (Reactions)
CREATE TABLE IF NOT EXISTS message_reactions (
    message_id UUID NOT NULL REFERENCES room_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    icon VARCHAR(30) NOT NULL CHECK (icon IN ('heart', 'check', 'star')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id, icon)
);

-- 4. Bảng phân phối khóa đối xứng của phòng đã bọc bằng Public Key từng thành viên
CREATE TABLE IF NOT EXISTS room_key_envelopes (
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_version INTEGER NOT NULL DEFAULT 1,
    encrypted_room_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (room_id, user_id, key_version)
);