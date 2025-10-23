export async function aiPlan(
  prompt: string,
  tier: "fast" | "balanced" | "best" = "balanced",
) {
  const r = await fetch("/api/ai/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, tier }),
  });
  const d = await r.json();
  if (!r.ok || !d?.ok) throw new Error(d?.error || "plan failed");
  return d;
}

export async function aiScaffold(opts: { prompt?: string; tier?: string; plan?: any }) {
  const r = await fetch("/api/ai/scaffold", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json(); // { ok, path }
}
