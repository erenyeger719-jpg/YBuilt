// server/socket.ts
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

  // ---- Reactions (ephemeral) ----
  // messageId -> emoji -> count
  const reactCounts: Map<string, Map<string, number>> = new Map();
  function getCountsFor(messageId: string): Record<string, number> {
    const m = reactCounts.get(messageId);
    return m ? Object.fromEntries(m.entries()) : {};
  }

  // ---- Message flags (edited/deleted), ephemeral fallback ----
  const messageFlags: Map<string, { editedAt?: number; deleted?: boolean }> = new Map();
  // Track authors for ownership checks when storage can't fetch a row
  const messageAuthors: Map<string, string> = new Map();
  // Track creation timestamps for fallback window checks
  const messageCreatedAt: Map<string, number> = new Map();

  // ---- Simple per-user rate limit (5 msgs / 10s per project) ----
  const rateBuckets: Map<string, number[]> = new Map();
  const RATE_MAX = 5;
  const RATE_WINDOW_MS = 10 * 1000;

  function hitRate(key: string) {
    const now = Date.now();
    const arr = rateBuckets.get(key) || [];
    const fresh = arr.filter((ts) => now - ts < RATE_WINDOW_MS);
    fresh.push(now);
    rateBuckets.set(key, fresh);
    return fresh.length <= RATE_MAX;
  }

  // ---- Basic content guard (very small) ----
  const bannedPatterns: RegExp[] = [
    /\b(?:fuck|shit)\b/i,
    /\b(?:slur1|slur2)\b/i, // replace with actual terms to guard against, or remove
  ];
  function violates(text: string) {
    return bannedPatterns.some((rx) => rx.test(text));
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

    // ---- Project Chat: history fetch (last N messages) ----
    socket.on("chat:history", async (data: { projectId: string; limit?: number }) => {
      try {
        const limit = Math.min(Math.max(data?.limit ?? 50, 1), 200);
        if (!data?.projectId) return;

        if (typeof (storage as any).listChatMessages === "function") {
          const rows = await (storage as any).listChatMessages({
            projectId: data.projectId,
            limit,
            order: "desc",
          });
          const msgs = rows.reverse().map((r: any) => {
            const flags = messageFlags.get(String(r.id)) || {};
            const m = r.metadata || {};
            const editedIso = flags.editedAt
              ? new Date(flags.editedAt).toISOString()
              : m.editedAt
              ? new Date(m.editedAt).toISOString()
              : undefined;
            const deletedFlag = flags.deleted ?? !!m.deleted;

            return {
              id: r.id,
              userId: r.userId,
              username: r.metadata?.username || r.userEmail || r.userId,
              role: r.role,
              content: r.content,
              createdAt: r.createdAt,
              reactions: getCountsFor(String(r.id)),
              editedAt: editedIso,
              deleted: deletedFlag,
            };
          });
          socket.emit("chat:history", { projectId: data.projectId, msgs });
        } else {
          socket.emit("chat:history", { projectId: data.projectId, msgs: [] });
        }
      } catch (e) {
        logger.error({ e }, "[CHAT:HISTORY] failed");
      }
    });

    // Handle chat messages - AI Assistant mode
    socket.on(
      "chat:ai-assistant",
      async (data: { projectId?: string; message: string }) => {
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
      async (data: { projectId: string; message: string }) => {
        try {
          if (!socket.user) {
            socket.emit("error", { message: "Authentication required for collaboration" });
            return;
          }

          // Rate limit + content guard
          const key = `${data.projectId}:${socket.user.sub}`;
          if (!hitRate(key)) {
            socket.emit("error", {
              message: "You’re sending messages too quickly. Please slow down.",
            });
            return;
          }
          if (violates(data.message || "")) {
            socket.emit("error", { message: "Message blocked by content policy." });
            return;
          }

          // Save message
          const chatMessage = await storage.createChatMessage({
            userId: socket.user.sub.toString(),
            projectId: data.projectId,
            role: "user",
            content: data.message,
            metadata: { type: "collaboration", username: socket.user.email }, // store username for history
          });

          // Remember author + createdAt for fallback ownership/window checks
          messageAuthors.set(String(chatMessage.id), String(socket.user.sub));
          messageCreatedAt.set(
            String(chatMessage.id),
            new Date(chatMessage.createdAt).getTime()
          );

          // Broadcast to all users in the project room
          io.to(`project:${data.projectId}`).emit("chat:message", {
            id: chatMessage.id,
            userId: socket.user.sub,
            username: socket.user.email,
            role: "user",
            content: chatMessage.content,
            createdAt: chatMessage.createdAt,
          });

          // ---- mention pings (@all or @username) ----
          try {
            const rawMentions = (data.message.match(/\B@[\w-]+/g) || []).map((s) =>
              s.slice(1).toLowerCase()
            );
            if (rawMentions.length) {
              const mentioned = new Set(rawMentions);
              const room = `project:${data.projectId}`;
              const members =
                roomMembers.get(room) ||
                new Map<string, { email: string; count: number }>();

              for (const [uid, { email }] of members.entries()) {
                const handle = (email || "").split("@")[0].toLowerCase();

                if (mentioned.has("all") || mentioned.has(handle)) {
                  io.to(`user:${uid}`).emit("chat:mention", {
                    projectId: data.projectId,
                    from: socket.user!.email,
                    content: data.message,
                    at: Date.now(),
                  });
                }
              }
            }
          } catch {}

          logger.info(
            `[CHAT:COLLAB] User ${socket.user.sub} sent message to project ${data.projectId}`
          );
        } catch (error) {
          logger.error({ error }, "[CHAT:COLLAB] Error");
          socket.emit("error", { message: "Failed to send collaboration message" });
        }
      }
    );

    // ---- Edit message (10-min window, owner only) ----
    socket.on(
      "chat:message:update",
      async (data: { projectId: string; messageId: string; content: string }) => {
        try {
          if (!socket.user) {
            socket.emit("error", { message: "Auth required" });
            return;
          }
          const { projectId, messageId, content } = data || {};
          if (!projectId || !messageId || typeof content !== "string") return;

          // Try to verify ownership from storage first; fall back to in-memory map
          let ownerId: string | null = null;
          let createdAt: number | null = null;

          if (typeof (storage as any).getChatMessageById === "function") {
            const row = await (storage as any).getChatMessageById(messageId);
            if (!row || row.projectId !== projectId) {
              socket.emit("error", { message: "Message not found" });
              return;
            }
            ownerId = String(row.userId);
            createdAt = new Date(row.createdAt).getTime();
          } else {
            ownerId = messageAuthors.get(String(messageId)) || null;
          }

          // Fallback createdAt if storage unavailable
          if (!createdAt) createdAt = messageCreatedAt.get(String(messageId)) ?? null;

          if (!ownerId || String(ownerId) !== String(socket.user.sub)) {
            socket.emit("error", { message: "Only the author can edit" });
            return;
          }

          // 10-minute window
          const now = Date.now();
          if (createdAt && now - createdAt > 10 * 60 * 1000) {
            socket.emit("error", { message: "Edit window expired" });
            return;
          }

          // Persist if possible
          if (typeof (storage as any).updateChatMessage === "function") {
            await (storage as any).updateChatMessage({
              id: messageId,
              content,
              metadata: { editedAt: new Date().toISOString() },
            });
          }

          // Ephemeral flag (works even if storage lacks metadata)
          messageFlags.set(String(messageId), {
            ...(messageFlags.get(String(messageId)) || {}),
            editedAt: now,
          });

          io.to(`project:${projectId}`).emit("chat:message:update", {
            id: messageId,
            projectId,
            content,
            editedAt: new Date(now).toISOString(),
          });
        } catch (e) {
          logger.error({ e }, "[CHAT:EDIT] Error");
          socket.emit("error", { message: "Failed to edit message" });
        }
      }
    );

    // ---- Delete (soft) message (10-min window, owner only) ----
    socket.on(
      "chat:message:delete",
      async (data: { projectId: string; messageId: string }) => {
        try {
          if (!socket.user) {
            socket.emit("error", { message: "Auth required" });
            return;
          }
          const { projectId, messageId } = data || {};
          if (!projectId || !messageId) return;

          let ownerId: string | null = null;
          let createdAt: number | null = null;

          if (typeof (storage as any).getChatMessageById === "function") {
            const row = await (storage as any).getChatMessageById(messageId);
            if (!row || row.projectId !== projectId) {
              socket.emit("error", { message: "Message not found" });
              return;
            }
            ownerId = String(row.userId);
            createdAt = new Date(row.createdAt).getTime();
          } else {
            ownerId = messageAuthors.get(String(messageId)) || null;
          }

          // Fallback createdAt if storage unavailable
          if (!createdAt) createdAt = messageCreatedAt.get(String(messageId)) ?? null;

          if (!ownerId || String(ownerId) !== String(socket.user.sub)) {
            socket.emit("error", { message: "Only the author can delete" });
            return;
          }

          // 10-minute window
          const now = Date.now();
          if (createdAt && now - createdAt > 10 * 60 * 1000) {
            socket.emit("error", { message: "Delete window expired" });
            return;
          }

          // Persist if possible (soft-delete)
          if (typeof (storage as any).softDeleteChatMessage === "function") {
            await (storage as any).softDeleteChatMessage({
              id: messageId,
              metadata: {
                deleted: true,
                deletedAt: new Date().toISOString(),
                deletedBy: socket.user.email,
              },
            });
          }

          // Ephemeral flag
          messageFlags.set(String(messageId), {
            ...(messageFlags.get(String(messageId)) || {}),
            deleted: true,
          });

          io.to(`project:${projectId}`).emit("chat:message:delete", {
            id: messageId,
            projectId,
            deletedAt: new Date(now).toISOString(),
          });
        } catch (e) {
          logger.error({ e }, "[CHAT:DELETE] Error");
          socket.emit("error", { message: "Failed to delete message" });
        }
      }
    );

    // Handle chat messages - Support mode
    socket.on(
      "chat:support",
      async (data: { message: string; ticketId?: string }) => {
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

    // ---- Deploy log/chat rooms ----
    socket.on("deploy:join", ({ jobId }: { jobId?: string }) => {
      if (jobId) socket.join(jobId);
    });

    socket.on("deploy:leave", ({ jobId }: { jobId?: string }) => {
      if (jobId) socket.leave(jobId);
    });

    socket.on(
      "deploy:chat",
      ({ jobId, text, user }: { jobId?: string; text?: string; user?: string }) => {
        if (!jobId || !text) return;
        const payload = {
          type: "chat" as const,
          user: user || socket.user?.email || "anon",
          text: String(text),
          ts: Date.now(),
        };
        io.to(jobId).emit("deploy:event", payload);
      }
    );

    // ---- Reactions: add/remove and broadcast counts ----
    socket.on(
      "chat:react",
      (data: {
        projectId: string;
        messageId: string;
        emoji: string;
        op: "add" | "remove";
      }) => {
        try {
          if (!data?.projectId || !data?.messageId || !data?.emoji) return;
          let perMsg = reactCounts.get(data.messageId);
          if (!perMsg) reactCounts.set(data.messageId, (perMsg = new Map()));
          const cur = perMsg.get(data.emoji) || 0;
          const next = Math.max(0, cur + (data.op === "remove" ? -1 : 1));
          perMsg.set(data.emoji, next);

          io.to(`project:${data.projectId}`).emit("chat:react:update", {
            messageId: data.messageId,
            counts: getCountsFor(data.messageId),
          });
        } catch {}
      }
    );

    // Presence: update counts/members before socket actually leaves rooms
    socket.on("disconnecting", () => {
      for (const room of socket.rooms) {
        if (!room.startsWith("project:")) continue;
        const size = io.sockets.adapter.rooms.get(room)?.size || 1;
        const next = Math.max(0, size - 1);
        io.to(room).emit("presence:update", { projectId: room.slice(8), count: next });
        if (socket.user) leaveMember(room, String(socket.user.sub));
      }
    });

    // Disconnect handler (log only)
    socket.on("disconnect", () => {
      logger.info(`[SOCKET] Client disconnected: ${socket.id}`);
    });
  });

  logger.info("[SOCKET] Socket.IO server initialized");
  return io;
}
