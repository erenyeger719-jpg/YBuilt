// client/src/components/PromptInput.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";

interface PromptInputProps {
  onGenerate?: (prompt: string) => Promise<any> | any; // note: promise allowed
  isGenerating?: boolean; // optional, but we’ll run our own local state
}

export default function PromptInput({ onGenerate, isGenerating = false }: PromptInputProps) {
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const busy = isGenerating || submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || busy) return;

    try {
      setSubmitting(true);
      await onGenerate?.(prompt);       // <- await the promise
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto">
      <div className="card-glass p-6 space-y-4">
        <div className="relative">
          <Input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your website or app idea..."
            className="w-full h-14 text-lg bg-background/50 border-border/30 focus:border-primary/50 transition-colors pr-32"
            data-testid="input-prompt"
            disabled={busy}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Button
              type="submit"
              size="default"
              disabled={!prompt.trim() || busy}
              data-testid="button-create"
              className="gap-2"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Create
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>or</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1"
            data-testid="button-explore"
            disabled={busy}
            onClick={() => {
              document.getElementById("showcase")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Explore previews
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </form>
  );
}
