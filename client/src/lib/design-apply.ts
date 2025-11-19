// client/src/lib/design-apply.ts

import type { UiDesignPack } from "@/lib/design-store";

/**
 * Options for applying a design pack.
 * For now we mostly use "add" mode; "replace" is here for future.
 */
export type ApplyDesignPackOptions = {
  mode?: "add" | "replace";
  /**
   * When mode === "replace", this is the section.id to replace.
   */
  targetSectionId?: string;
};

/**
 * Small helpers to inspect sections safely.
 */
function getSections(spec: any): any[] {
  if (!spec || !Array.isArray(spec.sections)) return [];
  return spec.sections;
}

function findIndexByRole(sections: any[], role: string): number {
  return sections.findIndex((s) => s && s.role === role);
}

function findIndexById(sections: any[], id: string): number {
  return sections.findIndex((s) => s && s.id === id);
}

function cloneSectionsWithMeta(pack: UiDesignPack): any[] {
  const src = Array.isArray((pack as any)?.specPatch?.sections)
    ? (pack as any).specPatch.sections
    : [];

  if (src.length === 0) return [];

  const editableKeys =
    pack.contentSchema?.fields?.map((f) => f.key).filter(Boolean) ?? [];

  return src.map((raw: any, idx: number) => {
    const cloned: any = { ...raw };
    const existingMeta =
      cloned.meta && typeof cloned.meta === "object" ? { ...cloned.meta } : {};

    cloned.meta = {
      ...existingMeta,
      designPackId: pack.id,
      designPackVersion: pack.version ?? 1,
      editableFields: editableKeys,
      slot: pack.slot,
    };

    // Ensure we have a somewhat unique id when inserting multiple times
    if (!cloned.id) {
      cloned.id = `${pack.id}_${idx}`;
    }

    return cloned;
  });
}

/**
 * Compute a reasonable insertion index based on the pack slot and current sections.
 *
 * Rules (simple v1):
 * - navbar:
 *   - if a navbar exists → insert just after it
 *   - else → insert at top
 * - hero:
 *   - if a hero exists → insert just after the first hero
 *   - else if a navbar exists → insert just after navbar
 *   - else → insert at top
 * - pricing:
 *   - if a footer exists → insert just before the first footer
 *   - else → insert at bottom
 * - footer:
 *   - if footers exist → insert after the last footer
 *   - else → insert at bottom
 * - everything else:
 *   - append at bottom
 */
function chooseInsertIndex(sections: any[], pack: UiDesignPack): number {
  const slot = pack.slot;
  const len = sections.length;

  if (len === 0) return 0;

  if (slot === "navbar") {
    const navIdx = findIndexByRole(sections, "navbar");
    if (navIdx === -1) return 0;
    return navIdx + 1;
  }

  if (slot === "hero") {
    const navIdx = findIndexByRole(sections, "navbar");
    const heroIdx = findIndexByRole(sections, "hero");

    if (heroIdx !== -1) return heroIdx + 1;
    if (navIdx !== -1) return navIdx + 1;
    return 0;
  }

  if (slot === "pricing") {
    const footerIdx = findIndexByRole(sections, "footer");
    if (footerIdx !== -1) return footerIdx;
    return len;
  }

  if (slot === "footer") {
    let lastFooter = -1;
    sections.forEach((s, i) => {
      if (s && s.role === "footer") lastFooter = i;
    });
    if (lastFooter !== -1) return lastFooter + 1;
    return len;
  }

  // Other slots: append at bottom for now
  return len;
}

/**
 * Pure function: takes a spec + a design pack and returns a new spec
 * with the pack's sections inserted.
 *
 * It does NOT mutate the original spec.
 */
export function applyDesignPackToSpec(
  spec: any,
  pack: UiDesignPack,
  options: ApplyDesignPackOptions = {},
): any {
  const mode = options.mode ?? "add";
  const targetSectionId = options.targetSectionId;

  const existingSections = getSections(spec);
  const sections = [...existingSections];

  const newSections = cloneSectionsWithMeta(pack);
  if (newSections.length === 0) {
    // nothing to insert
    return spec;
  }

  // Replace mode: swap out a single section with the new ones, if found.
  if (mode === "replace" && targetSectionId) {
    const idx = findIndexById(sections, targetSectionId);
    if (idx !== -1) {
      sections.splice(idx, 1, ...newSections);
      return {
        ...(spec || {}),
        sections,
      };
    }
    // If not found, fall through to "add" behaviour.
  }

  // Add mode: insert based on slot rules
  const insertIndex = chooseInsertIndex(sections, pack);
  sections.splice(insertIndex, 0, ...newSections);

  return {
    ...(spec || {}),
    sections,
  };
}
