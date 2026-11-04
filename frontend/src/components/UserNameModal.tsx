import React, { useState } from "react";

interface UserNameModalProps {
  initialName?: string;
  onSubmit: (name: string) => void;
}

export const UserNameModal: React.FC<UserNameModalProps> = ({
  initialName = "",
  onSubmit,
}) => {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Vui lòng nhập tên hiển thị.");
      return;
    }
    if (trimmed.length > 30) {
      setError("Tên hiển thị không được vượt quá 30 ký tự.");
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <div className="modal-backdrop">
      <div className="user-name-modal">
        <h2>Chào mừng đến với WBS Whiteboard!</h2>
        <p>Vui lòng nhập tên hiển thị của bạn để bắt đầu cộng tác trong phòng vẽ:</p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input
              type="text"
              placeholder="Ví dụ: Wisdom, Minh, Alex..."
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              autoFocus
              maxLength={30}
            />
          </div>

          {error && <p className="modal-error">{error}</p>}

          <div className="modal-actions">
            <button
              type="submit"
              className="lobby-btn btn-primary"
              disabled={!name.trim()}
            >
              Vào phòng ➔
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

