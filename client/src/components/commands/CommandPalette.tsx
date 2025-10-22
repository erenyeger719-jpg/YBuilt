import React, { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { exportZip, deployNetlify } from "@/lib/previewsActions";

type Cmd = {
  id: string;
  title: string;
  keywords?: string;
  run: () => Promise<void> | void;
};

export default function CommandPalette() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Helpers
  const promptText = async (label: string, def = "") => {
    const v = window.prompt(label, def);
    return v?.trim() || "";
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  };
  const lastPreview = () => {
    try {
      const items = JSON.parse(localStorage.getItem("ybuilt.previews") || "[]");
      return items[0] || null;
    } catch {
      return null;
    }
  };

  // Commands
  const commands: Cmd[] = useMemo(
    () => [
      {
        id: "scaffold-api",
        title: "New API Endpoint…",
        keywords: "scaffold route endpoint server",
        run: async () => {
          const name = await promptText(
            "Endpoint name (kebab or letters/numbers)",
            "ping"
          );
          if (!name) return;

          setBusy(true);
          try {
            const r = await fetch("/api/scaffold/api", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name }),
            });
            const data = await r.json();
            if (!r.ok || !data?.ok) throw new Error(data?.error || "Failed");

            const importLine = data.mount?.importLine || "";
            const useLine = data.mount?.useLine || "";
            const lines = `${importLine}\n${useLine}`;
            await copy(lines);

            toast({
              title: "Route created",
              description: `server/routes/${name}.js\n(Mount lines copied to clipboard)`,
            });
          } catch (e: any) {
            toast({
              title: "Scaffold failed",
              description: e?.message || "Error",
              variant: "destructive",
            });
          } finally {
            setBusy(false);
          }
        },
      },
      {
        id: "scaffold-client",
        title: "New Client API Hook…",
        keywords: "client fetch hook api",
        run: async () => {
          const name = await promptText("Hook name (same as endpoint)", "ping");
          if (!name) return;

          setBusy(true);
          try {
            const r = await fetch("/api/scaffold/client", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name }),
            });
            const data = await r.json();
            if (!r.ok || !data?.ok) throw new Error(data?.error || "Failed");
            toast({
              title: "Client hook created",
              description: data.file || `client/src/lib/api/${name}.ts`,
            });
          } catch (e: any) {
            toast({
              title: "Scaffold failed",
              description: e?.message || "Error",
              variant: "destructive",
            });
          } finally {
            setBusy(false);
          }
        },
      },
      {
        id: "open-dev-logs",
        title: "Open Dev Logs",
        keywords: "logs request console",
        run: () => {
          window.location.href = "/dev/logs";
        },
      },
      {
        id: "fork-landing",
        title: "Fork: Polished Landing Page",
        keywords: "template demo fork",
        run: () => {
          window.location.href = "/templates?fork=demo-landing";
        },
      },
      // --- NEW: quick navigation commands ---
      {
        id: "open-previews",
        title: "Open Previews",
        keywords: "previews list",
        run: () => (window.location.href = "/previews"),
      },
      {
        id: "open-last-preview",
        title: "Open Last Preview",
        keywords: "preview last open",
        run: () => {
          const items = JSON.parse(localStorage.getItem("ybuilt.previews") || "[]");
          if (items[0]?.previewPath)
            window.open(items[0].previewPath, "_blank", "noopener,noreferrer");
          else alert("No previews yet. Fork a template first.");
        },
      },
      {
        id: "export-last",
        title: "Export last preview (ZIP)",
        keywords: "export zip",
        run: async () => {
          const last = lastPreview();
          if (!last)
            return toast({
              title: "No previews",
              description: "Fork a template first.",
            });
          try {
            await exportZip(last.previewPath);
          } catch (e: any) {
            toast({
              title: "Export failed",
              description: e?.message || "Error",
              variant: "destructive",
            });
          }
        },
      },
      {
        id: "deploy-netlify",
        title: "Deploy last preview → Netlify",
        keywords: "deploy netlify",
        run: async () => {
          const last = lastPreview();
          if (!last)
            return toast({
              title: "No previews",
              description: "Fork a template first.",
            });
          setBusy(true);
          try {
            const siteName = `ybuilt-${(last.name || "site")
              .toLowerCase()
              .replace(/\s+/g, "-")
              .replace(/[^a-z0-9-]/g, "")}`;
            const r = await deployNetlify(last.previewPath, siteName);
            toast({
              title: "Netlify",
              description: r?.url || r?.admin_url || "Deployed",
            });
          } catch (e: any) {
            toast({
              title: "Deploy failed",
              description: e?.message || "Error",
              variant: "destructive",
            });
          } finally {
            setBusy(false);
          }
        },
      },
      // --- NEW: Import from GitHub ---
      {
        id: "import-github",
        title: "Import from GitHub…",
        keywords: "import github preview",
        run: async () => {
          const url = window.prompt(
            "GitHub URL (repo or repo/tree/branch[/subdir])",
            "https://github.com/vercel/next.js/tree/canary/examples/hello-world"
          );
          if (!url) return;
          try {
            const r = await fetch("/api/import/github", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url }),
            });
            const data = await r.json();
            if (!r.ok || !data?.ok) throw new Error(data?.error || "Import failed");

            // Save to localStorage so Previews page picks it up
            const STORE_KEY = "ybuilt.previews";
            const existing = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
            const item = {
              id: `import-${Date.now()}`,
              name: `${data.repo || "Imported"}`,
              previewPath: data.path,
              createdAt: Date.now(),
            };
            localStorage.setItem(STORE_KEY, JSON.stringify([item, ...existing]));

            // Open it
            window.open(data.path, "_blank", "noopener,noreferrer");
          } catch (e: any) {
            alert(e?.message || "Import failed");
          }
        },
      },
    ],
    [toast]
  );

  // Filter + selection
  const filtered = commands.filter((c) =>
    !q
      ? true
      : c.title.toLowerCase().includes(q.toLowerCase()) ||
        (c.keywords || "").toLowerCase().includes(q.toLowerCase())
  );

  // Hotkeys: ⌘K / Ctrl+K to toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (!open) return;
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSel((s) => Math.min(s + 1, filtered.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSel((s) => Math.max(s - 1, 0));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        filtered[sel]?.run()?.finally(() => setOpen(false));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, sel]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
    else {
      setQ("");
      setSel(0);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000]">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => setOpen(false)}
      />
      {/* dialog */}
      <div className="absolute left-1/2 top-24 -translate-x-1/2 w-[min(680px,90vw)] rounded-2xl border bg-white dark:bg-zinc-900 shadow-2xl">
        <div className="p-3 border-b">
          <input
            ref={inputRef}
            className="w-full bg-transparent outline-none text-sm px-2 py-2"
            placeholder={busy ? "Working…" : "Type a command…  (Cmd/Ctrl + K)"}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            disabled={busy}
          />
        </div>
        <ul className="max-h-[50vh] overflow-auto py-2">
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-zinc-500">No matches.</li>
          )}
          {filtered.map((c, i) => (
            <li
              key={c.id}
              onClick={() => {
                c.run();
                setOpen(false);
              }}
              className={`px-3 py-2 text-sm cursor-pointer ${
                i === sel ? "bg-zinc-100 dark:bg-zinc-800" : ""
              }`}
            >
              {c.title}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
