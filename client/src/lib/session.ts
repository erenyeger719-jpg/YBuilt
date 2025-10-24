export async function getSession() {
  const r = await fetch("/api/session");
  const d = await r.json();
  if (!r.ok || !d?.ok) throw new Error(d?.error || "session failed");
  return d as { user:any, currentTeam:any, teams:any[] };
}
export async function switchTeam(teamId: string) {
  const r = await fetch("/api/teams/switch", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamId })
  });
  if (!r.ok) throw new Error(await r.text());
}
