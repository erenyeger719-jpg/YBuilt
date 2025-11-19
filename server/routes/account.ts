// server/routes/account.ts
import { Router } from "express";
import type { Request, Response } from "express";
import Database from "better-sqlite3";
import { authRequired } from "../middleware/auth.ts";

const DB_PATH = process.env.DB_PATH || "./data/app.db";

// Single shared SQLite connection for this router.
const db = new Database(DB_PATH);

// Be a bit safer for concurrent writes.
try {
  db.pragma("journal_mode = WAL");
} catch {
  // ignore if pragma fails; not critical
}

type AnyRequest = Request & {
  user?: { id?: string | number; userId?: string | number };
  auth?: { id?: string | number; userId?: string | number };
  userId?: string | number;
};

function resolveUserId(req: AnyRequest): string | null {
  // Dev-only override for tests:
  // In dev (NODE_ENV !== "production"), you can send x-debug-user-id.
  const debugId = req.header("x-debug-user-id");
  if (debugId && process.env.NODE_ENV !== "production") {
    return String(debugId);
  }

  const anyReq = req as AnyRequest;
  const id =
    anyReq.user?.id ??
    anyReq.user?.userId ??
    anyReq.auth?.id ??
    anyReq.auth?.userId ??
    anyReq.userId;

  if (id == null) return null;
  return String(id);
}

function anonymiseUser(userId: string): number {
  const stmt = db.prepare(
    `
      UPDATE users
      SET
        email = 'deleted-' || id || '@example.invalid',
        name = 'Deleted user'
      WHERE id = ?
    `
  );
  const info = stmt.run(userId);
  return info.changes || 0;
}

const router = Router();

/**
 * DELETE /api/account
 *
 * - In production:
 *     Uses authRequired and the authenticated user id.
 * - In dev/test:
 *     You can send x-debug-user-id to target a specific user id
 *     (only when NODE_ENV !== "production").
 */
router.delete("/", authRequired, (req: AnyRequest, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) {
    return res.status(401).json({
      ok: false,
      error: "unauthorized",
    });
  }

  try {
    const changes = anonymiseUser(userId);

    if (changes === 0) {
      return res.status(404).json({
        ok: false,
        error: "user_not_found",
      });
    }

    return res.json({
      ok: true,
      deleted: true,
      userId,
    });
  } catch (err: any) {
    console.error("[account.delete] error deleting user", {
      userId,
      error: err?.message || String(err),
    });
    return res.status(500).json({
      ok: false,
      error: "account_delete_failed",
    });
  }
});

export default router;
