import { Server, Socket } from "socket.io";
import { joinRoom, leaveRoom, updateMediaState, findAllRoomsBySocketId, getParticipants, Participant } from "./call.manager";
import { UserModel } from "../models/auth.model";
import { config } from "../config/env";
import { logger } from "../logger/logger";



export const setupWebRTCHandlers = (io: Server) => {
    io.on("connection", (socket: Socket) => {
        const user = (socket as any).user;
        if (!user) {
            logger.warn(`Socket connected without user metadata: ${socket.id}`);
            return;
        }

        logger.info(`WebRTC handler attached for user: ${user.userId} (${socket.id})`);

        /**
         * Join a video/voice call in a specific channel or direct message room.
         */
        socket.on("webrtc:join", async (data: { roomId: string; micEnabled?: boolean; cameraEnabled?: boolean }) => {
            const { roomId, micEnabled = true, cameraEnabled = true } = data;

            // Fetch user metadata for enrichment
            let name = "Unknown User";
            let avatar = "";
            try {
                const userData = await UserModel.findById(user.userId).select("name avatar");
                if (userData) {
                    name = userData.name;
                    avatar = userData.avatar || "";
                }
            } catch (err) {
                logger.error("Failed to fetch user metadata for WebRTC participant", { error: err, userId: user.userId });
            }

            const participant: Participant = {
                userId: user.userId,
                socketId: socket.id,
                micEnabled,
                cameraEnabled,
                isScreenSharing: false,
                name,
                avatar
            };

            // Join the socket.io room for broadcasting
            socket.join(`webrtc-${roomId}`);

            // Add to call manager and get existing participants
            const others = joinRoom(roomId, participant);
            
            // Check for room size limit errors
            if (!Array.isArray(others) && 'error' in others) {
                socket.emit("webrtc:error", { message: others.error });
                socket.leave(`webrtc-${roomId}`);
                return;
            }
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
            // 3. Notify the entire channel that a call is now ongoing (if this is the first joiner)
            if (others.length === 0) {
                io.to(roomId).emit("webrtc:call-status-changed", {
                    roomId,
                    isOngoing: true
                });
            }

            console.log(`User ${user.userId} joined WebRTC room: ${roomId}`);
        });

        /**
         * Check if a call is ongoing in a room
         */
        socket.on("webrtc:check-call", (data: { roomId: string }, callback?: (res: { isOngoing: boolean; participants: Participant[] }) => void) => {
            const { roomId } = data;
            const participants = getParticipants(roomId);
            const isOngoing = participants.length > 0;

            const response = { isOngoing, participants };

            // Respond via callback if provided
            if (callback) {
                callback(response);
            } else {
                // Otherwise fallback to an event
                socket.emit("webrtc:call-status-response", response);
            }
        });


        /**
         * Dynamic TURN Credential Generation
         */
        socket.on("webrtc:get-ice-servers", () => {
            const iceServers: { urls: string | string[]; username?: string; credential?: string }[] = [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" }
            ];
            
            // Allow env-based TURN server config
            if (config.TURN_URL && config.TURN_USERNAME && config.TURN_PASSWORD) {
                iceServers.push({
                    urls: config.TURN_URL,
                    username: config.TURN_USERNAME,
                    credential: config.TURN_PASSWORD
                });
            }

            socket.emit("webrtc:ice-servers", { iceServers });
        });

        /**
         * Standard WebRTC signaling relay (Offer, Answer, ICE Candidates)
         */
        socket.on("webrtc:signal", (data: { targetSocketId: string; signal: any; roomId: string }) => {
            const { targetSocketId, signal, roomId } = data;

            // Security: verify both sender and target are in the same room
            const participants = getParticipants(roomId);
            const senderInRoom = participants.some(p => p.socketId === socket.id);
            const targetInRoom = participants.some(p => p.socketId === targetSocketId);

            if (!senderInRoom || !targetInRoom) {
                logger.warn(`Unauthorized WebRTC signal attempt from ${socket.id} to ${targetSocketId} in room ${roomId}`);
                return;
            }

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

            const updated = updateMediaState(roomId, socket.id, { micEnabled, cameraEnabled });

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

            const updated = updateMediaState(roomId, socket.id, { isScreenSharing: isSharing });

            if (updated) {
                socket.to(`webrtc-${roomId}`).emit("webrtc:screen-share-changed", {
                    socketId: socket.id,
                    userId: user.userId,
                    isSharing
                });
            }
        });

        /**
         * leave a call
         */
        const leaveCall = (roomId: string) => {
            const participant = leaveRoom(roomId, socket.id);

            if (participant) {
                socket.leave(`webrtc-${roomId}`);
                // 2. Notify the entire channel if the call ended (last person left)
                const remaining = getParticipants(roomId);
                if (remaining.length === 0) {
                    io.to(roomId).emit("webrtc:call-status-changed", {
                        roomId,
                        isOngoing: false
                    });
                }

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
            const roomIds = findAllRoomsBySocketId(socket.id);

            roomIds.forEach(roomId => {
                leaveCall(roomId);
            });
            
            logger.info(`User ${user.userId} disconnected - cleaned up WebRTC state for rooms: ${roomIds.join(", ")}`);
        });
    });
};
