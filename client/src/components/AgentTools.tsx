import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Play,
  Zap,
  Shield,
  TestTube,
  Cpu,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface AgentToolsProps {
  jobId: string;
  onRunAgent?: (autonomy: string) => void;
}

export default function AgentTools({ jobId, onRunAgent }: AgentToolsProps) {
  const { toast } = useToast();
  const [autonomyLevel, setAutonomyLevel] = useState(1); // 0=Low, 1=Medium, 2=High, 3=Max
  const [autoApply, setAutoApply] = useState(false);
  const [safetyFilter, setSafetyFilter] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  const autonomyLevels = [
    {
      value: 0,
      label: "Low",
      description: "Agent suggests only, manual apply",
      color: "text-blue-500",
    },
    {
      value: 1,
      label: "Medium",
      description: "Can make code edits, propose tests",
      color: "text-green-500",
    },
    {
      value: 2,
      label: "High",
      description: "Run tests, auto-fix lint, propose builds",
      color: "text-yellow-500",
    },
    {
      value: 3,
      label: "Max",
      description: "Full build, test suite, optional publish",
      color: "text-red-500",
    },
  ];

  const currentLevel = autonomyLevels[autonomyLevel];

  // Mutation to run agent build
  const runAgentMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/jobs/${jobId}/build`, {
        autonomy: currentLevel.label.toLowerCase(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      toast({
        title: "Agent Started",
        description: `Running with ${currentLevel.label} autonomy`,
      });
      if (onRunAgent) {
        onRunAgent(currentLevel.label.toLowerCase());
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
    runAgentMutation.mutate();
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-3 hover-elevate">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span className="font-semibold text-sm">Agent Tools</span>
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
            {/* Autonomy Level */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Autonomy Level</Label>
                <Badge variant="outline" className={currentLevel.color}>
                  {currentLevel.label}
                </Badge>
              </div>
              
              <Slider
                value={[autonomyLevel]}
                onValueChange={(value) => setAutonomyLevel(value[0])}
                max={3}
                step={1}
                className="w-full"
                data-testid="slider-autonomy"
              />

              <p className="text-xs text-muted-foreground">
                {currentLevel.description}
              </p>
            </div>

            <Separator />

            {/* Auto-Apply Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-apply" className="text-xs font-medium">
                  Auto-Apply
                </Label>
                <p className="text-xs text-muted-foreground">
                  {autonomyLevel > 0 ? "Enabled for Medium+" : "Disabled for Low"}
                </p>
              </div>
              <Switch
                id="auto-apply"
                checked={autoApply}
                onCheckedChange={setAutoApply}
                disabled={autonomyLevel === 0}
                data-testid="switch-auto-apply"
              />
            </div>

            {/* Safety Filter */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="safety-filter" className="text-xs font-medium">
                  Safety/Content Scan
                </Label>
                <p className="text-xs text-muted-foreground">
                  Filter unsafe content
                </p>
              </div>
              <Switch
                id="safety-filter"
                checked={safetyFilter}
                onCheckedChange={setSafetyFilter}
                data-testid="switch-safety-filter"
              />
            </div>

            <Separator />

            {/* Compute Tier */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">Compute Tier</Label>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Cpu className="h-3 w-3" />
                <span>Balanced (gpt-5-x)</span>
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="space-y-2">
              <Button
                onClick={handleRunAgent}
                disabled={runAgentMutation.isPending}
                className="w-full gap-2"
                data-testid="button-run-agent"
              >
                <Play className="h-4 w-4" />
                {runAgentMutation.isPending ? "Starting..." : "Run Agent"}
              </Button>

              <Button
                variant="outline"
                className="w-full gap-2"
                data-testid="button-test-app"
              >
                <TestTube className="h-4 w-4" />
                Test App
              </Button>
            </div>

            {/* Status Info */}
            <div className="p-2 rounded bg-muted/30 space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <Shield className="h-3 w-3 text-green-500" />
                <span className="text-muted-foreground">
                  Safety: {safetyFilter ? "Active" : "Disabled"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Zap className={`h-3 w-3 ${currentLevel.color}`} />
                <span className="text-muted-foreground">
                  Mode: {currentLevel.label} Autonomy
                </span>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
