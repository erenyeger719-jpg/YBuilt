import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { verifyToken, type JWTPayload } from "./middleware/auth.js";
import { storage } from "./storage.js";
import { logger } from "./middleware/logging.js";
import * as SocketBus from "./socketBus.js";
const { setIO } = (SocketBus as any).default ?? SocketBus;

interface AuthenticatedSocket extends Socket {
  user?: JWTPayload;
}

export function initializeSocket(httpServer: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.APP_ORIGIN || "http://localhost:3000",
      credentials: true,
    },
  });

  // Wire IO into the socket bus so stage/log/done can emit
  setIO(io);

  // ---- Live room member tracking for Project Chat ----
  // room -> userId -> { email, count }
  const roomMembers: Map<string, Map<string, { email: string; count: number }>> =
    new Map();

  function emitUsers(room: string) {
    const members = Array.from(roomMembers.get(room)?.entries() || []).map(
      ([userId, v]) => ({ userId, username: v.email })
    );
    io.to(room).emit("presence:users", {
      projectId: room.startsWith("project:") ? room.slice(8) : room,
      users: members,
    });
  }

  function joinMember(room: string, userId: string, email: string) {
    let m = roomMembers.get(room);
    if (!m) roomMembers.set(room, (m = new Map()));
    const cur = m.get(userId);
    m.set(userId, { email, count: (cur?.count || 0) + 1 });
    emitUsers(room);
  }

  function leaveMember(room: string, userId: string) {
    const m = roomMembers.get(room);
    if (!m) return;
    const cur = m.get(userId);
    if (!cur) return;
    if (cur.count <= 1) m.delete(userId);
    else m.set(userId, { ...cur, count: cur.count - 1 });
    emitUsers(room);
  }

  // Authentication middleware for Socket.IO
  io.use((socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        // Allow anonymous connections for public features
        logger.debug("[SOCKET] Anonymous connection attempt");
        return next();
      }

      // Verify JWT token
      const decoded = verifyToken(token);
      socket.user = decoded;
      logger.info(`[SOCKET] Authenticated user connected: ${decoded.email}`);
      next();
    } catch (error) {
      logger.error({ error }, "[SOCKET] Authentication failed");
      next(new Error("Authentication failed"));
    }
  });

  // ---- Builds namespace (tiny room so client can join for build progress) ----
  const buildsNs = io.of("/builds");
  buildsNs.on("connection", (socket: Socket) => {
    socket.on("join-build", (buildId: string) => {
      if (typeof buildId === "string" && buildId) {
        socket.join(buildId);
        logger.info(`[SOCKET:BUILDS] ${socket.id} joined build ${buildId}`);
      }
    });
  });

  // Connection handler (default namespace)
  io.on("connection", (socket: AuthenticatedSocket) => {
    const userId = socket.user?.sub || "anonymous";
    logger.info(`[SOCKET] Client connected: ${socket.id} (User: ${userId})`);

    // Join user's personal room
    if (socket.user) {
      socket.join(`user:${socket.user.sub}`);
    }

    // Join project room
    socket.on("join:project", (projectId: string) => {
      socket.join(`project:${projectId}`);
      logger.info(`[SOCKET] ${socket.id} joined project: ${projectId}`);
      const room = `project:${projectId}`;
      const count = io.sockets.adapter.rooms.get(room)?.size || 0;
      io.to(room).emit("presence:update", { projectId, count });
      if (socket.user) {
        joinMember(room, String(socket.user.sub), socket.user.email);
      }
    });

    // Leave project room
    socket.on("leave:project", (projectId: string) => {
      socket.leave(`project:${projectId}`);
      logger.info(`[SOCKET] ${socket.id} left project: ${projectId}`);
      const room = `project:${projectId}`;
      const count = io.sockets.adapter.rooms.get(room)?.size || 0;
      io.to(room).emit("presence:update", { projectId, count });
      if (socket.user) {
        leaveMember(room, String(socket.user.sub));
      }
    });

    // Handle chat messages - AI Assistant mode
    socket.on(
      "chat:ai-assistant",
      async (data: {
        projectId?: string;
        message: string;
      }) => {
        try {
          if (!socket.user) {
            socket.emit("error", { message: "Authentication required for AI chat" });
            return;
          }

          // Save user message
          const userMessage = await storage.createChatMessage({
            userId: socket.user.sub.toString(),
            projectId: data.projectId || null,
            role: "user",
            content: data.message,
            metadata: { type: "ai-assistant" },
          });

          // Echo user message back
          socket.emit("chat:message", {
            id: userMessage.id,
            role: "user",
            content: userMessage.content,
            createdAt: userMessage.createdAt,
          });

          // TODO: Integrate with OpenAI for AI response
          // For now, send a mock response
          const aiResponse = await storage.createChatMessage({
            userId: socket.user.sub.toString(),
            projectId: data.projectId || null,
            role: "assistant",
            content: `I understand you want to: "${data.message}". How can I help you build that?`,
            metadata: { type: "ai-assistant" },
          });

          socket.emit("chat:message", {
            id: aiResponse.id,
            role: "assistant",
            content: aiResponse.content,
            createdAt: aiResponse.createdAt,
          });

          logger.info(`[CHAT:AI] User ${socket.user.sub} sent message`);
        } catch (error) {
          logger.error({ error }, "[CHAT:AI] Error");
          socket.emit("error", { message: "Failed to process AI chat message" });
        }
      }
    );

    // Handle chat messages - Collaboration mode
    socket.on(
      "chat:collaboration",
      async (data: {
        projectId: string;
        message: string;
      }) => {
        try {
          if (!socket.user) {
            socket.emit("error", { message: "Authentication required for collaboration" });
            return;
          }

          // Save message
          const chatMessage = await storage.createChatMessage({
            userId: socket.user.sub.toString(),
            projectId: data.projectId,
            role: "user",
            content: data.message,
            metadata: { type: "collaboration" },
          });

          // Broadcast to all users in the project room
          io.to(`project:${data.projectId}`).emit("chat:message", {
            id: chatMessage.id,
            userId: socket.user.sub,
            username: socket.user.email,
            role: "user",
            content: chatMessage.content,
            createdAt: chatMessage.createdAt,
          });

          logger.info(
            `[CHAT:COLLAB] User ${socket.user.sub} sent message to project ${data.projectId}`
          );
        } catch (error) {
          logger.error({ error }, "[CHAT:COLLAB] Error");
          socket.emit("error", { message: "Failed to send collaboration message" });
        }
      }
    );

    // Handle chat messages - Support mode
    socket.on(
      "chat:support",
      async (data: {
        message: string;
        ticketId?: string;
      }) => {
        try {
          if (!socket.user) {
            socket.emit("error", { message: "Authentication required for support chat" });
            return;
          }

          // Save message
          const chatMessage = await storage.createChatMessage({
            userId: socket.user.sub.toString(),
            projectId: null,
            role: "user",
            content: data.message,
            metadata: {
              type: "support",
              ticketId: data.ticketId,
            },
          });

          // Send confirmation
          socket.emit("chat:message", {
            id: chatMessage.id,
            role: "user",
            content: chatMessage.content,
            createdAt: chatMessage.createdAt,
          });

          // Auto-response for support
          const supportResponse = await storage.createChatMessage({
            userId: socket.user.sub.toString(),
            projectId: null,
            role: "system",
            content:
              "Thank you for contacting support. A team member will respond shortly.",
            metadata: {
              type: "support",
              ticketId: data.ticketId,
            },
          });

          socket.emit("chat:message", {
            id: supportResponse.id,
            role: "system",
            content: supportResponse.content,
            createdAt: supportResponse.createdAt,
          });

          logger.info(`[CHAT:SUPPORT] User ${socket.user.sub} sent support message`);
        } catch (error) {
          logger.error({ error }, "[CHAT:SUPPORT] Error");
          socket.emit("error", { message: "Failed to send support message" });
        }
      }
    );

    // Handle typing indicators
    socket.on("typing:start", (data: { projectId?: string }) => {
      if (!socket.user) return;

      const room = data.projectId ? `project:${data.projectId}` : `user:${socket.user!.sub}`;
      socket.to(room).emit("typing:user", {
        userId: socket.user!.sub,
        username: socket.user!.email,
        typing: true,
      });
    });

    socket.on("typing:stop", (data: { projectId?: string }) => {
      if (!socket.user) return;

      const room = data.projectId ? `project:${data.projectId}` : `user:${socket.user!.sub}`;
      socket.to(room).emit("typing:user", {
        userId: socket.user!.sub,
        username: socket.user!.email,
        typing: false,
      });
    });

    // Disconnect handler
    socket.on("disconnect", () => {
      logger.info(`[SOCKET] Client disconnected: ${socket.id}`);
      for (const room of socket.rooms) {
        if (room.startsWith("project:")) {
          const count = io.sockets.adapter.rooms.get(room)?.size || 0;
          io.to(room).emit("presence:update", { projectId: room.slice(8), count });
          if (socket.user) {
            leaveMember(room, String(socket.user.sub));
          }
        }
      }
    });
  });

  logger.info("[SOCKET] Socket.IO server initialized");
  return io;
}
