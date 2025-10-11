import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Sparkles, Save, ArrowRight, RefreshCw } from "lucide-react";
import Header from "@/components/Header";

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

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [theme, setTheme] = useState<string>("monochrome");
  const [heroText, setHeroText] = useState("");

  // Fetch job details
  const { data: job, isLoading } = useQuery<Job>({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId,
  });

  // Finalize mutation - moves job to editing state
  const finalizeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/jobs/${jobId}/finalize`, {
        title,
        description,
        theme,
        heroText,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      toast({
        title: "Success",
        description: "Draft finalized! Opening workspace...",
      });
      // Redirect to workspace
      setLocation(`/workspace/${jobId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to finalize draft",
        variant: "destructive",
      });
    },
  });

  // Save draft mutation
  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/jobs/${jobId}/save-draft`, {
        title,
        description,
        theme,
        heroText,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      toast({
        title: "Success",
        description: "Draft saved successfully",
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

  // Load initial form state from job.settings
  useEffect(() => {
    if (job?.settings) {
      try {
        const settings = JSON.parse(job.settings);
        if (settings.title) setTitle(settings.title);
        if (settings.description) setDescription(settings.description);
        if (settings.theme) setTheme(settings.theme);
        if (settings.heroText) setHeroText(settings.heroText);
      } catch (error) {
        console.error("Failed to parse job settings:", error);
      }
    } else if (job?.prompt) {
      // Initialize with prompt-based defaults
      setHeroText(job.prompt);
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
        {/* Left: Preview */}
        <div className="flex-1 border-r border-border p-4">
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
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No preview available
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Tweak Panel */}
        <div className="w-96 p-6 overflow-y-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-2">Finalize Your Website</h1>
            <p className="text-sm text-muted-foreground">
              Customize your draft before opening in the workspace
            </p>
          </div>

          {/* SEO Meta */}
          <div className="space-y-4 mb-6">
            <div>
              <Label htmlFor="title">Page Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter page title"
                data-testid="input-title"
              />
            </div>

            <div>
              <Label htmlFor="description">Meta Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter meta description"
                rows={3}
                data-testid="input-description"
              />
            </div>
          </div>

          {/* Theme Selection */}
          <div className="mb-6">
            <Label htmlFor="theme">Design Theme</Label>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger id="theme" data-testid="select-theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monochrome">Monochrome</SelectItem>
                <SelectItem value="gloss">Gloss & Glass</SelectItem>
                <SelectItem value="game">Game Style</SelectItem>
                <SelectItem value="app-ui">App UI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Hero Text */}
          <div className="mb-6">
            <Label htmlFor="heroText">Hero Text</Label>
            <Textarea
              id="heroText"
              value={heroText}
              onChange={(e) => setHeroText(e.target.value)}
              placeholder="Customize your hero section text"
              rows={3}
              data-testid="input-hero-text"
            />
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={() => finalizeMutation.mutate()}
              disabled={finalizeMutation.isPending}
              className="w-full gap-2"
              data-testid="button-finalize"
            >
              {finalizeMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Finalizing...
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  Select & Open Workspace
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() => saveDraftMutation.mutate()}
              disabled={saveDraftMutation.isPending}
              className="w-full gap-2"
              data-testid="button-save-draft"
            >
              <Save className="w-4 h-4" />
              Save Draft
            </Button>

            <Button
              variant="ghost"
              onClick={() => setLocation("/")}
              className="w-full gap-2"
              data-testid="button-regenerate"
            >
              <Sparkles className="w-4 h-4" />
              Re-generate
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
