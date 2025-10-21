import React, { useEffect, useMemo, useState } from "react";

type Command = {
  id: string;
  label: string;
  params?: { key: string; placeholder?: string }[];
};

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [commands, setCommands] = useState<Command[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Command | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [commit, setCommit] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Hotkey
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = navigator.platform.includes("Mac") ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Load server commands once
  useEffect(() => {
    fetch("/api/tasks/list").then(r => r.json()).then(d => {
      if (d?.ok) setCommands(d.commands || []);
    }).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(c => c.label.toLowerCase().includes(q) || c.id.includes(q));
  }, [commands, query]);

  async function runSelected() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch("/api/tasks/run", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ cmd: selected.id, params, commit }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      const created = data.result?.created?.length ? `Created ${data.result.created.length} file(s)` : "";
      const modified = data.result?.modified?.length ? `Modified ${data.result.modified.length} file(s)` : "";
      const sha = data.git?.committed ? ` • commit ${data.git.sha}` : "";
      setToast(`${selected.label} ✓ ${[created, modified].filter(Boolean).join(" • ")}${sha}`);
      setSelected(null);
      setParams({});
      setOpen(false);
    } catch (e: any) {
      setToast(`Failed: ${e?.message || e}`);
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 3500);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <div className="absolute left-1/2 top-24 -translate-x-1/2 w-[600px] max-w-[90vw] rounded-2xl border bg-white dark:bg-zinc-900 shadow-xl">
        <div className="p-3 border-b">
          {!selected ? (
            <input
              autoFocus
              className="w-full bg-transparent outline-none text-sm px-2 py-1"
              placeholder="Type a command… (Create Page, Create Component, Add Route to App, …)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          ) : (
            <div className="flex items-center gap-2">
              <div className="font-medium">{selected.label}</div>
              <div className="ml-auto flex items-center gap-2 text-xs">
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={commit} onChange={(e)=>setCommit(e.target.checked)} />
                  Auto-commit
                </label>
              </div>
            </div>
          )}
        </div>

        {!selected ? (
          <ul className="max-h-72 overflow-auto">
            {filtered.map((c) => (
              <li
                key={c.id}
                className="px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                onClick={() => setSelected(c)}
              >
                <div className="text-sm">{c.label}</div>
                <div className="text-[11px] text-zinc-500">{c.id}</div>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-6 text-sm text-zinc-500">No commands matched.</li>
            )}
          </ul>
        ) : (
          <div className="p-3 space-y-3">
            {(selected.params || []).map((p) => (
              <div key={p.key} className="flex items-center gap-3">
                <div className="w-28 text-xs text-zinc-500">{p.key}</div>
                <input
                  className="flex-1 border rounded px-2 py-1 text-sm"
                  placeholder={p.placeholder || p.key}
                  value={params[p.key] || ""}
                  onChange={(e) => setParams({ ...params, [p.key]: e.target.value })}
                />
              </div>
            ))}
            <div className="flex items-center justify-end gap-2">
              <button className="text-xs px-3 py-1 border rounded" onClick={() => setSelected(null)}>Back</button>
              <button
                className="text-xs px-3 py-1 border rounded bg-black text-white dark:bg-white dark:text-black"
                onClick={runSelected}
                disabled={busy}
              >
                {busy ? "Running…" : "Run"}
              </button>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-2 rounded bg-black text-white text-xs shadow">
          {toast}
        </div>
      )}
    </div>
  );
}
