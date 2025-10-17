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
    const t = setTimeout(
      () => reject(Object.assign(new Error("Timed out"), { status: 408 })),
      ms
    );
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

export default function HeroPage() {
  const { toast } = useToast();

  // bare mutation (no onSuccess/onError)
  const createJobMutation = useMutation({
    mutationFn: async (payload: { prompt: string }) => {
      const body = { prompt: payload.prompt, promptText: payload.prompt };
      return await withTimeout(
        apiRequest<CreateResp>("POST", "/api/generate", body)
      );
    },
    retry: false,
  });

  // IMPORTANT: await the mutate promise here, then redirect here.
  async function handleCreate(promptText: string) {
    const prompt = promptText?.trim();
    if (!prompt) return;

    try {
      const resp = await createJobMutation.mutateAsync({ prompt });
      const id = getJobIdAny(resp);

      if (!id) {
        toast({
          title: "Couldn’t start workspace",
          description: "No job id in response.",
          variant: "destructive",
        });
        return;
      }

      // Go to the finalize (studio) flow first — like before
      window.location.assign(`/studio/${id}`);
    } catch (err: any) {
      if (err?.status === 401) {
        toast({
          title: "Sign in required",
          description: "Please sign in to create a project.",
          variant: "destructive",
        });
        return;
      }
      const msg =
        err?.message || err?.statusText || (typeof err === "string" ? err : "Request failed");
      const code = err?.status || "";
      toast({
        title: "Create failed",
        description: code ? `${code}: ${msg}` : msg,
        variant: "destructive",
      });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <PromptInput
        isGenerating={createJobMutation.isPending}
        onGenerate={handleCreate} // PromptInput will await this
      />
    </div>
  );
}
