// Pure ESM socket bus used by the server to emit build/deploy events.

let ioInstance = null;

export function setIO(io) {
  ioInstance = io;
}

export function room(roomId) {
  return ioInstance ? ioInstance.to(roomId) : null;
}

export function emitDeploy(jobId, payload) {
  if (!ioInstance) return;
  ioInstance.to(jobId).emit("deploy:event", payload);
}

export function stage(jobId, name, ts = Date.now()) {
  emitDeploy(jobId, { type: "stage", name, ts });
}

export function log(jobId, line, ts = Date.now()) {
  emitDeploy(jobId, { type: "log", line, ts });
}

export function done(jobId, ok, extra = {}) {
  emitDeploy(jobId, { type: "done", ok, ts: Date.now(), ...extra });
}
