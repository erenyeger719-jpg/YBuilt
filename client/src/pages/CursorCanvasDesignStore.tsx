// client/src/pages/CursorCanvasDesignStore.tsx
import React, { useEffect, useMemo, useState } from "react";
import CursorCanvasSaveDesignModal, {
  type SaveDesignForm,
  type SaveDesignSlot,
} from "./CursorCanvasSaveDesignModal";
import { publishDesignPackFromSection } from "./design-store-logic";
import type { Spec } from "./types-and-helpers";

type LogRole = "you" | "pilot";

type CursorCanvasDesignStoreProps = {
  // existing: apply a pack into the page
  onApplyPackById: (id: string) => Promise<boolean>;
  // new: for "Save as design" wiring, all passed from CursorCanvas
  getBaseSpec?: () => Spec | null | undefined;
  getSelectedSectionId?: () => string | null | undefined;
  say?: (text: string) => void;
  log?: (role: LogRole, text: string) => void;
};

type PackSummary = {
  id: string;
  name: string;
  slot?: string;
  tags?: string[];
  previewUrl?: string;
  description?: string;
  pricing?:
    | {
        kind?: "free" | "paid" | string;
        amountInCredits?: number;
      }
    | null;
  origin?: string;
  author?: string;
};

const SLOT_LABEL: Record<string, string> = {
  hero: "Hero",
  navbar: "Navbar",
  "feature-grid": "Features",
  pricing: "Pricing",
  testimonials: "Testimonials",
  cta: "CTA",
  footer: "Footer",
};

function isUserPack(raw: any): boolean {
  const origin = String(raw?.origin || "").toLowerCase();
  if (origin === "user") return true;

  const author = String(raw?.author || "").toLowerCase();
  if (!author) return false;
  if (author === "core" || author === "system") return false;
  return true;
}

export const CursorCanvasDesignStore: React.FC<
  CursorCanvasDesignStoreProps
