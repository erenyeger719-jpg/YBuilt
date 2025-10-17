// client/src/pages/Hero.tsx
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
  // try several shapes
  return (
    (resp as any).jobId ||
    (resp as any).id ||
    (resp as any).job?.id ||
    (resp as any).data?.jobId ||
    (resp as any).data?.id
  );
}

// hard timeout so UI never hangs forever
function withTimeout<T>(p: Promise<T>, ms = 25000) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(Object.assign(new Error("Timed out"), { status: 408 })),
      ms
    );
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
      // ✅ real endpoint in your server
      return await withTimeout(
        apiRequest<CreateResp>("POST", "/api/generate", body)
      );
    },
    onSuccess: (resp) => {
      const id = getJobIdAny(resp);
      if (id) {
        // Hard redirect so we definitely leave the hero page
        window.location.assign(`/workspace/${id}`);
        return;
      }
      toast({
        title: "Couldn’t start workspace",
        description: "No job id in response.",
        variant: "destructive",
      });
    },
    onError: (err: any) => {
      if (err?.status === 401) {
        toast({
          title: "Sign in required",
          description: "Please sign in to create a project.",
          variant: "destructive",
        });
        return;
      }
      const msg =
        err?.message ||
        err?.statusText ||
        (typeof err === "string" ? err : "Request failed");
      const code = err?.status || "";
      toast({
        title: "Create failed",
        description: code ? `${code}: ${msg}` : msg,
        variant: "destructive",
      });
    },
  });

  // Return the promise so PromptInput can stop its own spinner, too
  function handleCreate(promptText: string) {
    const prompt = promptText?.trim();
    if (!prompt) return Promise.resolve();
    return createJobMutation.mutateAsync({ prompt });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <PromptInput
        isGenerating={createJobMutation.isPending}
        onGenerate={handleCreate}
      />
    </div>
  );
}
