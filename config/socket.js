import { Server } from "socket.io";
import { verifyAccessToken, cookieNames } from "../services/token.service.js";
import { postChatMessage } from "../services/chat.service.js";

let io = null;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie || "";
      const accessCookie = cookieHeader
        .split("; ")
        .find((row) => row.startsWith(`${cookieNames.ACCESS_COOKIE}=`));

      if (!accessCookie) {
        return next(new Error("Authentication required"));
      }

      const token = accessCookie.split("=")[1];
      const payload = verifyAccessToken(token);

      if (!payload || !payload.sub) {
        return next(new Error("Invalid token"));
      }

      socket.userId = payload.sub;
      next();
    } catch (err) {
      next(new Error("Socket authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("join_room", (conversationId) => {
      socket.join(`room:${conversationId}`);
    });

    socket.on("leave_room", (conversationId) => {
      socket.leave(`room:${conversationId}`);
    });

    socket.on("send_message", async ({ conversationId, content }) => {
      try {
        if (!content || !content.trim()) return;
        const message = await postChatMessage({
          conversationId,
          senderId: socket.userId,
          content,
        });

        io.to(`room:${conversationId}`).emit("new_message", message);
      } catch (err) {
        socket.emit("chat_error", { message: err.message || "Failed to send message" });
      }
    });

    socket.on("typing", ({ conversationId }) => {
      socket.to(`room:${conversationId}`).emit("user_typing", { userId: socket.userId });
    });

    socket.on("stop_typing", ({ conversationId }) => {
      socket.to(`room:${conversationId}`).emit("user_stop_typing", { userId: socket.userId });
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
};
