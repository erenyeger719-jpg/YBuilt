import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const STORE_KEY = "ybuilt.previews";

export default function ImportFromGitHub() {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    const clean = url.trim();
    if (!clean || !clean.includes("github.com")) {
      toast({ title: "Invalid URL", description: "Paste a GitHub URL.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/import/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: clean }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok || !data.path) throw new Error(data?.error || "Import failed");

      // Save so /previews shows it
      const existing = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
      const item = {
        id: `import-${Date.now()}`,
        name: data.repo || "Imported",
        previewPath: data.path,
        createdAt: Date.now(),
      };
      localStorage.setItem(STORE_KEY, JSON.stringify([item, ...existing]));

      // Open it
      const win = window.open(data.path, "_blank", "noopener,noreferrer");
      if (!win) window.location.href = data.path;

      toast({ title: "Imported", description: data.repo || "Preview created" });
      setUrl("");
    } catch (e: any) {
      toast({ title: "Import failed", description: e?.message || "Error", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 rounded-2xl border p-4">
      <div className="mb-2 text-sm font-medium">Import from GitHub</div>
      <form className="flex gap-2" onSubmit={handleImport}>
        <input
          className="flex-1 rounded border px-3 py-2 text-sm"
          placeholder="https://github.com/user/repo[/tree/branch[/subdir]]"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={busy}
        />
        <button
          className="text-sm px-3 py-2 border rounded"
          type="submit"
          disabled={busy}
          title="Creates a preview from the repo (needs index.html at that path)"
        >
          {busy ? "Importing…" : "Import"}
        </button>
      </form>
      <p className="mt-2 text-xs text-zinc-500">
        Tip: Works great with static repos like <code>gh-pages</code> branches, or folders that contain an{" "}
        <code>index.html</code>.
      </p>
    </div>
  );
}
