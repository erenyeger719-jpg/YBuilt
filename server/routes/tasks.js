// server/routes/tasks.js
//
// Command palette + legacy tasks backend.
//
// Mounted in server/index.ts as:
//   app.use('/api/tasks', express.json(), tasksRouter);
//
// Routes:
//   GET  /api/tasks/list      → existing command list (uses COMMANDS)
//   POST /api/tasks/run       → existing runCommand path (+ optional git commit)
//   POST /api/tasks/command   → NEW normalized command-palette entrypoint
//
// We also export handlePaletteCommand(...) so tests can call it directly.

import express from "express";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { COMMANDS, runCommand } from "../tasks/commands.js";
import { logger } from "../middleware/logging.js";
import { authRequired } from "../middleware/auth.js";

const ex = promisify(execFile);
const router = express.Router();

// --- Legacy: list available commands -----------------------------

router.get("/list", (_req, res) => {
  res.json({ ok: true, commands: COMMANDS });
});

// --- Legacy: run a command (optionally commit the result) -------

async function tryGitCommit(message) {
  try {
    // Best-effort; harmless if not a git repo
    await ex("git", ["add", "-A"], { cwd: process.cwd() });
    await ex("git", ["commit", "-m", message], { cwd: process.cwd() });
    const { stdout } = await ex("git", ["rev-parse", "--short", "HEAD"], {
      cwd: process.cwd(),
    });
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
      const msg = `[palette] ${cmd}${
        params?.name ? `: ${params.name}` : ""
      }`;
      git = await tryGitCommit(msg);
    }

    res.json({ ok: true, cmd, result, git });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e?.message || e) });
  }
});

// --- NEW: normalized command-palette entrypoint -----------------

/**
 * Tiny helper to log palette command events.
 */
function logPaletteCommand(command, userId, workspaceId, status, extra) {
  const event = {
    type: "palette_command",
    command,
    userId: userId || null,
    workspaceId: workspaceId || null,
    status,
    ...(extra && typeof extra === "object" ? extra : {}),
  };

  try {
    logger.info("[palette_command]", event);
  } catch {
    // Never let logging kill the request.
    // eslint-disable-next-line no-console
    console.log("[palette_command]", event);
  }
}

/**
 * Core handler for command palette actions.
 *
 * @param {Object} input
 * @param {string} input.command
 * @param {any} [input.payload]
 * @param {any} [input.user]
 * @returns {Promise<{ statusCode: number, body: any }>}
 */
export async function handlePaletteCommand(input) {
  const rawCommand = input && input.command;
  const payload = (input && input.payload) || {};
  const user = (input && input.user) || null;

  // ---- basic validation ----
  if (typeof rawCommand !== "string" || rawCommand.trim().length === 0) {
    return {
      statusCode: 400,
      body: {
        ok: false,
        error: "bad_request",
      },
    };
  }

  const command = rawCommand.trim();

  // ---- auth gate (very simple) ----
  if (!user || (!user.id && !user.userId && !user.email)) {
    return {
      statusCode: 403,
      body: {
        ok: false,
        error: "forbidden",
      },
    };
  }

  const userId = user.id || user.userId || null;
  const workspaceId =
    typeof payload?.workspaceId === "string" ? payload.workspaceId : null;

  let status = "ok";

  try {
    // For now we keep this very small and safe. You can later
    // wire these cases into real runCommand/AI flows.
    switch (command) {
      case "ping": {
        const body = {
          ok: true,
          result: {
            message: "pong",
          },
        };
        logPaletteCommand(command, userId, workspaceId, status);
        return {
          statusCode: 200,
          body,
        };
      }

      case "scaffold_component":
      case "create_file": {
        // Stub: acknowledge that we received the command. No file writes yet.
        const body = {
          ok: true,
          result: {
            accepted: true,
            command,
            workspaceId,
          },
        };
        logPaletteCommand(command, userId, workspaceId, status);
        return {
          statusCode: 200,
          body,
        };
      }

      default: {
        status = "error";
        logPaletteCommand(command, userId, workspaceId, status, {
          reason: "unknown_command",
        });
        return {
          statusCode: 400,
          body: {
            ok: false,
            error: "unknown_command",
          },
        };
      }
    }
  } catch (err) {
    status = "error";
    logger.error("[palette_command] internal_error", {
      command,
      userId,
      workspaceId,
      error: err?.message || String(err),
    });
    return {
      statusCode: 500,
      body: {
        ok: false,
        error: "internal_error",
      },
    };
  }
}

// HTTP wrapper: POST /api/tasks/command
router.post("/command", authRequired, async (req, res) => {
  try {
    const body = (req && req.body) || {};
    const command = body?.command;
    const payload = body?.payload;
    const user = (req && req.user) || null;

    const result = await handlePaletteCommand({ command, payload, user });
    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    logger.error("[tasks.router] /command failed", {
      error: err?.message || String(err),
    });
    return res.status(500).json({
      ok: false,
      error: "internal_error",
    });
  }
});

export default router;
