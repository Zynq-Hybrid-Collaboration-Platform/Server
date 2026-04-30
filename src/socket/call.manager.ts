import { Socket } from "socket.io";

export const MAX_WEBRTC_PARTICIPANTS = 6;

export interface Participant {
    userId: string;
    socketId: string;
    micEnabled: boolean;
    cameraEnabled: boolean;
    isScreenSharing: boolean;
    name?: string;
    avatar?: string;
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
export const joinRoom = (roomId: string, participant: Participant): Participant[] | { error: string } => {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, { id: roomId, participants: new Map() });
    }
    const room = rooms.get(roomId)!;
    
    // Enforce Room Size Limits (Mesh Protection)
    if (room.participants.size >= MAX_WEBRTC_PARTICIPANTS && !room.participants.has(participant.socketId)) {
        return { error: `Room is full. Maximum ${MAX_WEBRTC_PARTICIPANTS} participants allowed.` };
    }

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
 * Finds all rooms a socket is part of (useful for complete disconnect cleanup).
 */
export const findAllRoomsBySocketId = (socketId: string): string[] => {
    const foundRooms: string[] = [];
    for (const [roomId, room] of rooms.entries()) {
        if (room.participants.has(socketId)) {
            foundRooms.push(roomId);
        }
    }
    return foundRooms;
};

/**
 * Garbage collection: removes empty rooms.
 * Can be called periodically to ensure memory is freed for orphaned rooms.
 */
export const cleanupEmptyRooms = () => {
    for (const [roomId, room] of rooms.entries()) {
        if (room.participants.size === 0) {
            rooms.delete(roomId);
        }
    }
};

// Periodic GC every 5 minutes
setInterval(cleanupEmptyRooms, 5 * 60 * 1000);

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
    findAllRoomsBySocketId,
    getParticipants
};
