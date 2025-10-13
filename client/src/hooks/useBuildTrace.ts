import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BuildTrace, BuildStage, BuildLogEntry } from "@shared/schema";

interface SSEEvent {
  type: "stage-status" | "log" | "artifact" | "complete";
  stage?: BuildStage;
  status?: "pending" | "running" | "success" | "failed";
  log?: BuildLogEntry;
  artifact?: { label: string; url: string };
}

export function useBuildTrace(jobId: string, enabled: boolean = true) {
  const [liveTrace, setLiveTrace] = useState<BuildTrace | null>(null);

  // Initial fetch of build trace
  const { data: initialTrace, isLoading } = useQuery<BuildTrace>({
    queryKey: ["/api/jobs", jobId, "build-trace"],
    enabled: enabled && !!jobId,
    refetchInterval: false,
  });

  // Set initial trace when loaded
  useEffect(() => {
    if (initialTrace) {
      setLiveTrace(initialTrace);
    }
  }, [initialTrace]);

  // Set up SSE stream for real-time updates
  useEffect(() => {
    if (!enabled || !jobId || !initialTrace) return;

    const eventSource = new EventSource(`/api/jobs/${jobId}/build-trace/stream`);

    eventSource.onmessage = (event) => {
      try {
        const sseEvent: SSEEvent = JSON.parse(event.data);

        setLiveTrace((prev) => {
          if (!prev) return prev;

          const updated = { ...prev };

          switch (sseEvent.type) {
            case "stage-status":
              if (sseEvent.stage && sseEvent.status) {
                updated.currentStage = sseEvent.stage;
                updated.stages[sseEvent.stage] = {
                  ...updated.stages[sseEvent.stage],
                  status: sseEvent.status,
                  startedAt: sseEvent.status === "running" ? new Date().toISOString() : updated.stages[sseEvent.stage].startedAt,
                  completedAt: sseEvent.status === "success" || sseEvent.status === "failed" ? new Date().toISOString() : undefined,
                };
              }
              break;

            case "log":
              if (sseEvent.log && sseEvent.stage) {
                updated.stages[sseEvent.stage].logs.push(sseEvent.log);
              }
              break;

            case "artifact":
              if (sseEvent.artifact && sseEvent.stage) {
                if (!updated.stages[sseEvent.stage].artifacts) {
                  updated.stages[sseEvent.stage].artifacts = [];
                }
                updated.stages[sseEvent.stage].artifacts!.push(sseEvent.artifact);
              }
              break;

            case "complete":
              // Stream complete, no action needed
              break;
          }

          return updated;
        });
      } catch (error) {
        console.error("Error parsing SSE event:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE error:", error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [enabled, jobId, initialTrace]);

  return {
    trace: liveTrace,
    isLoading,
  };
}
