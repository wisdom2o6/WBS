
import { useEffect, useState } from "react";
import { Client } from "@stomp/stompjs";

export default function WebSocketTest() {
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("Hello from React!");
  const [replies, setReplies] = useState<string[]>([]);
  const [client, setClient] = useState<Client | null>(null);

  useEffect(() => {
    const stompClient = new Client({
      brokerURL: "ws://localhost:8080/ws",
      reconnectDelay: 3000,

      onConnect: () => {
        setConnected(true);

        stompClient.subscribe("/topic/test", (frame) => {
          const data = JSON.parse(frame.body);
          setReplies((previous) => [
            ...previous,
            data.message,
          ]);
        });
      },

      onWebSocketClose: () => setConnected(false),
      onStompError: (frame) => {
        console.error("STOMP error:", frame.headers.message);
      },
    });

    setClient(stompClient);
    stompClient.activate();

    return () => {
      void stompClient.deactivate();
    };
  }, []);

  const sendMessage = () => {
    if (!client?.connected || !message.trim()) return;

    client.publish({
      destination: "/app/test",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message }),
    });
  };

  return (
    <section style={{
      padding: 16,
      marginBottom: 16,
      background: "white",
      border: "1px solid #cbd5e1",
      borderRadius: 12,
    }}>
      <h2>WebSocket Connection Test</h2>

      <p>
        Trạng thái:{" "}
        <strong style={{
          color: connected ? "green" : "crimson"
        }}>
          {connected ? "Đã kết nối" : "Đang kết nối..."}
        </strong>
      </p>

      <input
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Nhập thông điệp"
      />

      <button
        onClick={sendMessage}
        disabled={!connected || !message.trim()}
        style={{ marginLeft: 8 }}
      >
        Gửi thử
      </button>

      <h3>Phản hồi từ server</h3>

      {replies.map((reply, index) => (
        <p key={index}>{reply}</p>
      ))}
    </section>
  );
}
