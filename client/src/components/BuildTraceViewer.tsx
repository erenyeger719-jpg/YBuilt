import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Download, Play, CheckCircle2, XCircle, Clock } from "lucide-react";

interface LogEntry {
  timestamp: string;
  stage: "GENERATION" | "ASSEMBLY" | "LINT" | "STATIC-BUILD" | "ERROR";
  message: string;
  details?: any;
}

interface BuildTraceViewerProps {
  jobId: string;
}

const stageIcons = {
  GENERATION: <Clock className="w-4 h-4 text-blue-500" />,
  ASSEMBLY: <Clock className="w-4 h-4 text-yellow-500" />,
  LINT: <Clock className="w-4 h-4 text-purple-500" />,
  "STATIC-BUILD": <CheckCircle2 className="w-4 h-4 text-green-500" />,
  ERROR: <XCircle className="w-4 h-4 text-red-500" />,
};

export default function BuildTraceViewer({ jobId }: BuildTraceViewerProps) {
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());

  const { data: logs = [], isLoading } = useQuery<LogEntry[]>({
    queryKey: ["/api/jobs", jobId, "logs"],
    refetchInterval: 3000,
  });

  const toggleStage = (stage: string) => {
    const newExpanded = new Set(expandedStages);
    if (newExpanded.has(stage)) {
      newExpanded.delete(stage);
    } else {
      newExpanded.add(stage);
    }
    setExpandedStages(newExpanded);
  };

  const groupedLogs = logs.reduce((acc, log) => {
    if (!acc[log.stage]) {
      acc[log.stage] = [];
    }
    acc[log.stage].push(log);
    return acc;
  }, {} as Record<string, LogEntry[]>);

  const handleDownload = () => {
    const transcript = logs
      .map(log => `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.stage}: ${log.message}`)
      .join("\n");
    
    const blob = new Blob([transcript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `build-trace-${jobId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Loading build trace...
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        No build logs available yet
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Build Trace</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            data-testid="button-download-logs"
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {Object.entries(groupedLogs).map(([stage, stageLogs]) => {
            const isExpanded = expandedStages.has(stage);
            const latestLog = stageLogs[stageLogs.length - 1];

            return (
              <Card key={stage} className="overflow-hidden" data-testid={`card-stage-${stage.toLowerCase()}`}>
                <Collapsible open={isExpanded} onOpenChange={() => toggleStage(stage)}>
                  <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover-elevate" data-testid={`trigger-stage-${stage.toLowerCase()}`}>
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      {stageIcons[stage as keyof typeof stageIcons]}
                      <span className="font-medium">{stage}</span>
                      <span className="text-sm text-muted-foreground">
                        {stageLogs.length} {stageLogs.length === 1 ? "entry" : "entries"}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(latestLog.timestamp).toLocaleTimeString()}
                    </span>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="border-t border-border bg-muted/30 p-4 space-y-2">
                      {stageLogs.map((log, index) => (
                        <div key={index} className="flex flex-col gap-1" data-testid={`log-entry-${index}`}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm flex-1">{log.message}</p>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          {log.details && (
                            <pre className="text-xs bg-background/50 p-2 rounded overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
