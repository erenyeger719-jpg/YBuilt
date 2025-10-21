// server/routes/tasks.js
import express from "express";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { COMMANDS, runCommand } from "../tasks/commands.js";

const ex = promisify(execFile);
const router = express.Router();

router.get("/list", (_req, res) => {
  res.json({ ok: true, commands: COMMANDS });
});

async function tryGitCommit(message) {
  try {
    // Best-effort; harmless if not a git repo
    await ex("git", ["add", "-A"], { cwd: process.cwd() });
    await ex("git", ["commit", "-m", message], { cwd: process.cwd() });
    const { stdout } = await ex("git", ["rev-parse", "--short", "HEAD"], { cwd: process.cwd() });
    return { committed: true, sha: stdout.trim() };
  } catch {
    return { committed: false };
  }
}

router.post("/run", async (req, res) => {
  try {
    const { cmd, params, commit } = req.body || {};
    if (!cmd) return res.status(400).json({ error: "cmd required" });

    const result = runCommand({ cmd, params });

    let git = { committed: false };
    if (commit) {
      const msg = `[palette] ${cmd}${params?.name ? `: ${params.name}` : ""}`;
      git = await tryGitCommit(msg);
    }

    res.json({ ok: true, cmd, result, git });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e?.message || e) });
  }
});

export default router;
