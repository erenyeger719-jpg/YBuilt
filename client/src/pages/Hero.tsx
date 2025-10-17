import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import PromptInput from "@/components/PromptInput";

type CreateResp =
  | { jobId?: string; id?: string; job?: { id?: string } }
  | { data?: { jobId?: string; id?: string } }
  | Record<string, any>;

function getJobIdAny(resp: CreateResp | undefined) {
  if (!resp) return undefined;
  return (
    (resp as any).jobId ||
    (resp as any).id ||
    (resp as any).job?.id ||
    (resp as any).data?.jobId ||
    (resp as any).data?.id
  );
}

function withTimeout<T>(p: Promise<T>, ms = 25000) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error("Timed out"), { status: 408 })), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export default function HeroPage() {
  const { toast } = useToast();

  const createJobMutation = useMutation({
    mutationFn: async (payload: { prompt: string }) => {
      const body = { prompt: payload.prompt, promptText: payload.prompt };
      return await withTimeout(apiRequest<CreateResp>("POST", "/api/generate", body));
    },
    retry: false,
  });

  async function handleCreate(promptText: string) {
    try {
      const resp = await createJobMutation.mutateAsync({ prompt: promptText });

      // Your server returns { jobId: "..." } on 201
      const id = (resp as any)?.jobId || (resp as any)?.id;
      console.log("[create] response:", resp, "→ id:", id);

      if (!id) throw new Error("No jobId in response");

      // Hard redirect so nothing in the SPA can swallow it
      window.location.replace(`/workspace/${id}`);
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
      throw err; // let PromptInput clear its spinner via finally
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <PromptInput onGenerate={handleCreate} />
    </div>
  );
}
