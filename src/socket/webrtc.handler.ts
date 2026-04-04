import { Server, Socket } from "socket.io";
import { callManager, Participant } from "./call.manager";

export const setupWebRTCHandlers = (io: Server) => {
    io.on("connection", (socket: Socket) => {
        const user = (socket as any).user;
        if (!user) {
            console.warn(`Socket connected without user metadata: ${socket.id}`);
            return;
        }

        console.log(`WebRTC handler attached for user: ${user.userId} (${socket.id})`);

        /**
         * Join a video/voice call in a specific channel or direct message room.
         */
        socket.on("webrtc:join", (data: { roomId: string; micEnabled?: boolean; cameraEnabled?: boolean }) => {
            const { roomId, micEnabled = true, cameraEnabled = true } = data;

            const participant: Participant = {
                userId: user.userId,
                socketId: socket.id,
                micEnabled,
                cameraEnabled,
                isScreenSharing: false,
            };

            // Join the socket.io room for broadcasting
            socket.join(`webrtc-${roomId}`);

            // Add to call manager and get existing participants
            const others = callManager.joinRoom(roomId, participant);

            // 1. Send the current participant list back to the joiner
            // This allows the joiner to initiate WebRTC offers to everyone already in the room
            socket.emit("webrtc:participants", {
                roomId,
                participants: others
            });

            // 2. Notify others that a new user has joined
            socket.to(`webrtc-${roomId}`).emit("webrtc:user-joined", {
                roomId,
                participant
            });

            console.log(`User ${user.userId} joined WebRTC room: ${roomId}`);
        });

        /**
         * Standard WebRTC signaling relay (Offer, Answer, ICE Candidates)
         */
        socket.on("webrtc:signal", (data: { targetSocketId: string; signal: any; roomId: string }) => {
            const { targetSocketId, signal, roomId } = data;
            
            // Relay the signal to the specific target peer
            io.to(targetSocketId).emit("webrtc:signal", {
                senderSocketId: socket.id,
                userId: user.userId,
                signal,
                roomId
            });
        });

        /**
         * Update media state (Mic mute/unmute, Camera on/off)
         */
        socket.on("webrtc:toggle-media", (data: { roomId: string; micEnabled?: boolean; cameraEnabled?: boolean }) => {
            const { roomId, micEnabled, cameraEnabled } = data;

            const updated = callManager.updateMediaState(roomId, socket.id, { micEnabled, cameraEnabled });
            if (updated) {
                socket.to(`webrtc-${roomId}`).emit("webrtc:media-state-changed", {
                    socketId: socket.id,
                    userId: user.userId,
                    micEnabled: updated.micEnabled,
                    cameraEnabled: updated.cameraEnabled
                });
            }
        });

        /**
         * Toggle Screen Sharing
         */
        socket.on("webrtc:toggle-screen-share", (data: { roomId: string; isSharing: boolean }) => {
            const { roomId, isSharing } = data;

            const updated = callManager.updateMediaState(roomId, socket.id, { isScreenSharing: isSharing });
            if (updated) {
                socket.to(`webrtc-${roomId}`).emit("webrtc:screen-share-changed", {
                    socketId: socket.id,
                    userId: user.userId,
                    isSharing
                });
            }
        });

        /**
         * Gracefully leave a call
         */
        const leaveCall = (roomId: string) => {
            const participant = callManager.leaveRoom(roomId, socket.id);
            if (participant) {
                socket.leave(`webrtc-${roomId}`);
                socket.to(`webrtc-${roomId}`).emit("webrtc:user-left", {
                    socketId: socket.id,
                    userId: user.userId,
                    roomId
                });
                console.log(`User ${user.userId} left WebRTC room: ${roomId}`);
            }
        };

        socket.on("webrtc:leave", (data: { roomId: string }) => {
            leaveCall(data.roomId);
        });

        /**
         * Handle disconnect - ensure cleanup
         */
        socket.on("disconnect", () => {
            const roomId = callManager.findRoomBySocketId(socket.id);
            if (roomId) {
                leaveCall(roomId);
            }
            console.log(`User ${user.userId} disconnected - cleaned up WebRTC state`);
        });
    });
};
