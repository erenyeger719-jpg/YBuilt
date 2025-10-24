import { useEffect } from "react";
import { useLocation, useParams } from "wouter";

export default function AcceptInvite(){
  const { token } = useParams<{ token: string }>();
  const [, setLoc] = useLocation();

  useEffect(()=>{ (async ()=>{
    if(!token) return setLoc("/library");
    const r = await fetch("/api/teams/accept", {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ token })
    });
    const d = await r.json();
    if(!r.ok || !d?.ok) {
      alert(d?.error || "Invalid invite");
      setLoc("/library");
      return;
    }
    // Switch to that team immediately so Library reflects it
    await fetch("/api/teams/switch", {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ teamId: d.teamId })
    });
    setLoc("/library");
  })(); }, [token, setLoc]);

  return <div className="pt-24 text-center text-sm text-muted-foreground">Joining team…</div>;
}
