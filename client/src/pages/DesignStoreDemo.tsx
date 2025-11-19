// client/src/pages/DesignStoreDemo.tsx
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

import DesignStoreModal from "@/components/DesignStoreModal";
import {
  UiDesignPackSummary,
  fetchDesignPack,
} from "@/lib/design-store";
import { applyDesignPackToSpec } from "@/lib/design-apply";

type DemoField = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
};

type SaveStatus = "idle" | "saving" | "ok" | "error";

export default function DesignStoreDemo() {
  const [storeOpen, setStoreOpen] = useState(false);

  // Simple local spec just for this demo page.
  const [spec, setSpec] = useState<any>({ sections: [] });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sections: any[] = Array.isArray(spec?.sections) ? spec.sections : [];

  // Selection + editor state
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [editorPackName, setEditorPackName] = useState<string | null>(null);
  const [editorFields, setEditorFields] = useState<DemoField[] | null>(null);
  const [editorValues, setEditorValues] = useState<Record<string, string>>({});
  const [editorState, setEditorState] = useState<
    "idle" | "loading" | "ready" | "no-pack" | "error"
  >("idle");

  // Save-as-reusable state
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  async function handleUsePack(summary: UiDesignPackSummary) {
    setBusy(true);
    setError(null);
    try {
      const fullPack = await fetchDesignPack(summary.id);
      setSpec((prev: any) => applyDesignPackToSpec(prev, fullPack));
      setStoreOpen(false);
      // After inserting, clear selection/editor so you pick fresh.
      setSelectedIndex(null);
      setEditorPackName(null);
      setEditorFields(null);
      setEditorValues({});
      setEditorState("idle");
      setSaveStatus("idle");
      setSaveMessage(null);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to apply design pack");
    } finally {
      setBusy(false);
    }
  }

  function handleClearSpec() {
    setSpec({ sections: [] });
    setSelectedIndex(null);
    setEditorPackName(null);
    setEditorFields(null);
    setEditorValues({});
    setEditorState("idle");
    setSaveStatus("idle");
    setSaveMessage(null);
  }

  async function handleSelectSection(idx: number) {
    setSelectedIndex(idx);
    setSaveStatus("idle");
    setSaveMessage(null);

    const section = sections[idx];
    if (!section) {
      setEditorPackName(null);
      setEditorFields(null);
      setEditorValues({});
      setEditorState("idle");
      return;
    }

    const packId = section?.meta?.designPackId;
    if (!packId) {
      // Section is not from a design pack
      setEditorPackName(null);
      setEditorFields(null);
      setEditorValues({});
      setEditorState("no-pack");
      return;
    }

    setEditorState("loading");
    setEditorPackName(null);
    setEditorFields(null);
    setEditorValues({});

    try {
      const pack: any = await fetchDesignPack(packId);
      const rawFields: DemoField[] = Array.isArray(
        pack?.contentSchema?.fields,
      )
        ? pack.contentSchema.fields
        : [];

      // Only handle simple string-richtext fields in this demo.
      const fields = rawFields.filter(
        (f) => f && (f.type === "string" || f.type === "richtext"),
      );

      const initialValues: Record<string, string> = {};
      fields.forEach((field) => {
        const currentVal = section?.content?.[field.key];
        if (typeof currentVal === "string") {
          initialValues[field.key] = currentVal;
        } else if (currentVal != null) {
          initialValues[field.key] = String(currentVal);
        } else {
          initialValues[field.key] = "";
        }
      });

      setEditorPackName(pack?.name || packId);
      setEditorFields(fields);
      setEditorValues(initialValues);
      setEditorState(fields.length > 0 ? "ready" : "no-pack");
    } catch (err) {
      console.error(err);
      setEditorPackName(null);
      setEditorFields(null);
      setEditorValues({});
      setEditorState("error");
    }
  }

  function handleFieldChange(fieldKey: string, nextValue: string) {
    setEditorValues((prev) => ({
      ...prev,
      [fieldKey]: nextValue,
    }));

    setSpec((prev: any) => {
      const prevSections: any[] = Array.isArray(prev?.sections)
        ? prev.sections
        : [];

      if (
        selectedIndex == null ||
        selectedIndex < 0 ||
        selectedIndex >= prevSections.length
      ) {
        return prev;
      }

      const section = prevSections[selectedIndex] || {};
      const nextSection = {
        ...section,
        content: {
          ...(section.content || {}),
          [fieldKey]: nextValue,
        },
      };

      const nextSections = [...prevSections];
      nextSections[selectedIndex] = nextSection;

      return {
        ...prev,
        sections: nextSections,
      };
    });
  }

  const selectedSection =
    selectedIndex != null ? sections[selectedIndex] : null;

  // Local client-side version of the publish call.
  async function handleSaveAsReusableDesign() {
    if (!selectedSection) return;

    const content = selectedSection.content || {};

    const defaultName =
      typeof content.headline === "string" && content.headline.trim().length > 0
        ? content.headline.slice(0, 60)
        : "Reusable design";

    const name = window.prompt(
      "Name for this reusable design",
      defaultName,
    );
    if (!name || !name.trim()) {
      return;
    }

    // Infer slot from role when possible; default to "hero"
    type LocalDesignSlot =
      | "hero"
      | "navbar"
      | "feature-grid"
      | "pricing"
      | "testimonials"
      | "cta"
      | "footer";

    const role = selectedSection.role as string | undefined;
    let slot: LocalDesignSlot = "hero";
    if (
      role === "hero" ||
      role === "navbar" ||
      role === "feature-grid" ||
      role === "pricing" ||
      role === "testimonials" ||
      role === "cta" ||
      role === "footer"
    ) {
      slot = role;
    }

    const description = `Saved from DesignStoreDemo (${slot})`;

    // Build simple contentSchema from present string fields.
    const fields = Object.entries(content)
      .filter(
        ([, value]) =>
          typeof value === "string" && (value as string).trim().length > 0,
      )
      .map(([key]) => ({
        key,
        label: key,
        type: "string" as const,
        required: false,
      }));

    const specPatch = {
      sections: [
        {
          role: selectedSection.role || slot,
          kind: selectedSection.kind || "section",
          content,
        },
      ],
    };

    try {
      setSaveStatus("saving");
      setSaveMessage(null);

      const res = await fetch("/api/design-store/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          slot,
          name: name.trim(),
          description,
          specPatch,
          contentSchema: { fields },
          tags: ["user", "saved", "demo"],
        }),
      });

      if (!res.ok) {
        throw new Error(`Publish failed: ${res.status}`);
      }

      const data = await res.json();
      if (!data?.ok) {
        throw new Error(data?.error || "Publish failed");
      }

      setSaveStatus("ok");
      setSaveMessage(`Saved as "${data.item?.name || name.trim()}"`);
    } catch (err: any) {
      console.error(err);
      setSaveStatus("error");
      setSaveMessage(err?.message || "Failed to save design");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Simple header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold">Design Store Demo</h1>
          <p className="text-xs text-muted-foreground">
            Dev-only page to test Design Store → Spec insertion → simple
            editing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={handleClearSpec}
          >
            Clear spec
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => setStoreOpen(true)}
          >
            {busy ? "Working…" : "Browse designs"}
          </Button>
        </div>
      </header>

      {/* Body */}
      <main className="flex flex-1 flex-col gap-3 p-4">
        {error && (
          <div className="rounded-md border border-red-500/60 bg-red-950/40 px-3 py-2 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div>
            Sections in current spec:{" "}
            <span className="font-mono">{sections.length}</span>
          </div>
          {selectedIndex != null && (
            <div className="font-mono text-[11px]">
              Selected: #{selectedIndex + 1}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-3 lg:flex-row">
          {/* Left: sections list */}
          <div className="flex-1">
            <ScrollArea className="h-[420px] rounded-md border border-border/70 p-3">
              {sections.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No sections yet. Click{" "}
                  <span className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                    Browse designs
                  </span>{" "}
                  to insert a hero, pricing, or footer pack.
                </div>
              ) : (
                <div className="space-y-3">
                  {sections.map((section: any, idx: number) => {
                    const isSelected = selectedIndex === idx;
                    return (
                      <Card
                        key={section.id || idx}
                        className={`cursor-pointer border p-3 transition-colors ${
                          isSelected
                            ? "border-primary ring-1 ring-primary/40"
                            : "border-border/70 hover:border-primary/40"
                        }`}
                        onClick={() => handleSelectSection(idx)}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <div className="text-xs font-mono opacity-70">
                            #{idx + 1} · role:{" "}
                            <span className="font-semibold">
                              {section.role || "—"}
                            </span>{" "}
                            · id: {section.id || "—"}
                          </div>
                          {section?.meta?.designPackId && (
                            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-100">
                              Pack: {section.meta.designPackId}
                            </span>
                          )}
                        </div>

                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-[11px] leading-snug opacity-80">
                          {JSON.stringify(section.content ?? section, null, 2)}
                        </pre>
                      </Card>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Right: simple content editor */}
          <div className="w-full lg:w-80 xl:w-96">
            <Card className="h-full space-y-3 border-border/70 bg-background/80 p-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Edit content</h2>
                {editorPackName && (
                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-100">
                    {editorPackName}
                  </span>
                )}
              </div>

              {selectedSection && (
                <div className="flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={saveStatus === "saving"}
                    onClick={handleSaveAsReusableDesign}
                  >
                    {saveStatus === "saving"
                      ? "Saving…"
                      : "Save as reusable design"}
                  </Button>
                  {saveMessage && (
                    <span
                      className={`text-[11px] ${
                        saveStatus === "error"
                          ? "text-red-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {saveMessage}
                    </span>
                  )}
                </div>
              )}

              {selectedSection == null && (
                <p className="text-xs text-muted-foreground">
                  Click a section card on the left to edit its content.
                </p>
              )}

              {selectedSection != null && editorState === "no-pack" && (
                <p className="text-xs text-muted-foreground">
                  This section is not from a design pack, or the pack does not
                  expose any simple text fields yet.
                </p>
              )}

              {selectedSection != null && editorState === "loading" && (
                <p className="text-xs text-muted-foreground">
                  Loading fields for this design pack…
                </p>
              )}

              {selectedSection != null && editorState === "error" && (
                <p className="text-xs text-red-400">
                  Failed to load fields for this design pack.
                </p>
              )}

              {selectedSection != null &&
                editorState === "ready" &&
                editorFields &&
                editorFields.length > 0 && (
                  <div className="space-y-3">
                    {editorFields.map((field) => (
                      <div key={field.key} className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          {field.label}
                          {field.required && (
                            <span className="ml-0.5 text-red-400">*</span>
                          )}
                        </label>
                        <textarea
                          className="h-16 w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
                          value={editorValues[field.key] ?? ""}
                          onChange={(e) =>
                            handleFieldChange(field.key, e.target.value)
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}

              {selectedSection != null &&
                editorState === "ready" &&
                (!editorFields || editorFields.length === 0) && (
                  <p className="text-xs text-muted-foreground">
                    This design pack does not have any editable text fields yet.
                  </p>
                )}
            </Card>
          </div>
        </div>
      </main>

      {/* Design Store modal */}
      <DesignStoreModal
        open={storeOpen}
        onOpenChange={setStoreOpen}
        onUsePack={handleUsePack}
      />
    </div>
  );
}