> = ({ onApplyPackById, getBaseSpec, getSelectedSectionId, say, log }) => {
  // Store modal state
  const [open, setOpen] = useState(false);
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [slotFilter, setSlotFilter] = useState<
    "all" | "hero" | "pricing" | "footer" | "navbar" | "yours"
  >("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Save-as-design modal state
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveInitialName, setSaveInitialName] = useState("");
  const [saveInitialSlot, setSaveInitialSlot] =
    useState<SaveDesignSlot>("hero");
  const [saveSectionId, setSaveSectionId] = useState<string | null>(null);

  // Load packs once when the modal first opens
  useEffect(() => {
    if (!open) return;
    if (packs.length > 0 || loading) return;

    setLoading(true);
    setError(null);

    fetch("/api/design-store/list", {
      method: "GET",
      credentials: "include",
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        const rawItems =
          (body && (body.items || body.packs)) ||
          (Array.isArray(body) ? body : []);

        const mapped: PackSummary[] = (rawItems || []).map((p: any) => ({
          id: String(p.id || p.slug || p.name || ""),
          name: String(p.name || p.title || "Untitled pack"),
          slot: p.slot || p.meta?.slot || "",
          tags: Array.isArray(p.tags) ? p.tags : [],
          previewUrl: p.previewUrl || p.preview || "",
          description: p.description || "",
          pricing: p.pricing || null,
          origin: p.origin,
          author: p.author,
        }));

        setPacks(mapped.filter((p) => p.id));
      })
      .catch(() => {
        setError("Could not load design packs. Try again in a bit.");
      })
      .finally(() => setLoading(false));
  }, [open, packs.length, loading]);

  const visiblePacks = useMemo(() => {
    if (!packs.length) return [];
    if (slotFilter === "all") return packs;

    if (slotFilter === "yours") {
      return packs.filter((p) => isUserPack(p));
    }

    return packs.filter(
      (p) => (p.slot || "").toLowerCase() === slotFilter
    );
  }, [packs, slotFilter]);

  async function handleUse(id: string) {
    if (!id) return;
    setBusyId(id);
    try {
      await onApplyPackById(id);
      // keep modal open so user can try more packs; no auto-close
    } finally {
      setBusyId((prev) => (prev === id ? null : prev));
    }
  }

  function slotLabel(slot?: string) {
    if (!slot) return "Generic";
    const key = slot.toLowerCase();
    return SLOT_LABEL[key] || slot;
  }

  function pricingLabel(p?: PackSummary["pricing"]) {
    if (!p || !p.kind || p.kind === "free") return "Free";
    const amt = p.amountInCredits;
    if (typeof amt === "number" && amt > 0) return `${amt} credits`;
    return "Paid";
  }

  // ---------- Save-as-design helpers ----------

  function openSaveDesignModal() {
    if (!getBaseSpec) {
      console.warn("CursorCanvasDesignStore: getBaseSpec not provided");
      say?.("I can't see this page's layout yet.");
      return;
    }

    const currentSpec = getBaseSpec();
    if (!currentSpec) {
      console.warn("No spec yet, nothing to save as design.");
      say?.("There is nothing on the page to save yet.");
      return;
    }

    const anySpec: any = currentSpec;
    const layout = anySpec.layout || {};
    const sectionIds: string[] = Array.isArray(layout.sections)
      ? layout.sections
      : [];

    const explicitSelected = getSelectedSectionId?.() || null;
    const sectionId = explicitSelected || sectionIds[0];

    if (!sectionId) {
      console.warn("No section selected and no sections in layout.");
      say?.("Select a section first before saving as a design.");
      return;
    }

    const sectionsMap: Record<string, any> = anySpec.sections || {};
    const sectionData = sectionsMap[sectionId] || {};
    const meta = sectionData.meta || {};

    const inferredSlot: SaveDesignSlot = (meta.slot ||
      "hero") as SaveDesignSlot;
    const inferredName: string =
      meta.label ||
      meta.title ||
      meta.id ||
      `Saved section ${String(sectionId).slice(0, 4)}`;

    setSaveSectionId(sectionId);
    setSaveInitialName(inferredName);
    setSaveInitialSlot(inferredSlot);
    setSaveOpen(true);
  }

  async function handleSaveDesignConfirm(form: SaveDesignForm) {
    if (!getBaseSpec || !saveSectionId) {
      setSaveBusy(false);
      return;
    }

    const currentSpec = getBaseSpec();
    if (!currentSpec) {
      setSaveBusy(false);
      return;
    }

    setSaveBusy(true);
    const ok = await publishDesignPackFromSection({
      spec: currentSpec,
      sectionId: saveSectionId,
      name: form.name,
      slot: form.slot,
      description: form.description,
    });
    setSaveBusy(false);

    if (ok) {
      log?.("pilot", `Saved section as reusable design “${form.name}”.`);
      say?.("Saved as reusable design. Check Your designs in the store.");
      setSaveOpen(false);
    } else {
      console.error("Failed to save design pack from section.");
      say?.("I could not save this design. Something went wrong.");
    }
  }

  // ---------- Root render: buttons + modals ----------

  return (
    <>
      {/* Trigger buttons in the top bar */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-3 py-2 rounded text-sm border border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100 transition"
        >
          Design Store
        </button>

        <button
          type="button"
          onClick={openSaveDesignModal}
          className="px-3 py-2 rounded text-sm border border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100 transition"
        >
          Save as design
        </button>
      </div>

      {/* Design Store Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-5xl max-h-[80vh] rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
                  UI / UX Store
                </div>
                <div className="text-sm text-gray-700">
                  Drop in ready-made hero, pricing, footer, and more.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            {/* Filters */}
            <div className="px-5 py-2 border-b bg-gray-50 flex flex-wrap gap-2 text-xs">
              {[
                { key: "all", label: "All" },
                { key: "hero", label: "Hero" },
                { key: "pricing", label: "Pricing" },
                { key: "footer", label: "Footer" },
                { key: "navbar", label: "Navbar" },
                { key: "yours", label: "Your designs" },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() =>
                    setSlotFilter(f.key as typeof slotFilter)
                  }
                  className={
                    "px-3 py-1 rounded-full border text-[11px] transition " +
                    (slotFilter === f.key
                      ? "bg-black text-white border-black"
                      : "bg-white text-gray-700 border-gray-300 hover:border-gray-400")
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 bg-white">
              {loading && (
                <div className="text-xs text-gray-500">
                  Loading design packs…
                </div>
              )}

              {error && !loading && (
                <div className="text-xs text-red-500">{error}</div>
              )}

              {!loading && !error && visiblePacks.length === 0 && (
                <div className="text-xs text-gray-400">
                  No packs match this filter yet.
                </div>
              )}

              {!loading && !error && visiblePacks.length > 0 && (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                  {visiblePacks.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-col rounded-xl border border-gray-200 bg-gray-50 overflow-hidden hover:shadow-sm transition"
                    >
                      {/* Preview */}
                      <div className="h-28 bg-gray-200 overflow-hidden">
                        {p.previewUrl ? (
                          <img
                            src={p.previewUrl}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500">
                            No preview
                          </div>
                        )}
                      </div>

                      {/* Body */}
                      <div className="flex-1 flex flex-col px-3 py-2 gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-medium text-gray-900 truncate">
                            {p.name}
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-900 text-white">
                            {slotLabel(p.slot)}
                          </span>
                        </div>

                        {p.description && (
                          <div className="text-[11px] text-gray-500 line-clamp-2">
                            {p.description}
                          </div>
                        )}

                        {p.tags && p.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {p.tags.slice(0, 3).map((t) => (
                              <span
                                key={t}
                                className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-700"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-2 flex items-center justify-between text-[10px] text-gray-500">
                          <span>{pricingLabel(p.pricing)}</span>
                          {isUserPack(p) && (
                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                              Yours
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="px-3 pb-3">
                        <button
                          type="button"
                          onClick={() => handleUse(p.id)}
                          disabled={busyId === p.id}
                          className={
                            "w-full mt-1 px-3 py-1.5 rounded text-xs font-medium border transition " +
                            (busyId === p.id
                              ? "bg-gray-900 text-white border-gray-900 opacity-80 cursor-wait"
                              : "bg-black text-white border-black hover:bg-gray-900")
                          }
                        >
                          {busyId === p.id
                            ? "Applying…"
                            : "Use this design"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save-as-design Modal */}
      <CursorCanvasSaveDesignModal
        open={saveOpen}
        busy={saveBusy}
        initialName={saveInitialName}
        initialSlot={saveInitialSlot}
        onCancel={() => setSaveOpen(false)}
        onConfirm={handleSaveDesignConfirm}
      />
    </>
  );
};

export default CursorCanvasDesignStore;
