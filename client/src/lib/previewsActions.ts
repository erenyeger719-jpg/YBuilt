// Minimal client helpers for Export / Deploy buttons

export async function exportZip(previewPath: string) {
  const res = await fetch("/api/previews/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: previewPath }),
  });
  if (!res.ok) {
    const t = await safeText(res);
    throw new Error(`export failed: ${res.status} ${t}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ybuilt-export.zip";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function deployNetlify(previewPath: string, siteName?: string) {
  const r = await fetch("/api/deploy/netlify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: previewPath, siteName }),
  });
  if (!r.ok) {
    const t = await safeText(r);
    throw new Error(`netlify: ${r.status} ${t}`);
  }
  return r.json();
}

export async function deployVercel(previewPath: string, name?: string) {
  const r = await fetch("/api/deploy/vercel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: previewPath, name }),
  });
  if (!r.ok) {
    const t = await safeText(r);
    throw new Error(`vercel: ${r.status} ${t}`);
  }
  return r.json();
}

/** Queue-based deploys */
export async function enqueueDeploy(
  provider: "netlify" | "vercel",
  previewPath: string,
  siteName?: string
) {
  const r = await fetch("/api/deploy/enqueue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, previewPath, siteName }),
  });
  const data = await r.json();
  if (!r.ok || !data?.ok) throw new Error(data?.error || "enqueue failed");
  return data.id as string;
}

export async function getDeployJob(id: string) {
  const r = await fetch(`/api/deploy/job/${encodeURIComponent(id)}`);
  const data = await r.json();
  if (!r.ok || !data?.ok) throw new Error(data?.error || "job lookup failed");
  return data;
}

async function safeText(r: Response) {
  try {
    return await r.text();
  } catch {
    return "";
  }
}
