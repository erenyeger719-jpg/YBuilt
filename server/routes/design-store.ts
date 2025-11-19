// server/routes/design-store.ts
import { Router } from "express";
import type { Request, Response } from "express";
import {
  listAllPacksSummary,
  getAnyPack,
  addUserPack,
  DesignSlot,
  UiDesignPack,
} from "../design/design-store.ts";

const router = Router();

const ALLOWED_SLOTS: DesignSlot[] = [
  "hero",
  "navbar",
  "feature-grid",
  "pricing",
  "testimonials",
  "cta",
  "footer",
];

// --- GET /api/design-store/list ---
router.get("/list", (req: Request, res: Response) => {
  const slot =
    typeof req.query.slot === "string" && req.query.slot.length > 0
      ? (req.query.slot as DesignSlot)
      : undefined;
  const q =
    typeof req.query.q === "string" && req.query.q.length > 0
      ? req.query.q
      : undefined;

  let items = listAllPacksSummary();

  if (slot) {
    items = items.filter((item) => item.slot === slot);
  }

  if (q) {
    const terms = q
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (terms.length > 0) {
      items = items.filter((item) => {
        const haystack = (
          item.name +
          " " +
          item.description +
          " " +
          item.tags.join(" ")
        ).toLowerCase();
        return terms.some((term) => haystack.includes(term));
      });
    }
  }

  return res.json({ ok: true, items });
});

// --- GET /api/design-store/pack/:id ---
router.get("/pack/:id", (req: Request, res: Response) => {
  const id = String(req.params.id || "");
  const pack = getAnyPack(id);

  if (!pack) {
    return res.status(404).json({ ok: false, error: "not_found" });
  }

  return res.json({ ok: true, item: pack });
});

// --- POST /api/design-store/publish ---
// v1: dev-friendly endpoint to save user-created design packs.
router.post("/publish", (req: Request, res: Response) => {
  const body = (req.body || {}) as any;

  const rawSlot = body.slot as string | undefined;
  const slot = rawSlot as DesignSlot | undefined;

  if (!slot || !ALLOWED_SLOTS.includes(slot)) {
    return res.status(400).json({ ok: false, error: "invalid_slot" });
  }

  const name =
    typeof body.name === "string" && body.name.trim().length > 0
      ? body.name.trim()
      : "";
  if (!name) {
    return res.status(400).json({ ok: false, error: "missing_name" });
  }

  const description =
    typeof body.description === "string" &&
    body.description.trim().length > 0
      ? body.description.trim()
      : "";
  if (!description) {
    return res.status(400).json({ ok: false, error: "missing_description" });
  }

  const specPatch =
    body && typeof body.specPatch === "object" && body.specPatch !== null
      ? body.specPatch
      : null;
  if (!specPatch) {
    return res.status(400).json({ ok: false, error: "missing_specPatch" });
  }

  const previewUrl =
    typeof body.previewUrl === "string" && body.previewUrl.trim().length > 0
      ? body.previewUrl.trim()
      : "/static/design-packs/user-pack.png";

  const tags: string[] = Array.isArray(body.tags)
    ? body.tags
        .map((t: any) => String(t || "").trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];

  const contentFieldsRaw = Array.isArray(body?.contentSchema?.fields)
    ? body.contentSchema.fields
    : [];

  const contentFields = contentFieldsRaw
    .map((f: any) => {
      if (!f || typeof f !== "object") return null;

      const key =
        typeof f.key === "string" && f.key.trim().length > 0
          ? f.key.trim()
          : null;
      if (!key) return null;

      const type = f.type;
      if (
        type !== "string" &&
        type !== "richtext" &&
        type !== "image" &&
        type !== "list"
      ) {
        return null;
      }

      const label =
        typeof f.label === "string" && f.label.trim().length > 0
          ? f.label.trim()
          : key;

      return {
        key,
        label,
        type,
        required: Boolean(f.required),
        default: f.default,
      };
    })
    .filter(Boolean) as any[];

  const preferredPosition =
    body.preferredPosition === "top" ||
    body.preferredPosition === "bottom" ||
    body.preferredPosition === "replace"
      ? body.preferredPosition
      : undefined;

  // Ignore any pricing provided by the client for now; force "free".
  const pricing = { kind: "free" as const };

  const baseId =
    typeof body.id === "string" && body.id.trim().length > 0
      ? body.id.trim()
      : "";
  const generatedId = `user_${slot}_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  const id = baseId || generatedId;

  const author =
    typeof body.author === "string" && body.author.trim().length > 0
      ? body.author.trim()
      : "user";

  const pack: UiDesignPack = {
    id,
    name,
    author,
    slot,
    description,
    previewUrl,
    tags,
    specPatch,
    contentSchema: { fields: contentFields },
    pricing,
    preferredPosition,
    version:
      typeof body.version === "number" && Number.isFinite(body.version)
        ? body.version
        : 1,
  };

  try {
    addUserPack(pack);
  } catch (err: any) {
    return res
      .status(500)
      .json({
        ok: false,
        error: "save_failed",
        detail: err?.message || "",
      });
  }

  return res.status(201).json({ ok: true, item: pack });
});

export default router;
