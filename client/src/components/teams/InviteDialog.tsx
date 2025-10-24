import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function InviteDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor"|"viewer">("editor");
  const [teamId, setTeamId] = useState<string>("");

  async function readSession(){
    const r = await fetch("/api/session"); const d = await r.json();
    if (d?.currentTeam?.id) setTeamId(d.currentTeam.id);
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={async ()=>{ await readSession(); setOpen(true); }}>
        Invite
      </Button>
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]">
          <div className="bg-background border rounded p-4 w-[360px]">
            <div className="font-medium mb-2">Invite to team</div>
            <input
              className="w-full border rounded px-2 py-1 mb-2 bg-transparent"
              placeholder="person@example.com"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
            />
            <select
              className="w-full border rounded px-2 py-1 mb-3 bg-transparent"
              value={role}
              onChange={(e)=>setRole(e.target.value as any)}
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={()=>setOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                onClick={async ()=>{
                  if(!teamId) return alert("No team selected");
                  const r = await fetch("/api/teams/invite", {
                    method:"POST", headers:{ "Content-Type":"application/json" },
                    body: JSON.stringify({ teamId, email, role })
                  });
                  const d = await r.json();
                  if(!r.ok || !d?.ok) return alert(d?.error || "Invite failed");
                  // Handy: show token so you can test the accept flow
                  await navigator.clipboard.writeText(d.invite.token);
                  alert("Invite sent. Token copied to clipboard (for testing).");
                  setOpen(false);
                }}
              >Send</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
