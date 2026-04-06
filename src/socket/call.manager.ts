import { Socket } from "socket.io";

export interface Participant {
    userId: string;
    socketId: string;
    micEnabled: boolean;
    cameraEnabled: boolean;
    isScreenSharing: boolean;
}

export interface CallRoom {
    id: string; // channelId or roomId
    participants: Map<string, Participant>; // socketId -> Participant
}

// Module-level private state
const rooms: Map<string, CallRoom> = new Map();

/**
 * Joins a participant to a room. Creates the room if it doesn't exist.
 */
export const joinRoom = (roomId: string, participant: Participant): Participant[] => {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, { id: roomId, participants: new Map() });
    }
    const room = rooms.get(roomId)!;
    room.participants.set(participant.socketId, participant);
    // Return current list of participants (excluding the joiner)
    return Array.from(room.participants.values()).filter(p => p.socketId !== participant.socketId);
};

/**
 * Leaves a participant from a room. Cleans up the room if empty.
 */
export const leaveRoom = (roomId: string, socketId: string): Participant | null => {
    const room = rooms.get(roomId);
    if (!room) return null;

    const participant = room.participants.get(socketId) || null;
    room.participants.delete(socketId);

    if (room.participants.size === 0) {
        rooms.delete(roomId);
    }
    return participant;
};
/**
 * Updates media state for a participant.
 */
export const updateMediaState = (roomId: string, socketId: string, updates: Partial<Participant>): Participant | null => {
    const room = rooms.get(roomId);
    if (!room) return null;
    const participant = room.participants.get(socketId);
    if (!participant) return null;
    Object.assign(participant, updates);
    return participant;
};

/**
 * Finds a room by socket ID (useful for disconnects).
 */
export const findRoomBySocketId = (socketId: string): string | null => {
    for (const [roomId, room] of rooms.entries()) {
        if (room.participants.has(socketId)) {
            return roomId;
        }
    }
    return null;
};

/**
 * Gets all participants in a room.
 */
export const getParticipants = (roomId: string): Participant[] => {
    const room = rooms.get(roomId);
    return room ? Array.from(room.participants.values()) : [];
};
// For backward compatibility with existing code that uses callManager.method()
export const callManager = {
    joinRoom,
    leaveRoom,
    updateMediaState,
    findRoomBySocketId,
    getParticipants
};
