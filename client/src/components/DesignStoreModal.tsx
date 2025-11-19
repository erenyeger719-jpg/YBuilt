// client/src/components/DesignStoreModal.tsx
import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DesignSlot,
  UiDesignPackSummary,
  fetchDesignPacks,
} from "@/lib/design-store";

export type DesignStoreModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Called when the user clicks "Use" on a pack.
   * For now we'll just send the id; later we can wire this into Spec/applyDesignPack.
   */
  onUsePack?: (pack: UiDesignPackSummary) => void;
};

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready" };

const SLOT_LABELS: Record<DesignSlot, string> = {
  hero: "Hero section",
  navbar: "Navbar",
  "feature-grid": "Feature grid",
  pricing: "Pricing section",
  testimonials: "Testimonials",
  cta: "Call to action",
  footer: "Footer",
};

type SlotFilter = DesignSlot | "all" | "yours";

export function DesignStoreModal(props: DesignStoreModalProps) {
  const { open, onOpenChange, onUsePack } = props;

  const [packs, setPacks] = useState<UiDesignPackSummary[]>([]);
  const [loadState, setLoadState] = useState<LoadState>({ kind: "idle" });

  // Filters:
  // - "all"    → everything
  // - slot     → hero/pricing/footer/etc.
  // - "yours"  → packs created by the user (id starts with "user_" or author === "user")
  const [slotFilter, setSlotFilter] = useState<SlotFilter>("all");

  useEffect(() => {
    if (!open) return;

    setLoadState({ kind: "loading" });

    // Only send a slot param to the API when it's a real DesignSlot.
    const slotParam: DesignSlot | undefined =
      slotFilter === "all" || slotFilter === "yours" ? undefined : slotFilter;

    fetchDesignPacks({
      slot: slotParam,
    })
      .then((items) => {
        setPacks(items);
        setLoadState({ kind: "ready" });
      })
      .catch((err: any) => {
        const msg = err?.message || "Failed to load design packs";
        setLoadState({ kind: "error", message: msg });
      });
  }, [open, slotFilter]);

  const showAll = () => setSlotFilter("all");

  const handleUse = (pack: UiDesignPackSummary) => {
    if (onUsePack) {
      onUsePack(pack);
    }
    // Close the modal after choosing a pack
    onOpenChange(false);
  };

  // Apply "Your designs" filter client-side
  const visiblePacks: UiDesignPackSummary[] =
    slotFilter === "yours"
      ? packs.filter(
          (pack) =>
            pack.id.startsWith("user_") ||
            (pack.author && pack.author.toLowerCase() === "user"),
        )
      : packs;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-full sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Design Store
          </DialogTitle>
          <DialogDescription>
            Drop ready-made sections into your page — hero, pricing, footer and
            more. You can tweak the content after you insert them.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-4">
          {/* Simple filters for now */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={slotFilter === "all" ? "default" : "outline"}
              onClick={showAll}
            >
              All layouts
            </Button>
            <Button
              type="button"
              size="sm"
              variant={slotFilter === "hero" ? "default" : "outline"}
              onClick={() => setSlotFilter("hero")}
            >
              Hero
            </Button>
            <Button
              type="button"
              size="sm"
              variant={slotFilter === "pricing" ? "default" : "outline"}
              onClick={() => setSlotFilter("pricing")}
            >
              Pricing
            </Button>
            <Button
              type="button"
              size="sm"
              variant={slotFilter === "footer" ? "default" : "outline"}
              onClick={() => setSlotFilter("footer")}
            >
              Footer
            </Button>
            <Button
              type="button"
              size="sm"
              variant={slotFilter === "yours" ? "default" : "outline"}
              onClick={() => setSlotFilter("yours")}
            >
              Your designs
            </Button>
          </div>

          <ScrollArea className="h-[360px] rounded-md border border-border/60 p-1">
            {loadState.kind === "loading" && (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading design packs…
              </div>
            )}

            {loadState.kind === "error" && (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-red-500">
                <span>Failed to load design packs.</span>
                <span className="text-xs opacity-80">
                  {loadState.message}
                </span>
              </div>
            )}

            {loadState.kind === "ready" && visiblePacks.length === 0 && (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No designs found for this filter yet.
              </div>
            )}

            {loadState.kind === "ready" && visiblePacks.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {visiblePacks.map((pack) => (
                  <Card
                    key={pack.id}
                    className="flex flex-col justify-between border-border/70 bg-background/80 shadow-sm"
                  >
                    <div className="p-3 pb-2">
                      {/* Thumbnail area */}
                      <div className="mb-3 h-28 w-full overflow-hidden rounded-md border border-border/60 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700">
                        {pack.previewUrl ? (
                          <img
                            src={pack.previewUrl}
                            alt={pack.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs font-medium text-slate-200/80">
                            Preview
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-medium leading-tight">
                            {pack.name}
                          </h3>
                          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-100">
                            {pack.pricing?.kind === "paid"
                              ? "Paid"
                              : "Free"}
                          </span>
                        </div>

                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {pack.description}
                        </p>

                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className="inline-flex rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-100/90">
                            {SLOT_LABELS[pack.slot]}
                          </span>
                          {pack.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex rounded-full bg-slate-800/40 px-2 py-0.5 text-[10px] text-slate-200/80"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-2">
                      <span className="text-[11px] text-muted-foreground">
                        {pack.author || "YBuilt"}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleUse(pack)}
                      >
                        Use this
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DesignStoreModal;
