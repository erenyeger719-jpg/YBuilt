// client/src/pages/Hero.tsx
import { useToast } from "@/hooks/use-toast";
import PromptInput from "@/components/PromptInput";

export default function HeroPage() {
  const { toast } = useToast();

  async function handleCreate(promptText: string) {
    const prompt = promptText.trim();
    if (!prompt) return;

    try {
      console.log("[create] starting fetch → /api/generate", { prompt });
      const r = await fetch("/api/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, promptText: prompt }),
      });

      const ct = r.headers.get("content-type") || "";
      const raw = await r.text();
      const data = ct.includes("application/json") && raw ? JSON.parse(raw) : {};
      console.log("[create] status:", r.status, "data:", data);

      if (!r.ok) {
        const msg = data?.message || data?.error || r.statusText || "Request failed";
        const err: any = new Error(msg);
        err.status = r.status;
        err.body = data;
        throw err;
      }

      const id = data.jobId || data.id || data?.job?.id || data?.data?.jobId || data?.data?.id;
      if (!id) throw new Error("No jobId in response");

      // Hard redirect; also belt-and-suspenders with href after a tick
      const target = `/workspace/${id}`;
      console.log("[create] redirect →", target);
      window.location.assign(target);
      setTimeout(() => (window.location.href = target), 50);
    } catch (err: any) {
      if (err?.status === 401) {
        toast({
          title: "Sign in required",
          description: "Please sign in to create a project.",
          variant: "destructive",
        });
        return;
      }
      console.error("[create] error:", err);
      toast({
        title: "Create failed",
        description: err?.message || "Request failed",
        variant: "destructive",
      });
      throw err; // lets PromptInput clear spinner in finally
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <PromptInput onGenerate={handleCreate} />
    </div>
  );
}
