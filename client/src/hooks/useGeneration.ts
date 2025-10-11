import { useState, useEffect } from "react";

interface JobStatus {
  id: string;
  status: "created" | "queued" | "generating" | "ready_for_finalization" | "editing" | "building" | "deploying" | "published" | "failed" | "cancelled";
  result?: string;
  createdAt: string;
}

export function useGeneration() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  // Poll for job status
  useEffect(() => {
    if (!jobId) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/jobs/${jobId}`);
        if (!response.ok) throw new Error("Failed to fetch job status");
        
        const data: JobStatus = await response.json();
        setStatus(data);

        // Handle different terminal states
        if (data.status === "ready_for_finalization") {
          clearInterval(pollInterval);
          setIsGenerating(false);
          // Redirect to finalize page
          setRedirectUrl(`/finalize/${jobId}`);
        } else if (data.status === "failed" || data.status === "cancelled") {
          clearInterval(pollInterval);
          setIsGenerating(false);
          
          if (data.status === "failed") {
            setError("Generation failed. Please try again.");
          }
        }
      } catch (err) {
        console.error("Error polling job:", err);
        setError("Error checking generation status");
        clearInterval(pollInterval);
        setIsGenerating(false);
      }
    }, 1000); // Poll every second

    return () => clearInterval(pollInterval);
  }, [jobId]);

  const generate = async (prompt: string) => {
    try {
      setIsGenerating(true);
      setError(null);
      setStatus(null);

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) throw new Error("Failed to generate");
      
      const data = await response.json();
      setJobId(data.jobId);
    } catch (err) {
      console.error("Error starting generation:", err);
      setError("Failed to start generation");
      setIsGenerating(false);
    }
  };

  const reset = () => {
    setJobId(null);
    setStatus(null);
    setIsGenerating(false);
    setError(null);
    setRedirectUrl(null);
  };

  return {
    generate,
    reset,
    isGenerating,
    status,
    error,
    redirectUrl,
  };
}
