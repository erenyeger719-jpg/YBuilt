import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import InviteDialog from "@/components/teams/InviteDialog";

type Team = {
  id: string;
  name: string;
  ownerId: string;
  members: { userId: string; role: "owner"|"admin"|"editor"|"viewer" }[];
};
type Invite = {
  id: string; teamId: string; email: string; role: "editor"|"viewer";
  token: string; status: "pending"|"accepted"|"revoked"; createdAt: number;
};

export default function TeamHome(){
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<Team|null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [session, setSession] = useState<any>(null);

  useEffect(()=>{ (async()=>{
    try{
      const s = await fetch("/api/session").then(r=>r.json());
      setSession(s);
      const id = s?.currentTeam?.id;
      if(!id){ setLoading(false); return; }
      const d = await fetch(`/api/teams/${id}`).then(r=>r.json());
      if(d?.ok){ setTeam(d.team); setInvites(d.invites||[]); }
    } finally { setLoading(false); }
  })(); },[]);

  const meRole = useMemo(()=>{
    if(!team || !session?.user?.id) return null;
    if(team.ownerId===session.user.id) return "owner";
    return team.members.find((m:any)=>m.userId===session.user.id)?.role || null;
  },[team, session]);

  const canAdmin = meRole==="owner" || meRole==="admin";

  async function setRole(userId:string, role:"admin"|"editor"|"viewer"){
    if(!team) return;
    await fetch("/api/teams/role",{ method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ teamId: team.id, userId, role })});
    const d = await fetch(`/api/teams/${team.id}`).then(r=>r.json());
    if(d?.ok){ setTeam(d.team); setInvites(d.invites||[]); }
  }

  async function removeMember(userId:string){
    if(!team) return;
    if(!confirm("Remove this member?")) return;
    await fetch("/api/teams/removeMember",{ method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ teamId: team.id, userId })});
    const d = await fetch(`/api/teams/${team.id}`).then(r=>r.json());
    if(d?.ok){ setTeam(d.team); setInvites(d.invites||[]); }
  }

  async function revokeInvite(inviteId:string){
    await fetch("/api/teams/invites/revoke",{ method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ inviteId })});
    if(team){
      const d = await fetch(`/api/teams/${team.id}`).then(r=>r.json());
      if(d?.ok){ setTeam(d.team); setInvites(d.invites||[]); }
    }
  }

  async function resendInvite(inviteId:string){
    const r = await fetch("/api/teams/invites/resend",{ method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ inviteId })});
    const d = await r.json();
    if(team){
      const dd = await fetch(`/api/teams/${team.id}`).then(rr=>rr.json());
      if(dd?.ok){ setTeam(dd.team); setInvites(dd.invites||[]); }
    }
    if(d?.token){
      const link = `${window.location.origin}/invite/${d.token}`;
      try { await navigator.clipboard.writeText(link); alert("Invite link copied"); } catch {}
    }
  }

  if(loading) return <div className="min-h-screen"><Header/><div className="max-w-5xl mx-auto px-4 pt-28">Loading…</div></div>;

  if(!team){
    return (
      <div className="min-h-screen">
        <Header />
        <div className="max-w-3xl mx-auto px-4 pt-28 space-y-4">
          <h1 className="text-xl font-semibold">Team</h1>
          <p>You’re not in a team yet. Create one from the header switcher, then come back.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="max-w-5xl mx-auto px-4 pt-28 space-y-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{team.name}</h1>
          <div className="ml-auto flex items-center gap-2">
            <InviteDialog />
          </div>
        </div>

        {/* Members */}
        <section className="space-y-2">
          <h2 className="text-lg font-medium">Members</h2>
          <div className="border rounded divide-y">
            {/* owner */}
            <Row
              label={`${team.ownerId} (owner)`}
              role="owner"
              canAdmin={false}
              onChangeRole={()=>{}}
              onRemove={()=>{}}
            />
            {team.members
              .filter(m=>m.userId!==team.ownerId)
              .map(m=>(
                <Row
                  key={m.userId}
                  label={m.userId}
                  role={m.role}
                  canAdmin={!!canAdmin}
                  onChangeRole={(r)=>setRole(m.userId, r as any)}
                  onRemove={()=>removeMember(m.userId)}
                />
              ))}
          </div>
        </section>

        {/* Invites */}
        <section className="space-y-2">
          <h2 className="text-lg font-medium">Pending Invites</h2>
          {!invites.length && <div className="text-sm text-muted-foreground">No invites yet.</div>}
          <div className="border rounded divide-y">
            {invites.map(inv=>(
              <div key={inv.id} className="p-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-sm">{inv.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {inv.role} • {inv.status} • {new Date(inv.createdAt).toLocaleString()}
                  </div>
                </div>
                <Button
                  variant="outline" size="sm"
                  onClick={async ()=>{
                    const link = `${window.location.origin}/invite/${inv.token}`;
                    try { await navigator.clipboard.writeText(link); } catch {}
                    alert("Invite link copied");
                  }}
                >Copy link</Button>
                <Button
                  variant="outline" size="sm"
                  onClick={()=>resendInvite(inv.id)}
                  disabled={!canAdmin}
                >Resend</Button>
                <Button
                  variant="destructive" size="sm"
                  onClick={()=>revokeInvite(inv.id)}
                  disabled={!canAdmin}
                >Revoke</Button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Row({
  label, role, canAdmin, onChangeRole, onRemove
}:{
  label:string;
  role:"owner"|"admin"|"editor"|"viewer";
  canAdmin:boolean;
  onChangeRole:(r:"admin"|"editor"|"viewer")=>void;
  onRemove:()=>void;
}){
  return (
    <div className="p-3 flex items-center gap-3">
      <div className="flex-1 text-sm">{label}</div>
      <select
        className="text-xs border rounded px-2 py-1 bg-transparent"
        value={role}
        onChange={(e)=>onChangeRole(e.target.value as any)}
        disabled={!canAdmin || role==="owner"}
        title={role==="owner" ? "Owner role cannot change" : "Change role"}
      >
        <option value="owner" disabled>owner</option>
        <option value="admin">admin</option>
        <option value="editor">editor</option>
        <option value="viewer">viewer</option>
      </select>
      <Button
        variant="destructive" size="sm"
        onClick={onRemove}
        disabled={!canAdmin || role==="owner"}
      >Remove</Button>
    </div>
  );
}
