import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Play,
  TestTube,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BuildPromptPanelProps {
  jobId: string;
  initialPrompt?: string;
  onRunAgent?: (prompt: string, autonomy: string) => void;
  onTestApp?: () => void;
}

export default function BuildPromptPanel({
  jobId,
  initialPrompt = "",
  onRunAgent,
  onTestApp,
}: BuildPromptPanelProps) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [autonomyLevel, setAutonomyLevel] = useState("medium");
  const [isExpanded, setIsExpanded] = useState(true);

  // Mutation to run agent with prompt
  const runAgentMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/jobs/${jobId}/build`, {
        autonomy: autonomyLevel,
        prompt: prompt.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      toast({
        title: "Agent Started",
        description: `Running build with ${autonomyLevel} autonomy`,
      });
      if (onRunAgent) {
        onRunAgent(prompt, autonomyLevel);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Start Agent",
        description: error.message || "Failed to start agent build",
        variant: "destructive",
      });
    },
  });

  const handleRunAgent = () => {
    if (prompt.trim()) {
      runAgentMutation.mutate();
    }
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-3 hover-elevate">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="font-semibold text-sm">Build Prompt</span>
            </div>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 space-y-4">
            {/* Original Prompt Display */}
            {initialPrompt && (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Original Prompt
                </Label>
                <div className="p-2 rounded bg-muted/30 text-xs text-muted-foreground">
                  {initialPrompt}
                </div>
              </div>
            )}

            {/* Prompt Refinement */}
            <div className="space-y-2">
              <Label htmlFor="prompt-refinement" className="text-xs font-medium">
                Refinement Prompt
              </Label>
              <Textarea
                id="prompt-refinement"
                placeholder="Describe changes you want the agent to make..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="resize-none h-20 text-xs"
                data-testid="textarea-prompt"
              />
            </div>

            {/* Autonomy Level Selector */}
            <div className="space-y-2">
              <Label htmlFor="autonomy-select" className="text-xs font-medium">
                Autonomy Level
              </Label>
              <Select value={autonomyLevel} onValueChange={setAutonomyLevel}>
                <SelectTrigger id="autonomy-select" className="h-8" data-testid="select-autonomy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-blue-500">Low</Badge>
                      <span className="text-xs text-muted-foreground">Suggest only</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="medium">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-green-500">Medium</Badge>
                      <span className="text-xs text-muted-foreground">Code edits</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="high">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-yellow-500">High</Badge>
                      <span className="text-xs text-muted-foreground">Tests & lint</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="max">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-red-500">Max</Badge>
                      <span className="text-xs text-muted-foreground">Full build</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <Button
                onClick={handleRunAgent}
                disabled={!prompt.trim() || runAgentMutation.isPending}
                className="w-full gap-2"
                data-testid="button-run-agent-prompt"
              >
                <Play className="h-4 w-4" />
                {runAgentMutation.isPending ? "Starting..." : "Run Agent"}
              </Button>

              <Button
                variant="outline"
                onClick={onTestApp}
                className="w-full gap-2"
                data-testid="button-test-app-prompt"
              >
                <TestTube className="h-4 w-4" />
                Test App
              </Button>
            </div>

            {/* Hint */}
            <p className="text-xs text-muted-foreground text-center">
              Agent will analyze and apply changes based on your prompt
            </p>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
