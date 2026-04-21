import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { Message } from "../models/message.model";
import { Channel } from "../models/channel.model";
import Workspace from "../models/workspace.model";
import { Types } from "mongoose";
import { sendMessageSchema, pinMessageSchema, reactMessageSchema } from "../validators/message.validator";

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
        socket.on("send-message", async (data: { channelId: string; content: string; type?: string; attachments?: any[]; replyTo?: string }) => {
            const { error, value } = sendMessageSchema.validate(data);
            if (error) return socket.emit("error", { message: error.details[0].message });

            const { channelId, content, type, attachments, replyTo } = value;

            try {
                const message = await Message.create({
                    senderId: new Types.ObjectId(user.userId),
                    channelId: new Types.ObjectId(channelId),
                    content: content || "",
                    type: type || "TEXT",
                    attachments: attachments || [],
                    replyTo: replyTo ? new Types.ObjectId(replyTo) : null,
                });
                
                const populatedMessage = await Message.findById(message._id)
                    .populate("senderId", "name avatar")
                    .populate({
                        path: "replyTo",
                        populate: { path: "senderId", select: "name avatar" }
                    });

                // Broadcast to everyone in the room
                io.to(channelId).emit("new-message", populatedMessage);
            } catch (error) {
                console.error("Error saving message:", error);
                socket.emit("error", { message: "Failed to send message" });
            }
        });

        // Pin/Unpin Message
        socket.on("pin-message", async (data: { messageId: string; channelId: string; isPinned: boolean }) => {
            const { error, value } = pinMessageSchema.validate(data);
            if (error) return socket.emit("error", { message: error.details[0].message });

            const { messageId, channelId, isPinned } = value;

            try {
                const channel = await Channel.findById(channelId);
                if (!channel) return socket.emit("error", { message: "Channel not found" });

                const workspace = await Workspace.findById(channel.workspaceId);
                if (!workspace) return socket.emit("error", { message: "Workspace not found" });

                const member = workspace.members.find(m => m.userId.toString() === user.userId);
                if (!member || (member.role !== "admin" && member.role !== "owner")) {
                    return socket.emit("error", { message: "Unauthorized to pin messages" });
                }

                const message = await Message.findById(messageId);
                if (!message) return socket.emit("error", { message: "Message not found" });

                message.isPinned = isPinned;
                message.pinnedAt = isPinned ? new Date() : null;
                message.pinnedBy = isPinned ? new Types.ObjectId(user.userId) : null;
                await message.save();

                const populatedMessage = await Message.findById(message._id)
                    .populate("senderId", "name avatar")
                    .populate("pinnedBy", "name avatar")
                    .populate({
                        path: "replyTo",
                        populate: { path: "senderId", select: "name avatar" }
                    });

                io.to(channelId).emit("message-pinned", populatedMessage);
            } catch (error) {
                console.error("Error pinning message:", error);
                socket.emit("error", { message: "Failed to pin message" });
            }
        });

        // Emoji Reactions
        socket.on("react-message", async (data: { messageId: string; channelId: string; emoji: string }) => {
            const { error, value } = reactMessageSchema.validate(data);
            if (error) return socket.emit("error", { message: error.details[0].message });

            const { messageId, channelId, emoji } = value;
            const userId = new Types.ObjectId(user.userId);

            try {
                const message = await Message.findById(messageId);
                if (!message) return socket.emit("error", { message: "Message not found" });

                const reactionIndex = message.reactions.findIndex(r => r.emoji === emoji);

                if (reactionIndex > -1) {
                    const userIndex = message.reactions[reactionIndex].users.findIndex(id => id.toString() === userId.toString());
                    if (userIndex > -1) {
                        // Toggle Off: Remove user
                        message.reactions[reactionIndex].users.splice(userIndex, 1);
                        // Clean up if no users left for this emoji
                        if (message.reactions[reactionIndex].users.length === 0) {
                            message.reactions.splice(reactionIndex, 1);
                        }
                    } else {
                        // Toggle On: Add user
                        message.reactions[reactionIndex].users.push(userId);
                    }
                } else {
                    // New reaction
                    message.reactions.push({ emoji, users: [userId] });
                }

                await message.save();
                
                const updatedMessage = await Message.findById(messageId).populate("reactions.users", "name avatar");
                
                io.to(channelId).emit("message-reaction", { 
                    messageId, 
                    reactions: updatedMessage?.reactions || [] 
                });
            } catch (error) {
                console.error("Error reacting to message:", error);
                socket.emit("error", { message: "Failed to update reaction" });
            }
        });

        // Edit Message
        socket.on("edit-message", async (data: { messageId: string; channelId: string; content: string }) => {
            const { messageId, channelId, content } = data;

            try {
                const message = await Message.findById(messageId);
                if (!message) return socket.emit("error", { message: "Message not found" });
                if (message.senderId.toString() !== user.userId) return socket.emit("error", { message: "Unauthorized" });

                message.content = content;
                message.isEdited = true;
                await message.save();

                const populatedMessage = await Message.findById(message._id).populate("senderId", "name avatar");
                io.to(channelId).emit("message-edited", populatedMessage);
            } catch (error) {
                console.error("Error editing message:", error);
                socket.emit("error", { message: "Failed to edit message" });
            }
        });

        // Delete Message
        socket.on("delete-message", async (data: { messageId: string; channelId: string }) => {
            const { messageId, channelId } = data;

            try {
                const message = await Message.findById(messageId);
                if (!message) return socket.emit("error", { message: "Message not found" });
                if (message.senderId.toString() !== user.userId) return socket.emit("error", { message: "Unauthorized" });

                await Message.findByIdAndDelete(messageId);
                io.to(channelId).emit("message-deleted", { messageId, channelId });
            } catch (error) {
                console.error("Error deleting message:", error);
                socket.emit("error", { message: "Failed to delete message" });
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

        // Join Video
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
        });
    });
};
