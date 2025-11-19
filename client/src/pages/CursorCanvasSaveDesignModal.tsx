// client/src/pages/CursorCanvasSaveDesignModal.tsx
import React, { useEffect, useState } from "react";

export type SaveDesignSlot =
  | "hero"
  | "navbar"
  | "feature-grid"
  | "pricing"
  | "testimonials"
  | "cta"
  | "footer";

export type SaveDesignForm = {
  name: string;
  slot: SaveDesignSlot;
  description?: string;
};

type CursorCanvasSaveDesignModalProps = {
  open: boolean;
  busy?: boolean;

  initialName?: string;
  initialSlot?: SaveDesignSlot;

  onCancel: () => void;
  onConfirm: (data: SaveDesignForm) => void | Promise<void>;
};

const SLOT_OPTIONS: { value: SaveDesignSlot; label: string }[] = [
  { value: "hero", label: "Hero" },
  { value: "navbar", label: "Navbar" },
  { value: "feature-grid", label: "Feature grid" },
  { value: "pricing", label: "Pricing" },
  { value: "testimonials", label: "Testimonials" },
  { value: "cta", label: "CTA" },
  { value: "footer", label: "Footer" },
];

export const CursorCanvasSaveDesignModal: React.FC<
  CursorCanvasSaveDesignModalProps
> = ({ open, busy, initialName, initialSlot, onCancel, onConfirm }) => {
  const [name, setName] = useState(initialName || "");
  const [slot, setSlot] = useState<SaveDesignSlot>(initialSlot || "hero");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;

    setName(initialName || "");
    setSlot(initialSlot || "hero");
    setDescription("");
  }, [open, initialName, initialSlot]);

  if (!open) return null;

  const disabled = busy || !name.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;

    const payload: SaveDesignForm = {
      name: name.trim(),
      slot,
      description: description.trim() || undefined,
    };

    await onConfirm(payload);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={disabled ? undefined : onCancel}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">
              Save as design pack
            </div>
            <div className="text-sm text-gray-700">
              Turn this section into a reusable layout.
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Name */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-gray-700">
              Design name <span className="text-red-500">*</span>
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Minimal dark hero"
              className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-black/70 focus:border-black"
            />
            <div className="text-[11px] text-gray-500">
              This is how it will appear in the Design Store.
            </div>
          </div>

          {/* Slot */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-gray-700">Slot</div>
            <select
              value={slot}
              onChange={(e) => setSlot(e.target.value as SaveDesignSlot)}
              className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black/70 focus:border-black"
            >
              {SLOT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="text-[11px] text-gray-500">
              This tells YBuilt where this design fits on a page.
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-gray-700">
              Description (optional)
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Short note like “Minimal dark hero with single CTA”."
              className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black/70 focus:border-black"
            />
          </div>

          {/* Footer */}
          <div className="pt-2 pb-1 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="px-3 py-1.5 rounded-md border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={disabled}
              className="px-4 py-1.5 rounded-md bg-black text-white text-xs font-semibold border border-black hover:bg-gray-900 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy ? "Saving…" : "Save design"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CursorCanvasSaveDesignModal;
