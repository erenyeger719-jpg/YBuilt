export async function aiPlan(prompt: string, tier: "fast"|"balanced"|"best" = "balanced") {
  const r = await fetch("/api/ai/plan", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ prompt, tier }) });
  const d = await r.json(); if(!r.ok || !d?.ok) throw new Error(d?.error||"plan failed"); return d;
}
export async function aiScaffold(body: {prompt?: string, plan?: any, tier?: "fast"|"balanced"|"best"}) {
  const r = await fetch("/api/ai/scaffold", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) });
  const d = await r.json(); if(!r.ok || !d?.ok) throw new Error(d?.error||"scaffold failed"); return d;
}
