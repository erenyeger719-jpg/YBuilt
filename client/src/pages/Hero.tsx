// client/src/pages/Hero.tsx
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import PromptInput from "@/components/PromptInput";

type CreateResp =
  | { jobId: string }
  | { id: string }
  | { job?: { id?: string } }
  | Record<string, any>;

// Extract a job/workspace id regardless of response shape
function getJobIdAny(resp: CreateResp | undefined) {
  if (!resp) return undefined;
  return (resp as any).jobId || (resp as any).id || (resp as any).job?.id;
}

// Timeout guard so we fail fast instead of hanging forever
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
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Robust creator: tries the modern endpoint, falls back to legacy path if needed
  const createJobMutation = useMutation({
    mutationFn: async (payload: { prompt: string }) => {
      // send both keys to satisfy either server shape
      const body = { prompt: payload.prompt, promptText: payload.prompt };

      try {
        // Primary (modern) endpoint with timeout
        return await withTimeout(
          apiRequest<CreateResp>("POST", "/api/jobs", body)
        );
      } catch (e: any) {
        // Fallback for older pathing
        if (e?.status === 404) {
          return await withTimeout(
            apiRequest<CreateResp>("POST", "/api/workspace", body)
          );
        }
        throw e;
      }
    },
    onSuccess: (resp) => {
      // Optional: inspect what came back
      // console.log("[create] raw response:", resp);
      const id = getJobIdAny(resp);
      if (id) {
        // route to studio flow
        setLocation(`/studio/${id}`);
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

  // Return the promise so upstream UI (PromptInput) can await it
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
