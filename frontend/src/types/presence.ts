export interface Participant {
  sessionId: string;
  displayName: string;
  joinedAt?: string;
}

export interface PresenceUpdateEvent {
  type: string;
  roomId: string;
  participants: Participant[];
}

