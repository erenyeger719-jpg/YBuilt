import TemplatesPanel from "@/components/templates/TemplatesPanel";

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

  // Open the server-created path with popup-blocker fallback
  const win = window.open(data.path, "_blank", "noopener,noreferrer");
  if (!win) window.location.href = data.path; // fallback if blocked
}

export default function Templates() {
  return (
    <div className="container mx-auto px-4 py-8">
      <TemplatesPanel
        onFork={(sourceId: string, name: string) => forkTemplate(sourceId, name)}
      />
    </div>
  );
}
