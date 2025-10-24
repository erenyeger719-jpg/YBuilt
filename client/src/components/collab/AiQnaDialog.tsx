import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function AiQnaDialog({
  open, onClose, previewPath, file, questionSeed = "",
}: { open:boolean; onClose:()=>void; previewPath:string; file:string; questionSeed?:string; }) {
  const { toast } = useToast();
  const [q, setQ] = useState(questionSeed);
  const [a, setA] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const aiTier = (localStorage.getItem("ybuilt.aiTier") as any) || "balanced";

  if (!open) return null;

  async function ask() {
    setLoading(true); setA("");
    try {
      const r = await fetch("/api/ai/qna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: previewPath, file, question: q, tier: aiTier }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) throw new Error(data?.error || "qna failed");
      setA(String(data.answer || ""));
    } catch (e:any) {
      toast({ title: "AI failed", description: e?.message || "Error", variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[1200] grid place-items-center p-4">
      <div className="w-full max-w-2xl rounded-lg bg-black/80 text-white border border-white/20 p-4 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium">Ask AI — {file}</h3>
          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
        </div>
        <textarea
          className="w-full h-20 text-sm bg-black/30 border border-white/20 rounded p-2"
          placeholder="What’s your question about this file?"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={ask} disabled={loading || !q.trim()}>
            {loading ? "Thinking…" : "Ask"}
          </Button>
        </div>
        {!!a && (
          <div className="mt-3 text-sm whitespace-pre-wrap bg-black/40 border border-white/15 rounded p-3">
            {a}
          </div>
        )}
      </div>
    </div>
  );
}
