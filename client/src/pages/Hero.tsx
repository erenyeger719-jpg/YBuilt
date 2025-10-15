// client/pages/Hero.tsx
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import PromptInput from "@/components/PromptInput";

type CreateJobResponse = { jobId: string };

export default function HeroPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const createJob = useMutation({
    mutationFn: (prompt: string) =>
      apiRequest<CreateJobResponse>("POST", "/api/generate", { prompt }),
  });

  const handleGenerate = async (prompt: string) => {
    try {
      const { jobId } = await createJob.mutateAsync(prompt);
      setLocation(`/workspace/${jobId}`);
    } catch (e: any) {
      toast({
        title: "Create failed",
        description: e?.message ?? "Could not create project",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <PromptInput
        isGenerating={createJob.isPending}
        onGenerate={handleGenerate}
      />
    </div>
  );
}
