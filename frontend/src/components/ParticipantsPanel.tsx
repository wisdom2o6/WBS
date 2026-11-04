import React, { useState } from "react";
import type { Participant } from "../types/presence";
import { getParticipantColor } from "../utils/colors";

interface ParticipantsPanelProps {
  participants: Participant[];
  currentUserDisplayName: string;
}

export const ParticipantsPanel: React.FC<ParticipantsPanelProps> = ({
  participants,
  currentUserDisplayName,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={`participants-panel ${isCollapsed ? "collapsed" : ""}`}
      aria-label="Danh sách người tham gia"
    >
      <div
        className="participants-header"
        onClick={() => setIsCollapsed(!isCollapsed)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            setIsCollapsed(!isCollapsed);
          }
        }}
      >
        <div className="header-title">
          <span className="online-indicator-dot" />
          <span className="header-text">Người tham gia</span>
          <span className="badge-count">{participants.length}</span>
        </div>
        <button
          type="button"
          className="btn-toggle-panel"
          title={isCollapsed ? "Mở rộng" : "Thu gọn"}
        >
          {isCollapsed ? "◀" : "▼"}
        </button>
      </div>

      {!isCollapsed && (
        <ul className="participants-list">
          {participants.length === 0 ? (
            <li className="participant-empty">Đang kết nối...</li>
          ) : (
            participants.map((p) => {
              const isCurrentUser = p.displayName === currentUserDisplayName;
              const color = getParticipantColor(p.displayName);
              const initial = p.displayName ? p.displayName.charAt(0).toUpperCase() : "?";

              return (
                <li key={p.sessionId} className="participant-item">
                  <span
                    className="participant-avatar"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  >
                    {initial}
                  </span>
                  <div className="participant-info">
                    <span className="participant-name">
                      {p.displayName}
                      {isCurrentUser && <span className="current-user-tag"> (Bạn)</span>}
                    </span>
                    <span className="participant-status">Online</span>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      )}
    </aside>
  );
};
