-- 1. Bổ sung trường canvas_snapshot vào bảng rooms
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS canvas_snapshot TEXT;

-- 2. Tạo bảng lưu trữ tin nhắn phòng chat
CREATE TABLE IF NOT EXISTS room_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    sender_id UUID,
    sender_name VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    attachment_url VARCHAR(512),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index để tối ưu tốc độ truy vấn tin nhắn gần đây theo phòng
CREATE INDEX IF NOT EXISTS idx_room_messages_room_created 
ON room_messages(room_id, created_at DESC);