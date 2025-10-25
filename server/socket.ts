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

  // ---- Pinned messages (ephemeral + optional persisted metadata) ----
  const pinnedByProject: Map<string, Set<string>> = new Map();

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

  // ---- Attachment limits/helpers (byte-approx for Data URLs) ----
  function approxBytesFromDataUrl(u: string) {
    const i = u.indexOf(",");
    if (i === -1) return 0;
    const b64 = u.slice(i + 1);
    const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
    return Math.floor((b64.length * 3) / 4) - pad;
  }

  const ATT_MAX_FILES = 3;
  const ATT_MAX_BYTES = 2_000_000; // ~2MB per file
  const ATT_TOTAL_BYTES = 4_000_000; // ~4MB total across attachments

  // ---- Basic content guard (very small) ----
  const bannedPatterns: RegExp[] = [
    /\b(?:fuck|shit)\b/i,
    /\b(?:slur1|slur2)\b/i, // replace with actual terms to guard against, or remove
  ];
  function violates(text: string) {
    return bannedPatterns.some((rx) => rx.test(text));
  }

  // ---- File presence (who's viewing a given file) ----
  type MemberInfo = { email: string; count: number };
  const fileMembers: Map<string, Map<string, MemberInfo>> = new Map();

  function fileRoomKey(projectId: string, filePath: string) {
    return `file:${projectId}:${filePath}`;
  }
  function emitFilePresence(room: string, projectId: string, filePath: string) {
    const members = Array.from(fileMembers.get(room)?.entries() || []).map(
      ([userId, v]) => ({
        userId,
        username: v.email,
      })
    );
    io.to(room).emit("file:presence", { projectId, filePath, users: members });
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
            const pinnedSet = pinnedByProject.get(data.projectId) || new Set<string>();
            const pinnedFlag = pinnedSet.has(String(r.id)) || !!m.pinned;

            // Hide content when deleted
            const contentOut = deletedFlag ? "" : r.content;

            return {
              id: r.id,
              userId: r.userId,
              username: r.metadata?.username || r.userEmail || r.userId,
              role: r.role,
              content: contentOut,
              createdAt: r.createdAt,
              reactions: getCountsFor(String(r.id)),
              editedAt: editedIso,
              deleted: deletedFlag,
              pinned: pinnedFlag,
              // Do not leak attachments for deleted messages
              attachments: deletedFlag
                ? []
                : Array.isArray(r.metadata?.attachments)
                ? r.metadata.attachments
                : [],
            };
          });

          // Seed in-memory pins for this project from metadata
          let set = pinnedByProject.get(data.projectId);
          if (!set) pinnedByProject.set(data.projectId, (set = new Set<string>()));
          for (const r of rows) {
            if (r?.metadata?.pinned) set.add(String(r.id));
          }

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

    // Handle chat messages - Collaboration mode (now supports attachments)
    socket.on(
      "chat:collaboration",
      async (data: {
        projectId: string;
        message: string;
        attachments?: { name: string; type: string; size: number; dataUrl: string }[];
      }) => {
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

          // sanitize attachments (v1 limits, byte-approx)
          const att = Array.isArray(data.attachments) ? data.attachments : [];
          let total = 0;
          const safeAtt: { name: string; type: string; size: number; dataUrl: string }[] = [];

          for (const a of att.slice(0, ATT_MAX_FILES)) {
            if (
              !a ||
              typeof a.name !== "string" ||
              typeof a.type !== "string" ||
              typeof a.size !== "number" ||
              typeof a.dataUrl !== "string" ||
              !a.dataUrl.startsWith("data:")
            )
              continue;

            const est = approxBytesFromDataUrl(a.dataUrl);
            if (est > ATT_MAX_BYTES) continue;
            if (total + est > ATT_TOTAL_BYTES) break;

            total += est;
            safeAtt.push(a);
          }

          // Save message
          const chatMessage = await storage.createChatMessage({
            userId: socket.user.sub.toString(),
            projectId: data.projectId,
            role: "user",
            content: data.message,
            metadata: {
              type: "collaboration",
              username: socket.user.email,
              attachments: safeAtt,
            },
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
            attachments: safeAtt,
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
                // normalize handle: john+staff -> john-staff
                const handle = (email || "")
                  .split("@")[0]
                  .replace(/[^a-z0-9_-]/gi, "-")
                  .toLowerCase();

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

    // ---- File presence (join/leave) ----
    socket.on("file:join", (data: { projectId?: string; filePath?: string }) => {
      try {
        const { projectId, filePath } = data || {};
        if (!projectId || !filePath) return;
        const room = fileRoomKey(projectId, filePath);
        socket.join(room);

        let m = fileMembers.get(room);
        if (!m) fileMembers.set(room, (m = new Map()));
        const uid = String(socket.user?.sub || socket.id);
        const email = socket.user?.email || "anon";
        const cur = m.get(uid);
        m.set(uid, { email, count: (cur?.count || 0) + 1 });

        emitFilePresence(room, projectId, filePath);
      } catch {}
    });

    socket.on("file:leave", (data: { projectId?: string; filePath?: string }) => {
      try {
        const { projectId, filePath } = data || {};
        if (!projectId || !filePath) return;
        const room = fileRoomKey(projectId, filePath);
        socket.leave(room);

        const m = fileMembers.get(room);
        if (m) {
          const uid = String(socket.user?.sub || socket.id);
          const cur = m.get(uid);
          if (cur) {
            if (cur.count <= 1) m.delete(uid);
            else m.set(uid, { ...cur, count: cur.count - 1 });
          }
        }
        emitFilePresence(room, projectId, filePath);
      } catch {}
    });

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

          // Strict: must have createdAt to enforce window
          if (!createdAt) {
            socket.emit("error", { message: "Cannot verify edit window" });
            return;
          }

          if (!ownerId || String(ownerId) !== String(socket.user.sub)) {
            socket.emit("error", { message: "Only the author can edit" });
            return;
          }

          // 10-minute window
          const now = Date.now();
          if (now - createdAt > 10 * 60 * 1000) {
            socket.emit("error", { message: "Edit window expired" });
            return;
          }

          // Persist if possible (merge metadata to avoid clobbering)
          if (typeof (storage as any).updateChatMessage === "function") {
            const oldMeta =
              (typeof (storage as any).getChatMessageById === "function" &&
                (await (storage as any).getChatMessageById(messageId))?.metadata) ||
              {};
            await (storage as any).updateChatMessage({
              id: messageId,
              content,
              metadata: { ...(oldMeta || {}), editedAt: new Date().toISOString() },
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

          // Strict: must have createdAt to enforce window
          if (!createdAt) {
            socket.emit("error", { message: "Cannot verify edit window" });
            return;
          }

          if (!ownerId || String(ownerId) !== String(socket.user.sub)) {
            socket.emit("error", { message: "Only the author can delete" });
            return;
          }

          // 10-minute window
          const now = Date.now();
          if (now - createdAt > 10 * 60 * 1000) {
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

          // If it was pinned, unpin locally and broadcast
          const set = pinnedByProject.get(projectId);
          if (set && set.delete(String(messageId))) {
            io.to(`project:${projectId}`).emit("chat:pin:update", {
              id: messageId,
              projectId,
              pinned: false,
              by: socket.user?.email,
              at: new Date().toISOString(),
            });
          }

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

    // ---- Pin / Unpin a message (any authenticated member) ----
    socket.on(
      "chat:pin",
      async (data: { projectId: string; messageId: string; op: "pin" | "unpin" }) => {
        try {
          if (!socket.user) {
            socket.emit("error", { message: "Auth required" });
            return;
          }
          const { projectId, messageId, op } = data || {};
          if (!projectId || !messageId) return;

          // Optional: verify message belongs to project (when storage exists)
          if (typeof (storage as any).getChatMessageById === "function") {
            const row = await (storage as any).getChatMessageById(messageId);
            if (!row || row.projectId !== projectId) {
              socket.emit("error", { message: "Message not found" });
              return;
            }
          }

          // Update ephemeral set
          let set = pinnedByProject.get(projectId);
          if (!set) pinnedByProject.set(projectId, (set = new Set<string>()));
          if (op === "pin") set.add(String(messageId));
          else set.delete(String(messageId));

          // Persist (merge metadata to avoid clobbering)
          if (typeof (storage as any).updateChatMessage === "function") {
            let oldMeta: any = {};
            if (typeof (storage as any).getChatMessageById === "function") {
              const row = await (storage as any).getChatMessageById(messageId);
              oldMeta = (row && row.metadata) || {};
            }
            await (storage as any).updateChatMessage({
              id: messageId,
              metadata: { ...(oldMeta || {}), pinned: op === "pin" },
            });
          }

          io.to(`project:${projectId}`).emit("chat:pin:update", {
            id: messageId,
            projectId,
            pinned: op === "unpin" ? false : true,
            by: socket.user.email,
            at: new Date().toISOString(),
          });
        } catch (e) {
          logger.error({ e }, "[CHAT:PIN] Error");
          socket.emit("error", { message: "Failed to update pin" });
        }
      }
    );

    // ---- Comments (file/line threads) ----
    socket.on("comment:list", async (data: { projectId: string; filePath?: string }) => {
      try {
        const { projectId, filePath } = data || {};
        if (!projectId) return;

        if (typeof (storage as any).listChatMessages !== "function") {
          socket.emit("comment:list", { projectId, comments: [] });
          return;
        }

        const rows = await (storage as any).listChatMessages({
          projectId,
          limit: 500,
          order: "desc",
        });

        const comments = rows
          .filter((r: any) => r?.metadata?.type === "comment")
          .filter((r: any) => !filePath || r?.metadata?.filePath === filePath)
          .reverse()
          .map((r: any) => ({
            id: r.id,
            userId: r.userId,
            username: r.metadata?.username || r.userEmail || r.userId,
            content: r.content,
            createdAt: r.createdAt,
            filePath: r.metadata?.filePath || "",
            line: r.metadata?.line || null,
            threadId: r.metadata?.threadId || String(r.id),
            parentId: r.metadata?.parentId || null,
            resolved: !!r.metadata?.resolved,
          }));

        socket.emit("comment:list", { projectId, comments });
      } catch (e) {
        logger.error({ e }, "[COMMENT:LIST] failed");
      }
    });

    socket.on("comment:create", async (data: {
      projectId: string;
      filePath: string;
      line?: number | null;
      content: string;
      threadId?: string | null;
      parentId?: string | null;
    }) => {
      try {
        if (!socket.user) {
          socket.emit("error", { message: "Auth required" });
          return;
        }
        const { projectId, filePath, line = null, content, threadId = null, parentId = null } = data || {};
        if (!projectId || !filePath || !content) return;

        const created = await storage.createChatMessage({
          userId: socket.user.sub.toString(),
          projectId,
          role: "comment",
          content,
          metadata: {
            type: "comment",
            username: socket.user.email,
            filePath,
            line,
            threadId: threadId || undefined,
            parentId: parentId || undefined,
            resolved: false,
          },
        });

        const payload = {
          id: created.id,
          userId: socket.user.sub,
          username: socket.user.email,
          content: created.content,
          createdAt: created.createdAt,
          filePath,
          line,
          threadId: threadId || String(created.id),
          parentId: parentId || null,
          resolved: false,
        };

        io.to(`project:${projectId}`).emit("comment:create", { projectId, comment: payload });
      } catch (e) {
        logger.error({ e }, "[COMMENT:CREATE] failed");
        socket.emit("error", { message: "Failed to create comment" });
      }
    });

    socket.on("comment:update", async (data: {
      projectId: string; commentId: string; content: string;
    }) => {
      try {
        if (!socket.user) return;
        const { projectId, commentId, content } = data || {};
        if (!projectId || !commentId || !content) return;

        if (typeof (storage as any).getChatMessageById === "function") {
          const row = await (storage as any).getChatMessageById(commentId);
          if (!row || row.projectId !== projectId || String(row.userId) !== String(socket.user.sub)) {
            socket.emit("error", { message: "Not allowed" });
            return;
          }
        }
        if (typeof (storage as any).updateChatMessage === "function") {
          await (storage as any).updateChatMessage({ id: commentId, content });
        }
        io.to(`project:${projectId}`).emit("comment:update", {
          projectId, id: commentId, content,
        });
      } catch (e) {
        logger.error({ e }, "[COMMENT:UPDATE] failed");
      }
    });

    socket.on("comment:resolve", async (data: {
      projectId: string; threadId: string; resolved: boolean;
    }) => {
      try {
        if (!socket.user) return;
        const { projectId, threadId, resolved } = data || {};
        if (!projectId || !threadId) return;

        if (typeof (storage as any).updateCommentsByThreadId === "function") {
          await (storage as any).updateCommentsByThreadId(projectId, threadId, { resolved });
        } else if (typeof (storage as any).updateChatMessage === "function" &&
                   typeof (storage as any).listChatMessages === "function") {
          const rows = await (storage as any).listChatMessages({ projectId, limit: 500, order: "desc" });
          for (const r of rows) {
            if (r?.metadata?.type === "comment" && (r?.metadata?.threadId === threadId || String(r.id) === threadId)) {
              await (storage as any).updateChatMessage({
                id: r.id,
                metadata: { ...(r.metadata || {}), resolved },
              });
            }
          }
        }

        io.to(`project:${projectId}`).emit("comment:resolve", { projectId, threadId, resolved });
      } catch (e) {
        logger.error({ e }, "[COMMENT:RESOLVE] failed");
      }
    });

    socket.on("comment:delete", async (data: { projectId: string; commentId: string }) => {
      try {
        if (!socket.user) return;
        const { projectId, commentId } = data || {};
        if (!projectId || !commentId) return;

        if (typeof (storage as any).getChatMessageById === "function") {
          const row = await (storage as any).getChatMessageById(commentId);
          if (!row || row.projectId !== projectId || String(row.userId) !== String(socket.user.sub)) {
            socket.emit("error", { message: "Not allowed" });
            return;
          }
        }
        if (typeof (storage as any).softDeleteChatMessage === "function") {
          await (storage as any).softDeleteChatMessage({
            id: commentId, metadata: { deleted: true, deletedAt: new Date().toISOString() },
          });
        }
        io.to(`project:${projectId}`).emit("comment:delete", { projectId, id: commentId });
      } catch (e) {
        logger.error({ e }, "[COMMENT:DELETE] failed");
      }
    });

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
        if (room.startsWith("project:")) {
          const size = io.sockets.adapter.rooms.get(room)?.size || 1;
          const next = Math.max(0, size - 1);
          io.to(room).emit("presence:update", { projectId: room.slice(8), count: next });
          if (socket.user) leaveMember(room, String(socket.user.sub));
        } else if (room.startsWith("file:")) {
          const parts = room.split(":"); // ["file", projectId, ...filePathParts]
          const projId = parts[1];
          const filePath = parts.slice(2).join(":");
          const m = fileMembers.get(room);
          if (m) {
            const uid = String(socket.user?.sub || socket.id);
            const cur = m.get(uid);
            if (cur) {
              if (cur.count <= 1) m.delete(uid);
              else m.set(uid, { ...cur, count: cur.count - 1 });
            }
          }
          emitFilePresence(room, projId, filePath);
        }
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
