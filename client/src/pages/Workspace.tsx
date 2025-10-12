import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  File,
  ExternalLink,
  Monitor,
  Tablet,
  Smartphone,
  RotateCw,
  Camera,
} from "lucide-react";
import Header from "@/components/Header";
import BuildTraceViewer from "@/components/BuildTraceViewer";
import ConsolePanel from "@/components/ConsolePanel";
import CommandPalette from "@/components/CommandPalette";
import PublishModal from "@/components/PublishModal";
import PromptBar from "@/components/PromptBar";
import AgentButton, { type AgentSettings } from "@/components/AgentButton";
import FileTree from "@/components/FileTree";
import FileToolbar from "@/components/FileToolbar";
import NewChatModal from "@/components/NewChatModal";
import PromptFileModal from "@/components/PromptFileModal";

interface WorkspaceFile {
  path: string;
  content: string;
  language: string;
  type?: string;
  createdAt?: string;
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
  const workspace$ = useWorkspace(jobId || "");

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [showBuildTrace, setShowBuildTrace] = useState(false);
  const [rightTab, setRightTab] = useState<"preview" | "console">("preview");
  const [deviceMode, setDeviceMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showPromptFileModal, setShowPromptFileModal] = useState(false);
  const [selectedPromptFile, setSelectedPromptFile] = useState<WorkspaceFile | null>(null);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderPath, setNewFolderPath] = useState("");
  
  // Agent settings
  const [agentSettings, setAgentSettings] = useState<AgentSettings>({
    autonomyLevel: "medium",
    autoApply: false,
    safetyFilter: true,
    computeTier: "standard",
  });

  // Fetch workspace data with error handling
  const { data: workspace, isLoading, error } = useQuery<WorkspaceData>({
    queryKey: ["/api/workspace", jobId, "files"],
    enabled: !!jobId,
    retry: 2,
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

  // Build mutation with agent settings
  const buildMutation = useMutation({
    mutationFn: async (data: { prompt?: string }) => {
      return apiRequest("POST", `/api/jobs/${jobId}/build`, {
        autonomy: agentSettings.autonomyLevel,
        autoApply: agentSettings.autoApply,
        safetyFilter: agentSettings.safetyFilter,
        computeTier: agentSettings.computeTier,
        prompt: data.prompt,
      });
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

  // Load selected file content with safety checks
  useEffect(() => {
    if (selectedFile && workspace?.files) {
      const file = workspace.files.find((f) => f.path === selectedFile);
      if (file) {
        setFileContent(file.content);
      }
    }
  }, [selectedFile, workspace]);

  // Auto-select first NON-PROMPT file with defensive checks
  useEffect(() => {
    if (workspace?.files?.length && !selectedFile) {
      const firstNonPromptFile = workspace.files.find(f => f.type !== "prompt");
      if (firstNonPromptFile) {
        setSelectedFile(firstNonPromptFile.path);
      }
    }
  }, [workspace, selectedFile]);

  // Handle prompt submission
  const handlePromptSubmit = async (promptText: string) => {
    try {
      // Create prompt file
      const result = await workspace$.promptToFile({
        promptText,
        filenameHint: promptText.slice(0, 30).replace(/[^a-z0-9]/gi, '-'),
      });

      toast({
        title: "Prompt Saved",
        description: `Created ${result.file.name}`,
      });

      // Start build with the prompt
      await buildMutation.mutateAsync({ prompt: promptText });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process prompt",
        variant: "destructive",
      });
    }
  };

  // Handle file upload from prompt bar
  const handleFileUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("jobId", jobId || "");
      formData.append("userId", "demo");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const asset = await response.json();
      
      toast({
        title: "File Uploaded",
        description: `${file.name} uploaded successfully`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/workspace", jobId, "files"] });
    } catch (error: any) {
      toast({
        title: "Upload Error",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
    }
  };

  // Handle toolbar actions
  const handleDownloadFile = async () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a file to download",
        variant: "destructive",
      });
      return;
    }

    try {
      await workspace$.downloadFile({
        path: selectedFile,
        suggestedName: selectedFile.split('/').pop(),
      });
      toast({
        title: "Downloaded",
        description: "File saved to your device",
      });
    } catch (error: any) {
      toast({
        title: "Download Error",
        description: error.message || "Failed to download file",
        variant: "destructive",
      });
    }
  };

  const handleNewFolder = async () => {
    if (!newFolderPath.trim()) {
      toast({
        title: "Invalid Path",
        description: "Please enter a folder path",
        variant: "destructive",
      });
      return;
    }

    try {
      await workspace$.createFolder({ path: newFolderPath });
      toast({
        title: "Folder Created",
        description: `Created folder: ${newFolderPath}`,
      });
      setShowNewFolderDialog(false);
      setNewFolderPath("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create folder",
        variant: "destructive",
      });
    }
  };

  // Handle prompt file click
  const handlePromptFileClick = (file: WorkspaceFile) => {
    setSelectedPromptFile(file);
    setShowPromptFileModal(true);
  };

  // Handle new chat action
  const handleNewChatAction = (prompt: string) => {
    if (prompt) {
      handlePromptSubmit(prompt);
    }
  };

  // Handle download prompt file
  const handleDownloadPromptFile = async () => {
    if (!selectedPromptFile) return;

    try {
      await workspace$.downloadFile({
        path: selectedPromptFile.path,
        suggestedName: selectedPromptFile.path.split('/').pop(),
      });
      toast({
        title: "Downloaded",
        description: "Prompt file saved to your device",
      });
    } catch (error: any) {
      toast({
        title: "Download Error",
        description: error.message || "Failed to download file",
        variant: "destructive",
      });
    }
  };

  // Show error UI if workspace fails to load
  if (error || (workspace && 'error' in workspace)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card className="max-w-md p-6">
          <h2 className="text-xl font-semibold mb-2">Workspace Error</h2>
          <p className="text-muted-foreground mb-4">
            {(workspace as any)?.error || error?.message || "Failed to load workspace data"}
          </p>
          <div className="flex gap-2">
            <Button 
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/workspace", jobId, "files"] })}
              data-testid="button-retry-workspace"
            >
              Retry
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setRightTab("console")}
              data-testid="button-view-logs"
            >
              View Logs
            </Button>
            <Button 
              variant="outline"
              onClick={() => setLocation("/")}
              data-testid="button-back-home"
            >
              Back to Home
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Show loading state
  if (isLoading || !workspace) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading workspace...</p>
        </div>
      </div>
    );
  }

  const selectedFileData = workspace.files.find((f) => f.path === selectedFile);

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
        onPublish={() => setShowPublishModal(true)}
      />
      <CommandPalette />
      <PublishModal
        open={showPublishModal}
        onOpenChange={setShowPublishModal}
        jobId={jobId || ""}
      />
      <NewChatModal
        open={showNewChatModal}
        onOpenChange={setShowNewChatModal}
        onSelectAction={handleNewChatAction}
      />
      <PromptFileModal
        open={showPromptFileModal}
        onOpenChange={setShowPromptFileModal}
        file={selectedPromptFile}
        onDownload={handleDownloadPromptFile}
      />
      
      {/* New Folder Dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent data-testid="dialog-new-folder">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Enter the folder path (e.g., assets/icons)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="folder-path">Folder Path</Label>
              <Input
                id="folder-path"
                value={newFolderPath}
                onChange={(e) => setNewFolderPath(e.target.value)}
                placeholder="assets/icons"
                data-testid="input-folder-path"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewFolderDialog(false)}
              data-testid="button-cancel-folder"
            >
              Cancel
            </Button>
            <Button
              onClick={handleNewFolder}
              data-testid="button-create-folder"
            >
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex-1 flex pt-16">
        {/* Left Sidebar - File Tree */}
        <div className="w-80 border-r border-border flex flex-col">
          {/* File Tree Header */}
          <div className="p-3 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">{workspace.manifest.name}</h3>
              <FileToolbar
                onNewChat={() => setShowNewChatModal(true)}
                onUpload={handleFileUpload}
                onSaveFile={handleDownloadFile}
                onNewFolder={() => setShowNewFolderDialog(true)}
              />
            </div>
            <p className="text-xs text-muted-foreground">{workspace.manifest.description}</p>
          </div>
          
          {/* File Tree */}
          <FileTree
            files={workspace.files}
            selectedFile={selectedFile}
            onFileSelect={setSelectedFile}
            onPromptFileClick={handlePromptFileClick}
          />

          {/* Prompt Bar at Bottom */}
          <PromptBar
            jobId={jobId || ""}
            onSubmit={handlePromptSubmit}
            onFileUpload={handleFileUpload}
            isLoading={buildMutation.isPending || workspace$.isPromptToFileLoading}
            agentButton={
              <AgentButton
                settings={agentSettings}
                onChange={setAgentSettings}
              />
            }
          />
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
