import { redis } from "../database/redis";

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

/**
 * Joins a participant to a room.
 */
export const joinRoom = async (roomId: string, participant: Participant): Promise<Participant[] | { error: string }> => {
    const roomKey = `room:${roomId}`;
    const socketRoomKey = `socket_rooms:${participant.socketId}`;

    // Get current participants count
    const participantCount = await redis.hLen(roomKey);
    const alreadyInRoom = await redis.hExists(roomKey, participant.socketId);

    // Enforce Room Size Limits
    if (participantCount >= MAX_WEBRTC_PARTICIPANTS && !alreadyInRoom) {
        return { error: `Room is full. Maximum ${MAX_WEBRTC_PARTICIPANTS} participants allowed.` };
    }

    // Add participant to room hash
    await redis.hSet(roomKey, participant.socketId, JSON.stringify(participant));
    
    // Add room to socket's rooms set (for cleanup on disconnect)
    await redis.sAdd(socketRoomKey, roomId);

    // Return current list of participants (excluding the joiner)
    const allParticipants = await redis.hGetAll(roomKey);
    return Object.entries(allParticipants)
        .filter(([sid]) => sid !== participant.socketId)
        .map(([, data]) => JSON.parse(data));
};

/**
 * Leaves a participant from a room.
 */
export const leaveRoom = async (roomId: string, socketId: string): Promise<Participant | null> => {
    const roomKey = `room:${roomId}`;
    const socketRoomKey = `socket_rooms:${socketId}`;

    const participantData = await redis.hGet(roomKey, socketId);
    if (!participantData) return null;

    await redis.hDel(roomKey, socketId);
    await redis.sRem(socketRoomKey, roomId);

    // Cleanup room if empty (Redis Hash is automatically deleted when empty, but good to be explicit if needed)
    // Actually Redis deletes hashes when they are empty.

    return JSON.parse(participantData);
};

/**
 * Updates media state for a participant.
 */
export const updateMediaState = async (roomId: string, socketId: string, updates: Partial<Participant>): Promise<Participant | null> => {
    const roomKey = `room:${roomId}`;
    
    const participantData = await redis.hGet(roomKey, socketId);
    if (!participantData) return null;

    const participant: Participant = JSON.parse(participantData);
    Object.assign(participant, updates);

    await redis.hSet(roomKey, socketId, JSON.stringify(participant));
    return participant;
};

/**
 * Finds all rooms a socket is part of.
 */
export const findAllRoomsBySocketId = async (socketId: string): Promise<string[]> => {
    const socketRoomKey = `socket_rooms:${socketId}`;
    return await redis.sMembers(socketRoomKey);
};

/**
 * Gets all participants in a room.
 */
export const getParticipants = async (roomId: string): Promise<Participant[]> => {
    const roomKey = `room:${roomId}`;
    const allParticipants = await redis.hGetAll(roomKey);
    return Object.values(allParticipants).map(data => JSON.parse(data));
};

// For backward compatibility (though they are now async)
export const callManager = {
    joinRoom,
    leaveRoom,
    updateMediaState,
    findAllRoomsBySocketId,
    getParticipants
};
