import { useEffect, useState } from "react";
import { RoomLobby } from "./components/RoomLobby";
import { WhiteboardCanvas } from "./components/WhiteboardCanvas";
import "./App.css";

function parseRoomIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;

  // Hỗ trợ dạng /room/:roomId
  const match = window.location.pathname.match(/^\/room\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return match[1];
  }

  // Hỗ trợ dạng ?room=:roomId
  const searchParams = new URLSearchParams(window.location.search);
  const queryRoom = searchParams.get("room");
  if (queryRoom && /^[a-zA-Z0-9_-]+$/.test(queryRoom)) {
    return queryRoom;
  }

  return null;
}

function App() {
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState<boolean>(() => {
    return parseRoomIdFromUrl() !== null;
  });

  // Khởi tạo phòng từ URL pathname hoặc query string
  useEffect(() => {
    const initialRoomId = parseRoomIdFromUrl();

    if (initialRoomId) {
      // Xác thực phòng với backend
      fetch(`http://localhost:8080/api/rooms/${initialRoomId}`)
        .then((res) => {
          if (res.ok) {
            setCurrentRoomId(initialRoomId);
          } else {
            // Nếu phòng không tồn tại thì quay về sảnh
            window.history.replaceState({}, "", "/");
            setCurrentRoomId(null);
          }
        })
        .catch((err) => {
          console.error("Lỗi xác thực phòng ban đầu:", err);
          window.history.replaceState({}, "", "/");
          setCurrentRoomId(null);
        })
        .finally(() => {
          setInitialLoading(false);
        });
    }

    // Xử lý nút Back/Forward của trình duyệt
    const handlePopState = () => {
      const poppedRoomId = parseRoomIdFromUrl();
      setCurrentRoomId(poppedRoomId);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const handleJoinRoom = (roomId: string) => {
    setCurrentRoomId(roomId);
    window.history.pushState({}, "", `/room/${roomId}`);
  };

  const handleLeaveRoom = () => {
    setCurrentRoomId(null);
    window.history.pushState({}, "", "/");
  };

  if (initialLoading) {
    return (
      <div className="lobby-container loading-container">
        <p>Đang kiểm tra thông tin phòng...</p>
      </div>
    );
  }

  return currentRoomId ? (
    <WhiteboardCanvas key={currentRoomId} roomId={currentRoomId} onLeaveRoom={handleLeaveRoom} />
  ) : (
    <RoomLobby onJoinRoom={handleJoinRoom} />
  );
}

export default App;
