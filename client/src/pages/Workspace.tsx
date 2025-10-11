import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
} from "lucide-react";
import Header from "@/components/Header";
import BuildTraceViewer from "@/components/BuildTraceViewer";

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <div className="flex-1 flex pt-16">
        {/* File Tree */}
        <div className="w-64 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-sm">{workspace.manifest.name}</h3>
            <p className="text-xs text-muted-foreground mt-1">{workspace.manifest.description}</p>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-2">
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
          </ScrollArea>

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

        {/* Live Preview */}
        <div className="w-[500px] border-l border-border flex flex-col">
          <div className="h-12 border-b border-border flex items-center justify-between px-4">
            <span className="text-sm font-medium">Live Preview</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(`/previews/${jobId}/index.html`, "_blank")}
              data-testid="button-open-preview"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="flex-1 overflow-hidden bg-white">
            <iframe
              src={`/previews/${jobId}/${workspace.manifest.entryPoint}`}
              className="w-full h-full border-0"
              title="Live Preview"
              data-testid="iframe-preview"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
