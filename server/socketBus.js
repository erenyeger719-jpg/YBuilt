// server/socketBus.js
let ioRef = null;

function room(jobId) {
  return `deploy:${jobId}`;
}

function emitDeploy(jobId, payload) {
  if (!ioRef) return;
  ioRef.to(room(jobId)).emit("deploy:event", { jobId, ts: Date.now(), ...payload });
}

function setIO(io) {
  ioRef = io;

  // Wire deploy rooms + chat on connection
  io.on("connection", (socket) => {
    // Join a deploy room
    socket.on("deploy:join", (p = {}) => {
      const id = p.jobId || p.id || p.room;
      if (!id) return;
      const target = String(id).startsWith("deploy:") ? String(id) : room(String(id));
      socket.join(target);
    });

    // Leave a deploy room
    socket.on("deploy:leave", (p = {}) => {
      const id = p.jobId || p.id || p.room;
      if (!id) return;
      const target = String(id).startsWith("deploy:") ? String(id) : room(String(id));
      socket.leave(target);
    });

    // Simple chat relay within a deploy room (unified deploy:event)
    socket.on("deploy:chat", (p = {}) => {
      const id = p.jobId || p.room;
      const text = String(p.text || "").trim();
      if (!id || !text) return;

      const target = String(id).startsWith("deploy:") ? String(id) : room(String(id));
      const msg = {
        type: "chat",
        text,
        user: p.user || "anon",
        ts: Date.now(),
      };
      io.to(target).emit("deploy:event", msg);
    });
  });
}

// tiny helpers
const stage = (jobId, stage) => emitDeploy(jobId, { type: "stage", stage });
const log = (jobId, line) => emitDeploy(jobId, { type: "log", line });
const done = (jobId, data) => emitDeploy(jobId, { type: "done", ...data });

module.exports = { setIO, emitDeploy, stage, log, done, room };
