// client/src/pages/design-store-logic.ts
import type { Spec } from "./types-and-helpers";
import type { UiDesignPack } from "@/lib/design-store";
import { getDesignStorePack } from "@/lib/design-store";

export type AutoLogRole = "you" | "pilot";

export type SayFn = (text: string) => void;
export type AutoLogFn = (role: AutoLogRole, text: string) => void;

type ApplyDeps = {
  getBaseSpec: () => Spec | null | undefined;
  recomposeGuarded: (next: Spec) => Promise<boolean>;
  pushAutoLog?: AutoLogFn;
  say?: SayFn;
};

type DesignPackContentField = {
  key?: string;
  label?: string;
  path?: string;
  type?: string;
  textarea?: boolean;
};

type DesignPackContentSchema = {
  fields?: DesignPackContentField[];
};

type RawDesignPack = {
  id?: string;
  name?: string;
  slot?: string;
  description?: string;
  tags?: string[];
  previewUrl?: string;
  pricing?:
    | {
        kind?: string;
        amountInCredits?: number;
      }
    | null;
  origin?: string;
  author?: string;

  // Where the actual layout lives
  specPatch?: Partial<Spec>;
  spec?: Partial<Spec>;
  patch?: Partial<Spec>;

  // Optional schema for editable content
  contentSchema?: DesignPackContentSchema | null;
};

// ---------- tiny helpers ----------

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  let body: any = null;

  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const msg =
      (body && (body.error || body.message)) ||
      `Request failed with ${res.status}`;
    throw new Error(msg);
  }

  return body;
}

async function getPackById(packId: string): Promise<RawDesignPack | null> {
  if (!packId) return null;

  // Reuse the shared client helper which already understands { ok, pack } etc.
  const pack = await getDesignStorePack(packId);
  if (!pack) return null;

  return pack as RawDesignPack;
}

function extractPatch(pack: RawDesignPack | null): Partial<Spec> | null {
  if (!pack) return null;
  const anyPack = pack as any;

  const patch =
    anyPack.specPatch || anyPack.spec || anyPack.patch || ({} as Partial<Spec>);

  if (!patch || typeof patch !== "object") return null;
  return patch as Partial<Spec>;
}

function cloneSpec(spec: Spec): Spec {
  // simple deep-ish clone good enough for our use
  return JSON.parse(JSON.stringify(spec)) as Spec;
}

function getDeep(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const parts = path.split(".");
  let cur: any = obj;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

function setDeep(obj: any, path: string, value: any) {
  if (!obj || !path) return;
  const parts = path.split(".");
  let cur: any = obj;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i === parts.length - 1) {
      cur[part] = value;
    } else {
      if (cur[part] == null || typeof cur[part] !== "object") {
        cur[part] = {};
      }
      cur = cur[part];
    }
  }
}

function normalizeFieldPath(
  field: DesignPackContentField,
  section: any
): string | null {
  const raw = (field.path || field.key || "").trim();
  if (!raw) return null;

  // If the schema already gives a full path, trust it.
  if (
    raw.startsWith("content.") ||
    raw.startsWith("copy.") ||
    raw.startsWith("data.")
  ) {
    return raw;
  }

  // If the section has a content object, default to content.<raw>
  if (section && typeof section === "object" && "content" in section) {
    return `content.${raw}`;
  }

  // Fallback: use raw as-is
  return raw;
}

/**
 * Merge the base Spec with a partial Spec from a design pack.
 * - layout.sections is merged: base sections kept, new ones appended (no duplicates).
 * - sections map is merged: base + patch, patch wins on conflicts.
 */
