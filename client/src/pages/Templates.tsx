import TemplatesPanel from "@/components/templates/TemplatesPanel";
import ImportFromGitHub from "@/components/templates/ImportFromGitHub";

// Tiny clipboard helper (silent fallback to prompt if Clipboard API is blocked)
async function copySafe(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      // fallback prompt so the user can manually copy
      // eslint-disable-next-line no-alert
      prompt("Copy link:", text);
    } catch {}
    return false;
  }
}

async function forkTemplate(sourceId: string, name: string) {
  const r = await fetch("/api/previews/fork", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceId }),
  });
  const data = await r.json();
  if (!r.ok || !data?.path) throw new Error(data?.error || "fork failed");

  // Save in /previews list
  const STORE_KEY = "ybuilt.previews";
  const existing = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  localStorage.setItem(
    STORE_KEY,
    JSON.stringify([
      { id: `fork-${Date.now()}`, name, previewPath: data.path, createdAt: Date.now() },
      ...existing,
    ])
  );

  // Share: copy link immediately
  await copySafe(data.path);

  // Open the server-created path with popup-blocker fallback
  const win = window.open(data.path, "_blank", "noopener,noreferrer");
  if (!win) window.location.href = data.path; // fallback if blocked
}

export default function Templates() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Box above the grid */}
      <ImportFromGitHub />
      {/* Templates grid */}
      <TemplatesPanel onFork={(sourceId: string, name: string) => forkTemplate(sourceId, name)} />
    </div>
  );
}
