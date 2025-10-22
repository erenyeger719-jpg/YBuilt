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
    JSON.stringify([{ id: `fork-${Date.now()}`, name, previewPath: data.path, createdAt: Date.now() }, ...existing])
  );

  // Open the server-created path
  window.open(data.path, "_blank", "noopener,noreferrer");
}

export default function Templates() {
  return (
    <div className="container mx-auto px-4 py-8">
      <TemplatesPanel />
    </div>
  );
}
