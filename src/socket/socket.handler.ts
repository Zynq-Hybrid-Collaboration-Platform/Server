import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { Message } from "../models/message.model";
import { Types } from "mongoose";

interface SocketUser {
    userId: string;
    organizations: any[];
}

export const setupSocketHandlers = (io: Server) => {
    // Middleware for Socket.io authentication
    io.use((socket, next) => {
        // Log handshake details for debugging
        console.log("Socket Handshake Auth:", socket.handshake.auth);
        console.log("Socket Handshake Headers Auth:", socket.handshake.headers.authorization);
        
        const authHeader = socket.handshake.headers.authorization;
        let token = socket.handshake.auth?.token;

        if (!token && authHeader) {
            // Support "Bearer <token>" or "Bearer:<token>"
            const match = authHeader.match(/^Bearer[:\s]+(.+)$/i);
            if (match) {
                token = match[1];
            }
        }

        if (!token) {
            token = socket.handshake.headers.cookie?.split('accessToken=')[1]?.split(';')[0];
        }
        
        if (!token) {
            console.error("Socket Auth Error: No token provided in handshake.auth, authorization header, or cookies.");
            return next(new Error("Authentication error: No token provided"));
        }

        try {
            const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET, {
                algorithms: ["HS256"],
            }) as any;
            
            (socket as any).user = {
                userId: decoded.id,
                organizations: decoded.organizations || []
            };
            next();
        } catch (err: any) {
            if (err.name === "TokenExpiredError") {
                console.error("Socket Auth Error: Token has expired");
                return next(new Error("Authentication error: Token expired"));
            }
            console.error("Socket Auth Error: Invalid token", err.message);
            next(new Error("Authentication error: Invalid token"));
        }
    });

    io.on("connection", (socket: Socket) => {
        const user = (socket as any).user as SocketUser;
        console.log(`User connected: ${user.userId} (Socket ID: ${socket.id})`);

        // Join a channel room
        socket.on("join-channel", (channelId: string) => {
            socket.join(channelId);
            console.log(`User ${user.userId} joined channel: ${channelId}`);
        });

        // Leave a channel room
        socket.on("leave-channel", (channelId: string) => {
            socket.leave(channelId);
            console.log(`User ${user.userId} left channel: ${channelId}`);
        });

        // Chat Message
        socket.on("send-message", async (data: { channelId: string; content: string; type?: string; attachments?: any[] }) => {
            const { channelId, content, type, attachments } = data;

            try {
                const message = await Message.create({
                    senderId: new Types.ObjectId(user.userId),
                    channelId: new Types.ObjectId(channelId),
                    content,
                    type: type || "TEXT",
                    attachments: attachments || [],
                });

                const populatedMessage = await Message.findById(message._id).populate("senderId", "name avatar");

                // Broadcast to everyone in the room (including sender if needed, but usually sender handles local state)
                io.to(channelId).emit("new-message", populatedMessage);
            } catch (error) {
                console.error("Error saving message:", error);
                socket.emit("error", { message: "Failed to send message" });
            }
        });

        // Typing indicator
        socket.on("typing", (data: { channelId: string; isTyping: boolean }) => {
            socket.to(data.channelId).emit("user-typing", {
                userId: user.userId,
                isTyping: data.isTyping
            });
        });

        // --- Video Calling & Screen Sharing (WebRTC Signaling) ---

        // Join Video/Voice Room
        socket.on("video:join", (data: { channelId: string }) => {
            const { channelId } = data;
            socket.join(`video-${channelId}`);
            
            // Notify others in the video room
            socket.to(`video-${channelId}`).emit("video:user-joined", {
                userId: user.userId,
                socketId: socket.id
            });

            console.log(`User ${user.userId} joined video room: ${channelId}`);
        });

        // Signaling (Offer, Answer, ICE Candidates)
        socket.on("video:signal", (data: { targetSocketId: string; signal: any }) => {
            io.to(data.targetSocketId).emit("video:signal", {
                senderSocketId: socket.id,
                userId: user.userId,
                signal: data.signal
            });
        });

        // Leave Video Room
        socket.on("video:leave", (data: { channelId: string }) => {
            socket.leave(`video-${data.channelId}`);
            socket.to(`video-${data.channelId}`).emit("video:user-left", {
                userId: user.userId,
                socketId: socket.id
            });
        });

        socket.on("disconnect", () => {
            console.log(`User disconnected: ${user.userId}`);
            // Clean up could be added here to notify video rooms if user was in one
        });
    });
};
