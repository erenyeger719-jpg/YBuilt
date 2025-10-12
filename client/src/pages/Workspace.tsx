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
  ExternalLink,
  Monitor,
  Tablet,
  Smartphone,
  RotateCw,
  FileCode,
  Upload,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Header from "@/components/Header";
import ConsolePanel from "@/components/ConsolePanel";
import CommandPalette from "@/components/CommandPalette";
import PublishModal from "@/components/PublishModal";
import PromptBar, { type UploadedFile } from "@/components/PromptBar";
import AgentButton, { type AgentSettings } from "@/components/AgentButton";
import FileTree from "@/components/FileTree";
import FileToolbar from "@/components/FileToolbar";
import NewChatModal from "@/components/NewChatModal";
import PromptFileModal from "@/components/PromptFileModal";
import ResizableSplitter from "@/components/ResizableSplitter";
import PageToolSheet from "@/components/PageToolSheet";

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

  const [rightTab, setRightTab] = useState<"preview" | "console">("preview");
  const [deviceMode, setDeviceMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showPromptFileModal, setShowPromptFileModal] = useState(false);
  const [selectedPromptFile, setSelectedPromptFile] = useState<WorkspaceFile | null>(null);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderPath, setNewFolderPath] = useState("");
  const [showPageToolSheet, setShowPageToolSheet] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [promptText, setPromptText] = useState("");
  
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

  // Auto-select first non-prompt file when workspace loads
  useEffect(() => {
    if (workspace?.files && !selectedFile) {
      const firstNonPromptFile = workspace.files.find(
        (file) => !file.path.includes("/prompts/") && !file.path.endsWith(".md")
      );
      if (firstNonPromptFile) {
        setSelectedFile(firstNonPromptFile.path);
      }
    }
  }, [workspace?.files, selectedFile]);

  // Load file content when selected file changes
  useEffect(() => {
    if (selectedFile && workspace?.files) {
      const file = workspace.files.find((f) => f.path === selectedFile);
      if (file) {
        setFileContent(file.content);
      }
    }
  }, [selectedFile, workspace?.files]);

  // Get index.html content for PageToolSheet
  const indexHtmlFile = workspace?.files.find(f => f.path === "index.html" || f.path.endsWith("/index.html"));

  // Save index.html mutation
  const saveIndexMutation = useMutation({
    mutationFn: async (content: string): Promise<void> => {
      const path = indexHtmlFile?.path || "index.html";
      await apiRequest("PUT", `/api/workspace/${jobId}/files/${path}`, {
        content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspace", jobId, "files"] });
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

  // Handle prompt submission
  const handlePromptSubmit = async (promptText: string) => {
    try {
      // Create prompt file
      const result = await workspace$.promptToFile({
        promptText,
        filenameHint: promptText.slice(0, 30).replace(/[^a-z0-9]/gi, '-'),
      });

      // Add to uploaded files pills
      setUploadedFiles(prev => [...prev, {
        id: result.file.name,
        name: result.file.name,
        path: result.file.path,
      }]);

      toast({
        title: "Prompt Saved",
        description: `Created ${result.file.name}`,
      });

      // Start build with the prompt
      await buildMutation.mutateAsync({ prompt: promptText });
      
      // Clear prompt text after successful submission
      setPromptText("");
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

      // Create prompt file for the uploaded asset
      const result = await workspace$.promptToFile({
        promptText: `Uploaded file: ${file.name}`,
        filenameHint: file.name.replace(/\.[^/.]+$/, ""),
      });

      // Add to uploaded files pills
      setUploadedFiles(prev => [...prev, {
        id: result.file.name,
        name: file.name,
        path: result.file.path,
      }]);
      
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

  // Handle remove file from pills
  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
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

  // Handle new chat action - load preset into prompt bar
  const handleNewChatAction = (prompt: string) => {
    setPromptText(prompt);
    setShowNewChatModal(false);
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

  const deviceWidths = {
    desktop: "100%",
    tablet: "768px",
    mobile: "375px",
  };

  // Left Pane Content - Function that receives isCompact from ResizableSplitter
  const leftPane = (isCompact: boolean) => (
    <div className="h-full flex flex-col">
      {/* File Tree Header - Sticky */}
      <div className="sticky top-0 z-40 p-3 border-b border-border flex-shrink-0 bg-background">
        <div className="flex items-center justify-between mb-2">
          <h3 className={`font-semibold text-sm ${isCompact ? 'truncate' : ''}`}>
            {workspace.manifest.name}
          </h3>
          <FileToolbar
            onNewChat={() => setShowNewChatModal(true)}
            onUpload={handleFileUpload}
            onSaveFile={() => {}}
            onNewFolder={() => setShowNewFolderDialog(true)}
            isCompact={isCompact}
          />
        </div>
        {!isCompact && (
          <p className="text-xs text-muted-foreground">{workspace.manifest.description}</p>
        )}
      </div>
      
      {/* Prompts & AI Messages Area */}
      <ScrollArea className="flex-1">
        <FileTree
          files={workspace.files}
          selectedFile={selectedFile}
          onFileSelect={setSelectedFile}
          onPromptFileClick={handlePromptFileClick}
        />
      </ScrollArea>

      {/* Prompt Bar at Bottom */}
      <PromptBar
        jobId={jobId || ""}
        promptText={promptText}
        onPromptChange={setPromptText}
        onSubmit={handlePromptSubmit}
        onFileUpload={handleFileUpload}
        onRemoveFile={handleRemoveFile}
        uploadedFiles={uploadedFiles}
        isLoading={buildMutation.isPending || workspace$.isPromptToFileLoading}
        agentButton={
          <AgentButton
            settings={agentSettings}
            onChange={setAgentSettings}
          />
        }
      />
    </div>
  );

  // Right Pane Content
  const rightPane = (
    <div className="h-full flex flex-col overflow-hidden">
      <Tabs value={rightTab} onValueChange={(v) => setRightTab(v as "preview" | "console")} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 flex-shrink-0 h-14 bg-background sticky top-0 z-50 overflow-visible">
          <div className="flex items-center gap-0 overflow-visible">
            <TabsList className="h-12 bg-transparent">
              <TabsTrigger value="preview" className="gap-2" data-testid="tab-preview">
                <Monitor className="h-4 w-4" />
                PREVIEW
              </TabsTrigger>
              <TabsTrigger value="console" className="gap-2 mr-0 console-button" data-testid="tab-console">
                CONSOLE
              </TabsTrigger>
            </TabsList>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2 relative publish-pill ml-[40px] max-[720px]:ml-3"
                  style={{ zIndex: 9999, pointerEvents: 'auto' }}
                  onClick={() => setShowPublishModal(true)}
                  data-testid="button-publish"
                  aria-label="Publish"
                  role="button"
                >
                  <Upload className="h-4 w-4" />
                  <span className="max-[720px]:hidden">Publish</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Publish your website</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {rightTab === "preview" && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-1">
                <Button
                  variant={deviceMode === "desktop" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setDeviceMode("desktop")}
                  data-testid="button-device-desktop"
                  aria-label="Desktop view"
                >
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button
                  variant={deviceMode === "tablet" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setDeviceMode("tablet")}
                  data-testid="button-device-tablet"
                  aria-label="Tablet view"
                >
                  <Tablet className="h-4 w-4" />
                </Button>
                <Button
                  variant={deviceMode === "mobile" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setDeviceMode("mobile")}
                  data-testid="button-device-mobile"
                  aria-label="Mobile view"
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
                aria-label="Refresh preview"
              >
                <RotateCw className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => window.open(`/previews/${jobId}/index.html`, "_blank")}
                data-testid="button-open-preview-new-tab"
                aria-label="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowPageToolSheet(true)}
                data-testid="button-page-tool"
                aria-label="Edit page HTML"
              >
                <FileCode className="h-4 w-4" />
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
  );

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <Header
        logSummary={{
          status: "success",
          lastBuild: "2m ago",
        }}
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
      <PageToolSheet
        open={showPageToolSheet}
        onOpenChange={setShowPageToolSheet}
        jobId={jobId || ""}
        indexHtmlContent={indexHtmlFile?.content || ""}
        onSave={async (content) => await saveIndexMutation.mutateAsync(content)}
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

      <div className="flex-1 overflow-hidden">
        <ResizableSplitter
          leftPane={leftPane}
          rightPane={rightPane}
          defaultLeftPercent={33}
          minLeftWidth={240}
          minRightWidth={560}
          storageKey="workspaceSplit"
        />
      </div>
    </div>
  );
}
