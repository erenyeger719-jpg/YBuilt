import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  Download, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2,
  ChevronRight,
} from "lucide-react";
import { useBuildTrace } from "@/hooks/useBuildTrace";
import { BuildStage, BuildStageTrace } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface BuildTraceViewerProps {
  jobId: string;
  enabled?: boolean;
}

const stageOrder: BuildStage[] = [
  BuildStage.GENERATION,
  BuildStage.ASSEMBLY,
  BuildStage.LINT,
  BuildStage.TEST,
  BuildStage.BUNDLE,
];

const stageLabels: Record<BuildStage, string> = {
  [BuildStage.GENERATION]: "Generation",
  [BuildStage.ASSEMBLY]: "Assembly",
  [BuildStage.LINT]: "Lint",
  [BuildStage.TEST]: "Test",
  [BuildStage.BUNDLE]: "Bundle",
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "running":
      return <Loader2 className="w-4 h-4 animate-spin" />;
    case "success":
      return <CheckCircle2 className="w-4 h-4" />;
    case "failed":
      return <XCircle className="w-4 h-4" />;
    default:
      return <Clock className="w-4 h-4" />;
  }
};

const getStatusVariant = (status: string): "default" | "secondary" | "outline" => {
  switch (status) {
    case "running":
      return "default";
    case "success":
      return "secondary";
    case "failed":
      return "outline";
    default:
      return "outline";
  }
};

const getLevelColor = (level: string): string => {
  switch (level) {
    case "error":
      return "text-destructive";
    case "warn":
      return "text-muted-foreground";
    default:
      return "text-foreground";
  }
};

export default function BuildTraceViewer({ jobId, enabled = true }: BuildTraceViewerProps) {
  const { trace, isLoading } = useBuildTrace(jobId, enabled);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [trace, autoScroll]);

  const handleDownload = async () => {
    if (!trace) return;

    try {
      const response = await fetch(`/api/jobs/${jobId}/build-trace/download`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `build-trace-${jobId}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download transcript:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center text-muted-foreground" data-testid="loading-build-trace">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
        Loading build trace...
      </div>
    );
  }

  if (!trace) {
    return (
      <div className="p-6 text-center text-muted-foreground" data-testid="no-build-trace">
        No build trace available
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="build-trace-viewer">
      {/* Header with stage progress */}
      <div className="border-b border-border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold" data-testid="text-build-trace-title">
            Build Pipeline
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="autoscroll"
                checked={autoScroll}
                onCheckedChange={setAutoScroll}
                data-testid="switch-autoscroll"
              />
              <Label htmlFor="autoscroll" className="text-sm cursor-pointer">
                Auto-scroll
              </Label>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              data-testid="button-download-transcript"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </div>

        {/* Stage progress indicators */}
        <div className="flex items-center gap-2 flex-wrap">
          {stageOrder.map((stage, index) => {
            const stageTrace = trace.stages[stage];
            const isActive = trace.currentStage === stage;
            
            return (
              <div key={stage} className="flex items-center gap-2">
                <Badge
                  variant={getStatusVariant(stageTrace.status)}
                  className="gap-1.5"
                  data-testid={`badge-stage-${stage.toLowerCase()}`}
                >
                  {getStatusIcon(stageTrace.status)}
                  <span>{stageLabels[stage]}</span>
                </Badge>
                {index < stageOrder.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Logs accordion */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4">
          <Accordion type="multiple" defaultValue={stageOrder.map(s => s.toString())}>
            {stageOrder.map((stage) => {
              const stageTrace = trace.stages[stage];
              
              return (
                <AccordionItem 
                  key={stage} 
                  value={stage}
                  data-testid={`accordion-item-${stage.toLowerCase()}`}
                >
                  <AccordionTrigger 
                    className="hover-elevate px-4 py-3 rounded-md"
                    data-testid={`trigger-stage-${stage.toLowerCase()}`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {getStatusIcon(stageTrace.status)}
                      <span className="font-medium">{stageLabels[stage]}</span>
                      <span className="text-sm text-muted-foreground">
                        {stageTrace.logs.length} {stageTrace.logs.length === 1 ? "entry" : "entries"}
                      </span>
                      {stageTrace.completedAt && (
                        <span className="text-xs text-muted-foreground ml-auto mr-4">
                          {new Date(stageTrace.completedAt).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </AccordionTrigger>
                  
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-2">
                      {stageTrace.logs.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">
                          No logs yet
                        </p>
                      ) : (
                        stageTrace.logs.map((log, index) => (
                          <div
                            key={index}
                            className="flex items-start gap-3 text-sm font-mono"
                            data-testid={`log-entry-${stage.toLowerCase()}-${index}`}
                          >
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span className={getLevelColor(log.level)}>
                              {log.message}
                            </span>
                          </div>
                        ))
                      )}

                      {stageTrace.artifacts && stageTrace.artifacts.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <p className="text-sm font-medium mb-2">Artifacts:</p>
                          <div className="space-y-1">
                            {stageTrace.artifacts.map((artifact, index) => (
                              <a
                                key={index}
                                href={artifact.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline block"
                                data-testid={`link-artifact-${index}`}
                              >
                                {artifact.label}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      </ScrollArea>

      {/* Summary footer */}
      {trace.summaryLog && (
        <div className="border-t border-border p-4">
          <p className="text-sm text-muted-foreground" data-testid="text-summary">
            {trace.summaryLog}
          </p>
        </div>
      )}
    </div>
  );
}
