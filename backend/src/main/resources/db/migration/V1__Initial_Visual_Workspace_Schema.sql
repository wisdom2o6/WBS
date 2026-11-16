-- ============================================================================
-- WBS (Collaborative Visual Workspace) - Unified PostgreSQL Schema
-- Database: whiteboard_db (PostgreSQL 18+ / Supabase)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Bảng người dùng (Users & E2EE Identity Public Key)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150),
    avatar_url TEXT,
    public_key_jwk TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Bảng không gian làm việc (Workspaces)
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Bảng thành viên & phân quyền RBAC cấp Workspace (Workspace Members)
CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'MEMBER'
        CHECK (role IN ('OWNER', 'MEMBER', 'VIEWER')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, user_id)
);

-- 4. Bảng dự án trong Workspace (Projects)
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    color VARCHAR(30),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Bảng phân công thành viên vào từng Project (Project Members)
CREATE TABLE IF NOT EXISTS project_members (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'MEMBER'
        CHECK (role IN ('OWNER', 'MEMBER', 'VIEWER')),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);

-- 6. Bảng phòng bảng trắng (Rooms)
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL DEFAULT 'CANVAS',
    canvas_snapshot TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Bảng lưu trữ đối tượng vẽ trên Canvas (Canvas Persistence)
CREATE TABLE IF NOT EXISTS canvas_objects (
    id VARCHAR(100) PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    data_json TEXT NOT NULL,
    z_index INTEGER DEFAULT 0,
    updated_by VARCHAR(150),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Bảng tài liệu cộng tác (Collaborative Documents)
CREATE TABLE IF NOT EXISTS room_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    author VARCHAR(120),
    blocks_json TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Bảng tệp đính kèm / Media Library (Room Files)
CREATE TABLE IF NOT EXISTS room_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    uploader_id UUID REFERENCES users(id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(100),
    file_size BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Bảng tin nhắn thảo luận trong phòng (Room Messages & E2EE)
CREATE TABLE IF NOT EXISTS room_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    sender_name VARCHAR(150) NOT NULL,
    content TEXT NOT NULL,
    attachment_url VARCHAR(512),
    attachment_file_id UUID REFERENCES room_files(id) ON DELETE SET NULL,
    client_message_id UUID,
    reply_to_id UUID REFERENCES room_messages(id) ON DELETE SET NULL,
    encryption_mode VARCHAR(20) NOT NULL DEFAULT 'E2EE_AES_GCM',
    key_version INTEGER NOT NULL DEFAULT 1,
    edited_at TIMESTAMPTZ,
    pinned_at TIMESTAMPTZ,
    pinned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Bảng thả biểu tượng cảm xúc (Message Reactions)
CREATE TABLE IF NOT EXISTS message_reactions (
    message_id UUID NOT NULL REFERENCES room_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    icon VARCHAR(30) NOT NULL CHECK (icon IN ('heart', 'check', 'star')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id, icon)
);

-- 12. Bảng phân phối khóa đối xứng phòng E2EE đã bọc theo Public Key từng thành viên
CREATE TABLE IF NOT EXISTS room_key_envelopes (
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_version INTEGER NOT NULL DEFAULT 1,
    encrypted_room_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (room_id, user_id, key_version)
);

-- ============================================================================
-- Bổ sung cột còn thiếu cho các bảng đã tồn tại trên Database cũ
-- ============================================================================
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS public_key_jwk TEXT;

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE project_members
    ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
    ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'project_members_role_check'
    ) THEN
        ALTER TABLE project_members
            ADD CONSTRAINT project_members_role_check
            CHECK (role IN ('OWNER', 'MEMBER', 'VIEWER'));
    END IF;
END $$;

ALTER TABLE rooms
    ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE room_documents
    ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS author VARCHAR(120),
    ADD COLUMN IF NOT EXISTS blocks_json TEXT;

ALTER TABLE room_documents
    ALTER COLUMN room_id DROP NOT NULL;

ALTER TABLE room_files
    ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

ALTER TABLE room_files
    ALTER COLUMN room_id DROP NOT NULL;

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

-- Đồng bộ lại workspace_id cho dữ liệu cũ (nếu có)
UPDATE room_documents rd
SET workspace_id = p.workspace_id
FROM rooms r
JOIN projects p ON r.project_id = p.id
WHERE rd.room_id = r.id AND rd.workspace_id IS NULL;

UPDATE room_files rf
SET workspace_id = p.workspace_id
FROM rooms r
JOIN projects p ON r.project_id = p.id
WHERE rf.room_id = r.id AND rf.workspace_id IS NULL;

-- ============================================================================
-- Indexes tối ưu truy vấn
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_rooms_project ON rooms(project_id);
CREATE INDEX IF NOT EXISTS idx_canvas_objects_room ON canvas_objects(room_id);
CREATE INDEX IF NOT EXISTS idx_room_documents_workspace ON room_documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_room_documents_room ON room_documents(room_id);
CREATE INDEX IF NOT EXISTS idx_room_files_workspace ON room_files(workspace_id);
CREATE INDEX IF NOT EXISTS idx_room_files_room ON room_files(room_id);
CREATE INDEX IF NOT EXISTS idx_room_messages_room ON room_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_room_messages_room_created ON room_messages(room_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_room_messages_client_msg
    ON room_messages(room_id, client_message_id)
    WHERE client_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_room_messages_pinned
    ON room_messages(room_id, pinned_at DESC)
    WHERE pinned_at IS NOT NULL AND deleted_at IS NULL;