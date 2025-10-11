import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Save, ArrowRight, RefreshCw } from "lucide-react";
import Header from "@/components/Header";
import AIDesigner from "@/components/AIDesigner";
import BuildTraceViewer from "@/components/BuildTraceViewer";

interface Job {
  id: string;
  prompt: string;
  status: string;
  result: string | null;
  error: string | null;
  settings: string | null;
}

export default function Finalize() {
  const { jobId } = useParams<{ jobId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [designData, setDesignData] = useState<any>({});
  const [regenerationScope, setRegenerationScope] = useState<string>("full-site");

  // Fetch job details
  const { data: job, isLoading } = useQuery<Job>({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId,
    refetchInterval: 3000,
  });

  // Save draft to library mutation
  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/drafts", {
        jobId,
        userId: "demo",
        ...(designData || {}),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Draft saved to library",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save draft",
        variant: "destructive",
      });
    },
  });

  // Select and open workspace mutation
  const selectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/jobs/${jobId}/select`, {
        draftEdits: designData || {},
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Success",
        description: "Opening workspace...",
      });
      setLocation(data.workspaceUrl);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to open workspace",
        variant: "destructive",
      });
    },
  });

  // Regenerate with scope mutation
  const regenerateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/jobs/${jobId}/regenerate`, {
        scope: regenerationScope,
        draftEdits: designData || {},
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      toast({
        title: "Success",
        description: `Regenerating ${regenerationScope}...`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to regenerate",
        variant: "destructive",
      });
    },
  });

  // Load initial data from job.settings
  useEffect(() => {
    if (job?.settings) {
      try {
        const settings = JSON.parse(job.settings);
        setDesignData(settings);
      } catch (error) {
        console.error("Failed to parse job settings:", error);
      }
    } else if (job?.prompt) {
      setDesignData({
        title: "",
        description: "",
        theme: "monochrome",
        heroText: job.prompt,
      });
    }
  }, [job]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading draft...</p>
        </div>
      </div>
    );
  }

  if (!job || job.status !== "ready_for_finalization") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Draft not ready or not found</p>
          <Button
            onClick={() => setLocation("/")}
            variant="outline"
            className="mt-4"
            data-testid="button-back-home"
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="pt-16 flex h-[calc(100vh-4rem)]">
        {/* Left: AI Designer & Build Trace Tabs */}
        <div className="w-96 border-r border-border">
          <Tabs defaultValue="designer" className="h-full flex flex-col">
            <TabsList className="w-full rounded-none border-b" data-testid="tabs-list">
              <TabsTrigger value="designer" className="flex-1" data-testid="tab-designer">
                AI Designer
              </TabsTrigger>
              <TabsTrigger value="trace" className="flex-1" data-testid="tab-trace">
                Build Trace
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="designer" className="flex-1 overflow-y-auto m-0" data-testid="content-designer">
              <AIDesigner
                jobId={jobId || ""}
                initialData={designData}
                onUpdate={setDesignData}
              />
            </TabsContent>
            
            <TabsContent value="trace" className="flex-1 overflow-y-auto m-0" data-testid="content-trace">
              <BuildTraceViewer jobId={jobId || ""} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Center: Preview */}
        <div className="flex-1 p-4">
          <div className="h-full card-glass rounded-lg overflow-hidden">
            <div className="gloss-sheen" />
            <div className="relative z-10 h-full">
              {job.result ? (
                <iframe
                  src={job.result}
                  className="w-full h-full border-0"
                  title="Preview"
                  data-testid="iframe-preview"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">No preview available</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions Panel */}
        <div className="w-80 p-6 space-y-6 overflow-y-auto border-l border-border">
          <div>
            <h2 className="text-2xl font-bold mb-2">Actions</h2>
            <p className="text-sm text-muted-foreground">
              Save, regenerate, or open in workspace
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="scope" data-testid="label-scope">Regeneration Scope</Label>
              <Select value={regenerationScope} onValueChange={setRegenerationScope}>
                <SelectTrigger className="mt-1.5" data-testid="select-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full-site">Full Site</SelectItem>
                  <SelectItem value="hero-only">Hero Only</SelectItem>
                  <SelectItem value="navigation">Navigation</SelectItem>
                  <SelectItem value="footer">Footer</SelectItem>
                  <SelectItem value="specific-block">Specific Block</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending || !designData}
              variant="outline"
              className="w-full"
              data-testid="button-regenerate"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {regenerateMutation.isPending ? "Regenerating..." : "Re-generate"}
            </Button>

            <div className="border-t border-border pt-4 space-y-3">
              <Button
                onClick={() => saveDraftMutation.mutate()}
                disabled={saveDraftMutation.isPending || !designData}
                variant="outline"
                className="w-full"
                data-testid="button-save-draft"
              >
                <Save className="w-4 h-4 mr-2" />
                {saveDraftMutation.isPending ? "Saving..." : "Save to Library"}
              </Button>

              <Button
                onClick={() => selectMutation.mutate()}
                disabled={selectMutation.isPending || !designData}
                className="w-full"
                data-testid="button-select-workspace"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                {selectMutation.isPending ? "Opening..." : "Select & Open Workspace"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
