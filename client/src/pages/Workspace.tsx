import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  File,
  Folder,
  Play,
  Save,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Monitor,
  Tablet,
  Smartphone,
  RotateCw,
  Camera,
  Plus,
  FileUp,
  FolderPlus,
} from "lucide-react";
import Header from "@/components/Header";
import BuildTraceViewer from "@/components/BuildTraceViewer";
import ConsolePanel from "@/components/ConsolePanel";
import AgentTools from "@/components/AgentTools";
import BuildPromptPanel from "@/components/BuildPromptPanel";
import CommandPalette from "@/components/CommandPalette";
import PublishModal from "@/components/PublishModal";

interface WorkspaceFile {
  path: string;
  content: string;
  language: string;
}

interface WorkspaceData {
  files: WorkspaceFile[];
  manifest: {
    name: string;
    description: string;
    entryPoint: string;
  };
}

export default function Workspace() {
  const { jobId } = useParams<{ jobId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [showBuildTrace, setShowBuildTrace] = useState(false);
  const [rightTab, setRightTab] = useState<"preview" | "console">("preview");
  const [deviceMode, setDeviceMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [showPublishModal, setShowPublishModal] = useState(false);

  // Fetch workspace data
  const { data: workspace, isLoading } = useQuery<WorkspaceData>({
    queryKey: ["/api/workspace", jobId, "files"],
    enabled: !!jobId,
  });

  // Save file mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) return;
      return apiRequest("PUT", `/api/workspace/${jobId}/files/${selectedFile}`, {
        content: fileContent,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspace", jobId, "files"] });
      toast({
        title: "Saved",
        description: `${selectedFile} saved successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save file",
        variant: "destructive",
      });
    },
  });

  // Build mutation
  const buildMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/jobs/${jobId}/build`, {});
    },
    onSuccess: () => {
      setShowBuildTrace(true);
      toast({
        title: "Building",
        description: "Build started...",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start build",
        variant: "destructive",
      });
    },
  });

  // Load selected file content
  useEffect(() => {
    if (selectedFile && workspace) {
      const file = workspace.files.find((f) => f.path === selectedFile);
      if (file) {
        setFileContent(file.content);
      }
    }
  }, [selectedFile, workspace]);

  // Auto-select first file
  useEffect(() => {
    if (workspace && workspace.files.length > 0 && !selectedFile) {
      setSelectedFile(workspace.files[0].path);
    }
  }, [workspace, selectedFile]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Workspace not found</p>
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

  const selectedFileData = workspace.files.find((f) => f.path === selectedFile);

  const handlePublish = () => {
    setShowPublishModal(true);
    toast({
      title: "Publishing",
      description: "Publish modal would open here",
    });
  };

  const handleRunAgent = (autonomy: string) => {
    toast({
      title: "Running Agent",
      description: `Agent started with ${autonomy} autonomy`,
    });
  };

  const deviceWidths = {
    desktop: "100%",
    tablet: "768px",
    mobile: "375px",
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        showPublish={true}
        logSummary={{
          status: "success",
          lastBuild: "2m ago",
        }}
        onPublish={handlePublish}
      />
      <CommandPalette />
      <PublishModal
        open={showPublishModal}
        onOpenChange={setShowPublishModal}
        jobId={jobId || ""}
      />

      <div className="flex-1 flex pt-16">
        {/* Left Sidebar - File Tree + Tools */}
        <div className="w-80 border-r border-border flex flex-col">
          {/* File Tree Header */}
          <div className="p-3 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">{workspace.manifest.name}</h3>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  data-testid="button-new-file"
                >
                  <Plus className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  data-testid="button-upload-file"
                >
                  <FileUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  data-testid="button-new-folder"
                >
                  <FolderPlus className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{workspace.manifest.description}</p>
          </div>
          
          {/* File List */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
              {workspace.files.map((file) => (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file.path)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover-elevate ${
                    selectedFile === file.path
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground"
                  }`}
                  data-testid={`file-${file.path}`}
                >
                  <File className="w-4 h-4" />
                  {file.path}
                </button>
              ))}
            </div>

            {/* Build Prompt Panel */}
            <div className="p-2">
              <BuildPromptPanel
                jobId={jobId || ""}
                initialPrompt={workspace.manifest.description}
                onRunAgent={handleRunAgent}
                onTestApp={() => toast({ title: "Test", description: "Running tests..." })}
              />
            </div>

            {/* Agent Tools Panel */}
            <div className="p-2">
              <AgentTools jobId={jobId || ""} onRunAgent={handleRunAgent} />
            </div>
          </ScrollArea>

          {/* Build Button */}
          <div className="p-2 border-t border-border">
            <Button
              onClick={() => buildMutation.mutate()}
              disabled={buildMutation.isPending}
              variant="outline"
              className="w-full"
              data-testid="button-build"
            >
              <Play className="w-4 h-4 mr-2" />
              {buildMutation.isPending ? "Building..." : "Build"}
            </Button>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col">
          <div className="h-12 border-b border-border flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <File className="w-4 h-4" />
              <span className="text-sm font-medium">{selectedFile || "No file selected"}</span>
            </div>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !selectedFile}
              size="sm"
              variant="outline"
              data-testid="button-save"
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>

          <div className="flex-1 overflow-hidden">
            {selectedFile && selectedFileData ? (
              <Editor
                height="100%"
                language={selectedFileData.language}
                value={fileContent}
                onChange={(value) => setFileContent(value || "")}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Select a file to edit
              </div>
            )}
          </div>

          {showBuildTrace && (
            <div className="h-64 border-t border-border">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
                <h4 className="text-sm font-semibold">Build Trace</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBuildTrace(false)}
                  data-testid="button-close-trace"
                >
                  Close
                </Button>
              </div>
              <ScrollArea className="h-[calc(100%-40px)]">
                <BuildTraceViewer jobId={jobId || ""} />
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Right Column - Preview + Console */}
        <div className="w-[600px] border-l border-border flex flex-col">
          <Tabs value={rightTab} onValueChange={(v) => setRightTab(v as "preview" | "console")} className="flex-1 flex flex-col">
            <div className="flex items-center justify-between border-b border-border px-4">
              <TabsList className="h-12 bg-transparent">
                <TabsTrigger value="preview" className="gap-2" data-testid="tab-preview">
                  <Monitor className="h-4 w-4" />
                  PREVIEW
                </TabsTrigger>
                <TabsTrigger value="console" className="gap-2" data-testid="tab-console">
                  CONSOLE
                </TabsTrigger>
              </TabsList>

              {rightTab === "preview" && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant={deviceMode === "desktop" ? "secondary" : "ghost"}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setDeviceMode("desktop")}
                      data-testid="button-device-desktop"
                    >
                      <Monitor className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={deviceMode === "tablet" ? "secondary" : "ghost"}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setDeviceMode("tablet")}
                      data-testid="button-device-tablet"
                    >
                      <Tablet className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={deviceMode === "mobile" ? "secondary" : "ghost"}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setDeviceMode("mobile")}
                      data-testid="button-device-mobile"
                    >
                      <Smartphone className="h-4 w-4" />
                    </Button>
                  </div>

                  <Separator orientation="vertical" className="h-6" />

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      const iframe = document.querySelector('iframe[data-testid="iframe-preview"]') as HTMLIFrameElement;
                      if (iframe) iframe.src = iframe.src;
                    }}
                    data-testid="button-refresh-preview"
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => window.open(`/previews/${jobId}/index.html`, "_blank")}
                    data-testid="button-open-preview-new-tab"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    data-testid="button-screenshot"
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <TabsContent value="preview" className="flex-1 m-0 overflow-hidden">
              <div className="flex items-center justify-center h-full bg-muted/10">
                <div
                  style={{
                    width: deviceWidths[deviceMode],
                    height: "100%",
                    maxWidth: "100%",
                    transition: "width 0.3s ease",
                  }}
                  className="bg-white shadow-lg"
                >
                  <iframe
                    src={`/previews/${jobId}/${workspace.manifest.entryPoint}`}
                    className="w-full h-full border-0"
                    title="Live Preview"
                    data-testid="iframe-preview"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="console" className="flex-1 m-0 overflow-hidden">
              <ConsolePanel jobId={jobId || ""} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
