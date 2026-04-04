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

export class CallManager {
    private rooms: Map<string, CallRoom> = new Map();

    /**
     * Joins a participant to a room. Creates the room if it doesn't exist.
     */
    public joinRoom(roomId: string, participant: Participant): Participant[] {
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, { id: roomId, participants: new Map() });
        }

        const room = this.rooms.get(roomId)!;
        room.participants.set(participant.socketId, participant);

        // Return current list of participants (excluding the joiner)
        return Array.from(room.participants.values()).filter(p => p.socketId !== participant.socketId);
    }

    /**
     * Leaves a participant from a room. Cleans up the room if empty.
     */
    public leaveRoom(roomId: string, socketId: string): Participant | null {
        const room = this.rooms.get(roomId);
        if (!room) return null;

        const participant = room.participants.get(socketId) || null;
        room.participants.delete(socketId);

        if (room.participants.size === 0) {
            this.rooms.delete(roomId);
        }

        return participant;
    }

    /**
     * Updates media state for a participant.
     */
    public updateMediaState(roomId: string, socketId: string, updates: Partial<Participant>): Participant | null {
        const room = this.rooms.get(roomId);
        if (!room) return null;

        const participant = room.participants.get(socketId);
        if (!participant) return null;

        Object.assign(participant, updates);
        return participant;
    }

    /**
     * Finds a room by socket ID (useful for disconnects).
     */
    public findRoomBySocketId(socketId: string): string | null {
        for (const [roomId, room] of this.rooms.entries()) {
            if (room.participants.has(socketId)) {
                return roomId;
            }
        }
        return null;
    }

    /**
     * Gets all participants in a room.
     */
    public getParticipants(roomId: string): Participant[] {
        const room = this.rooms.get(roomId);
        return room ? Array.from(room.participants.values()) : [];
    }
}

export const callManager = new CallManager();