function mergeSpecWithPatch(base: Spec, patch: Partial<Spec>): Spec {
  const baseAny = base as any;
  const patchAny = patch as any;

  const baseLayout = (baseAny.layout || {}) as any;
  const patchLayout = (patchAny.layout || {}) as any;

  const baseSectionIds: string[] = Array.isArray(baseLayout.sections)
    ? [...baseLayout.sections]
    : [];
  const patchSectionIds: string[] = Array.isArray(patchLayout.sections)
    ? [...patchLayout.sections]
    : [];

  const mergedSectionIds = [
    ...baseSectionIds,
    ...patchSectionIds.filter((id) => !baseSectionIds.includes(id)),
  ];

  const next: any = cloneSpec(base);

  // Merge layout
  next.layout = {
    ...baseLayout,
    ...patchLayout,
    sections: mergedSectionIds,
  };

  // Merge sections map if present
  if (patchAny.sections && typeof patchAny.sections === "object") {
    next.sections = {
      ...(baseAny.sections || {}),
      ...(patchAny.sections || {}),
    };
  }

  // Shallow-merge any other top-level keys from patch
  for (const key of Object.keys(patchAny)) {
    if (key === "layout" || key === "sections") continue;
    const val = patchAny[key];
    if (val === undefined) continue;
    next[key] = val;
  }

  return next as Spec;
}

// ---------- external API: apply pack in real canvas ----------

/**
 * Called from CursorCanvas. Fetches a design pack by id, merges its specPatch
 * into the current Spec, and runs it through the guarded compose path.
 */
export async function applyDesignPackByIdExternal(
  packId: string,
  deps: ApplyDeps
): Promise<boolean> {
  const { getBaseSpec, recomposeGuarded, pushAutoLog, say } = deps;

  try {
    const base = getBaseSpec();
    if (!base) {
      // No Spec yet: treat the pack as the first Spec if it has a full shape.
      const pack = await getPackById(packId);
      const patch = extractPatch(pack);
      if (!patch) return false;

      const next = patch as Spec;
      const ok = await recomposeGuarded(next);
      if (ok) {
        pushAutoLog?.(
          "pilot",
          `Applied design pack “${pack?.name || packId}” as first layout.`
        );
        say?.("Applied design from the store.");
      }
      return ok;
    }

    const pack = await getPackById(packId);
    const patch = extractPatch(pack);
    if (!patch) return false;

    const next = mergeSpecWithPatch(base, patch);
    const ok = await recomposeGuarded(next);

    if (ok) {
      pushAutoLog?.(
        "pilot",
        `Applied design pack “${pack?.name || packId}” to this page.`
      );
      say?.("Design pack applied.");
    }

    return ok;
  } catch (err) {
    console.error("applyDesignPackByIdExternal error", err);
    pushAutoLog?.("pilot", "Could not apply design pack (error from server).");
    say?.("I couldn’t apply that design, something failed on the server.");
    return false;
  }
}

// ---------- external API: publish new user pack from a section ----------

export type PublishDesignPackArgs = {
  spec: Spec;
  sectionId: string;
  name: string;
  slot: string;
  description?: string;
};

/**
 * Builds a minimal specPatch containing only the given section and publishes
 * it as a user design pack via /api/design-store/publish.
 *
 * Server is expected to persist it and mark origin/author appropriately so
 * it shows up under “Your designs” in the store.
 */
