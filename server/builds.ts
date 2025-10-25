import type { Server } from "socket.io";

type JobStatus = "queued" | "running" | "done" | "error";
type ProgressEvt = { jobId: string; step: number; total: number; pct: number; label: string };

const JOBS = new Map<string, { id: string; status: JobStatus; log: string[]; pct: number }>();
let ioRef: Server | null = null;

export function wireBuildsNamespace(io: Server) {
  ioRef = io;
  const nsp = io.of("/builds");
  nsp.on("connection", (socket) => {
    socket.on("watch", ({ jobId }) => {
      const id = String(jobId || "");
      if (!id) return;
      socket.join(room(id));

      // Immediately send the latest known state so late joiners see something
      const job = JOBS.get(id);
      if (job) {
        const total = 5; // our fake pipeline has 5 steps
        const step = Math.max(1, Math.min(total, Math.round((job.pct / 100) * total)));
        const snapshot = {
          jobId: id,
          step,
          total,
          pct: job.pct,
          label: job.log[job.log.length - 1] || "Initialize",
        };
        socket.emit("build:progress", snapshot);
        if (job.status === "done") {
          socket.emit("build:done", { jobId: id, url: `/previews/forks/<slug>/` });
        }
        if (job.status === "error") {
          socket.emit("build:error", { jobId: id, message: "failed" });
        }
      }
    });
  });
}

export function createBuildJob(): string {
  const id = Math.random().toString(36).slice(2, 10);
  JOBS.set(id, { id, status: "queued", log: [], pct: 0 });
  return id;
}

export function getJob(jobId: string) {
  return JOBS.get(jobId) || null;
}

function room(jobId: string) {
  return `job:${jobId}`;
}

function emit(jobId: string, evt: "build:progress" | "build:done" | "build:error", payload: any) {
  if (!ioRef) return;
  ioRef.of("/builds").to(room(jobId)).emit(evt, payload);
}

// Fake pipeline (swap for real build later)
export async function runFakeBuild(jobId: string, slug: string) {
  const job = JOBS.get(jobId);
  if (!job) return;
  job.status = "running";

  const steps = ["Initialize", "Install deps", "Build", "Upload preview", "Finalize"];

  for (let i = 0; i < steps.length; i++) {
    await sleep(600 + Math.random() * 600);
    const pct = Math.round(((i + 1) / steps.length) * 100);
    job.pct = pct;
    job.log.push(steps[i]);
    const evt: ProgressEvt = { jobId, step: i + 1, total: steps.length, pct, label: steps[i] };
    emit(jobId, "build:progress", evt);
  }

  job.status = "done";
  emit(jobId, "build:done", { jobId, url: `/previews/forks/${slug}/` });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
