// client/src/pages/Hero.tsx
import { useToast } from "@/hooks/use-toast";
import PromptInput from "@/components/PromptInput";

export default function HeroPage() {
  const { toast } = useToast();

  async function handleCreate(promptText: string) {
    const prompt = promptText?.trim();
    if (!prompt) return;

    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, promptText: prompt })
      });

      const ct = r.headers.get("content-type") || "";
      const raw = await r.text();
      const data = ct.includes("application/json") && raw ? JSON.parse(raw) : {};
      if (!r.ok) {
        const msg = data?.message || data?.error || r.statusText || "Request failed";
        const err: any = new Error(msg);
        err.status = r.status;
        err.body = data;
        throw err;
      }

      const id =
        data.jobId ||
        data.id ||
        data?.job?.id ||
        data?.data?.jobId ||
        data?.data?.id;

      console.log("[create] status:", r.status, "resp:", data, "→ id:", id);
      if (!id) throw new Error("No jobId in response");

      // Hard redirect so router/state can’t swallow it
      window.location.assign(`/workspace/${id}`);
    } catch (err: any) {
      if (err?.status === 401) {
        toast({
          title: "Sign in required",
          description: "Please sign in to create a project.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Create failed",
        description: err?.message || "Request failed",
        variant: "destructive",
      });
      throw err; // let PromptInput stop its own spinner via finally
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <PromptInput onGenerate={handleCreate} />
    </div>
  );
}
