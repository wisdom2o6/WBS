import React, { useState } from "react";

interface RoomLobbyProps {
  onJoinRoom: (roomId: string) => void;
}

export const RoomLobby: React.FC<RoomLobbyProps> = ({ onJoinRoom }) => {
  const [inputRoomId, setInputRoomId] = useState("");
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const handleCreateRoom = async () => {
    setIsCreating(true);
    setErrorMessage(null);
    try {
      const response = await fetch("http://localhost:8080/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setCreatedRoomId(data.roomId);
    } catch (err) {
      console.error("Lỗi tạo phòng:", err);
      setErrorMessage("Không thể tạo phòng mới. Vui lòng kiểm tra backend.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinExistingRoom = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedId = inputRoomId.trim();

    if (!trimmedId) {
      setErrorMessage("Vui lòng nhập mã phòng.");
      return;
    }

    if (!/^[a-zA-Z0-9_-]{1,50}$/.test(trimmedId)) {
      setErrorMessage("Mã phòng chỉ chứa chữ cái, số, gạch dưới hoặc gạch nối (tối đa 50 ký tự).");
      return;
    }

    setIsJoining(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`http://localhost:8080/api/rooms/${trimmedId}`);

      if (response.status === 404) {
        setErrorMessage(`Phòng "${trimmedId}" không tồn tại. Vui lòng kiểm tra lại mã.`);
        return;
      }

      if (!response.ok) {
        setErrorMessage(`Lỗi kiểm tra phòng: HTTP ${response.status}`);
        return;
      }

      onJoinRoom(trimmedId);
    } catch (err) {
      console.error("Lỗi tham gia phòng:", err);
      setErrorMessage("Không thể kết nối đến máy chủ để kiểm tra phòng.");
    } finally {
      setIsJoining(false);
    }
  };

  const copyCreatedCode = () => {
    if (!createdRoomId) return;
    navigator.clipboard.writeText(createdRoomId);
    setCopyStatus("Đã sao chép mã phòng!");
    setTimeout(() => setCopyStatus(null), 3000);
  };

  return (
    <div className="lobby-container">
      <header className="lobby-header">
        <h1>WBS - Real-time Collaborative Whiteboard</h1>
        <p>Hệ thống bảng trắng cộng tác thời gian thực</p>
      </header>

      {errorMessage && (
        <div className="lobby-alert lobby-error" role="alert">
          {errorMessage}
        </div>
      )}

      <div className="lobby-cards-grid">
        {/* Card 1: Create Room */}
        <section className="lobby-card">
          <div className="card-icon">➕</div>
          <h2>Tạo phòng mới</h2>
          <p>Khởi tạo một bảng trắng mới với mã phòng riêng biệt và bảo mật.</p>

          <button
            className="lobby-btn btn-primary"
            onClick={handleCreateRoom}
            disabled={isCreating}
          >
            {isCreating ? "Đang tạo phòng..." : "Tạo phòng mới"}
          </button>

          {createdRoomId && (
            <div className="created-room-box">
              <p>Phòng đã được tạo thành công!</p>
              <div className="room-code-badge">
                <span>Mã phòng: <strong>{createdRoomId}</strong></span>
                <button
                  type="button"
                  className="btn-copy"
                  onClick={copyCreatedCode}
                  title="Sao chép mã phòng"
                >
                  {copyStatus ? copyStatus : "📋 Sao chép"}
                </button>
              </div>
              <button
                className="lobby-btn btn-join-created"
                onClick={() => onJoinRoom(createdRoomId)}
              >
                Vào phòng ngay ➔
              </button>
            </div>
          )}
        </section>

        {/* Card 2: Join Room */}
        <section className="lobby-card">
          <div className="card-icon">🔑</div>
          <h2>Tham gia phòng</h2>
          <p>Nhập mã phòng được chia sẻ để cùng tham gia vẽ và cộng tác thời gian thực.</p>

          <form onSubmit={handleJoinExistingRoom} className="join-form">
            <div className="input-group">
              <input
                type="text"
                placeholder="Nhập mã phòng (vd: a8F3kP2x)"
                value={inputRoomId}
                onChange={(e) => {
                  setInputRoomId(e.target.value);
                  setErrorMessage(null);
                }}
                disabled={isJoining}
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="lobby-btn btn-secondary"
              disabled={isJoining || !inputRoomId.trim()}
            >
              {isJoining ? "Đang kiểm tra..." : "Tham gia phòng"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};