export async function publishDesignPackFromSection(
  args: PublishDesignPackArgs
): Promise<boolean> {
  const { spec, sectionId, name, slot, description } = args;

  if (!spec || !sectionId || !name.trim() || !slot.trim()) {
    return false;
  }

  const anySpec = spec as any;
  const sectionsMap: Record<string, any> = anySpec.sections || {};
  const sectionData = sectionsMap[sectionId];

  if (!sectionData) {
    console.warn(
      "publishDesignPackFromSection: no section data found for id",
      sectionId
    );
    return false;
  }

  // Minimal patch: only this section + layout.sections = [sectionId]
  const specPatch: Partial<Spec> = {
    ...(anySpec.theme ? { theme: anySpec.theme } : {}),
    ...(anySpec.tokens ? { tokens: anySpec.tokens } : {}),
    layout: {
      ...(anySpec.layout || {}),
      sections: [sectionId],
    },
    // Only include this section in the map
    sections: {
      [sectionId]: sectionData,
    } as any,
  };

  const payload = {
    name: name.trim(),
    slot: slot.trim(),
    description: description?.trim() || "",
    origin: "user",
    specPatch,
  };

  try {
    await fetchJson("/api/design-store/publish", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return true;
  } catch (err) {
    console.error("publishDesignPackFromSection error", err);
    return false;
  }
}

// ---------- helpers for section-level editing from packs ----------

export type DesignPackEditorField = {
  key: string; // internal path, e.g. "content.headline"
  label: string;
  type: "text" | "long";
  value: string;
};

export type GetDesignPackEditorFieldsArgs = {
  spec: Spec;
  sectionId: string;
};

/**
 * Reads the editable fields for a section that came from a Design Pack.
 * Looks at spec.sections[sectionId].meta.designPackId and the pack.contentSchema.fields.
 */
export async function getDesignPackEditorFields(
  args: GetDesignPackEditorFieldsArgs
): Promise<DesignPackEditorField[]> {
  const { spec, sectionId } = args;
  if (!spec || !sectionId) return [];

  const anySpec = spec as any;
  const sectionsMap: Record<string, any> = anySpec.sections || {};
  const section = sectionsMap[sectionId];
  if (!section) return [];

  const meta = (section.meta || {}) as any;
  const packId: string | undefined =
    meta.designPackId || meta.design_pack_id || meta.designPackID;
  if (!packId) return [];

  let pack: RawDesignPack | null = null;
  try {
    pack = await getPackById(packId);
  } catch {
    return [];
  }
  if (!pack) return [];

  const schema = pack.contentSchema;
  const fields = Array.isArray(schema?.fields) ? schema!.fields! : [];
  if (!fields.length) return [];

  const out: DesignPackEditorField[] = [];
  for (const field of fields) {
    const path = normalizeFieldPath(field, section);
    if (!path) continue;

    const rawVal = getDeep(section, path);
    const value = rawVal == null ? "" : String(rawVal);
    const label = (field.label || field.key || path).toString();
    const type: "text" | "long" =
      field.type === "long" || field.type === "textarea" ? "long" : "text";

    out.push({
      key: path,
      label,
      type,
      value,
    });
  }

  return out;
}

export type ApplyDesignPackFieldUpdateArgs = {
  spec: Spec;
  sectionId: string;
  fieldKey: string; // same key/path we emitted from getDesignPackEditorFields
  nextValue: string;
};

/**
 * Pure helper: returns a new Spec with a single field updated inside a section,
 * based on the internal path key (e.g. "content.headline").
 * Does not mutate the original Spec.
 */
export function applyDesignPackFieldUpdate(
  args: ApplyDesignPackFieldUpdateArgs
): Spec {
  const { spec, sectionId, fieldKey, nextValue } = args;
  if (!spec || !sectionId || !fieldKey) return spec;

  const next = cloneSpec(spec);
  const anySpec = next as any;
  if (!anySpec.sections || !anySpec.sections[sectionId]) {
    return next;
  }

  const section = anySpec.sections[sectionId];
  setDeep(section, fieldKey, nextValue);

  return next as Spec;
}

// ---------- Autopilot → Design Store bridge ----------

export async function applyDesignPackFromAutopilot(opts: {
  slot: "hero" | "pricing" | "footer" | "navbar";
  styleHint?: string;
  actions: {
    applyDesignPackFromStore: (pack: UiDesignPack) => void;
  };
}) {
  const { slot, styleHint, actions } = opts;

  const params = new URLSearchParams();
  params.set("slot", slot);
  if (styleHint) params.set("q", styleHint);

  try {
    const res = await fetch(`/api/design-store/list?${params.toString()}`);
    const j = (await res.json().catch(() => ({} as any))) as any;

    const items = j?.items || j?.packs || j?.data || [];
    if (!j?.ok || !Array.isArray(items) || items.length === 0) {
      // No matching packs – just bail quietly
      return;
    }

    const first = items[0];
    const id = first.id || first.slug || first.packId;
    if (!id) return;

    const resPack = await fetch(
      `/api/design-store/pack/${encodeURIComponent(String(id))}`
    );
    const jPack = (await resPack.json().catch(() => ({} as any))) as any;

    const pack = jPack?.pack || jPack?.data || jPack;
    if (!pack) return;

    actions.applyDesignPackFromStore(pack as UiDesignPack);
  } catch (err) {
    console.error("applyDesignPackFromAutopilot failed", err);
  }
}
