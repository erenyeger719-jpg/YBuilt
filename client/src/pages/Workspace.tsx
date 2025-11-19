// client/src/pages/Workspace.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
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
  Share2,
  Crown,
  Code,
  Copy,
  History,
  RefreshCw,
  Settings,
  Eye,
  Download,
  Plus,
  FolderPlus,
  Save,
  MessageSquare,
  Zap,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import CommandPalette from "@/components/CommandPalette";
import PublishModal from "@/components/PublishModal";
import AgentButton, { type AgentSettings } from "@/components/AgentButton";
import FileTree from "@/components/FileTree";
import FileToolbar from "@/components/FileToolbar";
import NewChatModal from "@/components/NewChatModal";
import PromptFileModal from "@/components/PromptFileModal";
import PageToolSheet from "@/components/PageToolSheet";
import ThemeModal from "@/components/ThemeModal";
import DesignStoreModal from "@/components/DesignStoreModal";
import { fetchDesignPack, UiDesignPackSummary } from "@/lib/design-store";

interface UploadedFile {
  id: string;
  name: string;
  path: string;
}

interface WorkspaceFile {
  path: string;
  content: string;
  language: string;
  type?: string;
  createdAt?: string;
}

interface WorkspaceData {
  id?: string;
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

  const [deviceMode, setDeviceMode] = useState<"desktop" | "tablet" | "mobile">(
    "desktop",
  );
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showPromptFileModal, setShowPromptFileModal] =
    useState<boolean>(false);
  const [selectedPromptFile, setSelectedPromptFile] =
    useState<WorkspaceFile | null>(null);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderPath, setNewFolderPath] = useState("");
  const [showPageToolSheet, setShowPageToolSheet] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [promptText, setPromptText] = useState("");
  const [leftPaneWidth, setLeftPaneWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const [activeView, setActiveView] = useState<
    "preview" | "cloud" | "code" | "analytics"
  >("preview");
  const [showViewDropdown, setShowViewDropdown] = useState(false);

  // Prompt dock mode: "magic" (Magic cursor) vs "chat"
  const [composerMode, setComposerMode] = useState<"magic" | "chat">("chat");

  // NEW: Autopilot toggle state
  const [isAutopilotOn, setIsAutopilotOn] = useState(false);

  // NEW: Design Store modal
  const [designStoreOpen, setDesignStoreOpen] = useState(false);

  // Agent settings
  const [agentSettings, setAgentSettings] = useState<AgentSettings>({
    autonomyLevel: "medium",
    autoApply: false,
    safetyFilter: true,
    computeTier: "standard",
  });

  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Force dark mode globally for the workspace
  useEffect(() => {
    try {
      const root = document.documentElement;
      root.classList.add("dark");
      root.classList.remove("light");
      root.style.colorScheme = "dark";
    } catch {}
  }, []);

  // Handle horizontal resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = e.clientX;
      if (newWidth >= 300 && newWidth <= 600) {
        setLeftPaneWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    if (isResizing) {
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showViewDropdown) {
        const target = e.target as HTMLElement;
        if (!target.closest(".view-dropdown-container")) {
          setShowViewDropdown(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showViewDropdown]);

  // Fetch workspace data with error handling
  const {
    data: workspace,
    isLoading,
    error,
  } = useQuery<WorkspaceData>({
    queryKey: ["/api/workspace", jobId, "files"],
    queryFn: () =>
      apiRequest<WorkspaceData>("GET", `/api/workspace/${jobId}/files`),
    enabled: !!jobId,
    retry: 2,
  });

  // Fetch and apply theme on workspace load (applies to iframe only)
  const { data: theme } = useQuery<any>({
    queryKey: ["/api/workspace", jobId, "theme"],
    queryFn: () => apiRequest<any>("GET", `/api/workspace/${jobId}/theme`),
    enabled: !!jobId,
  });

  // KPI: mark preview as seen when iframe loads
  const handlePreviewSeen = useCallback(() => {
    try {
      if (!jobId || !workspace) return;

      const payload = {
        jobId,
        workspaceId: workspace.id,
        path: workspace.manifest?.entryPoint || "/",
        source: "preview",
      };

      if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
        const blob = new Blob([JSON.stringify(payload)], {
          type: "application/json",
        });
        navigator.sendBeacon("/api/kpi/seen", blob);
      } else {
        fetch("/api/kpi/seen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {
          // Never break the UI if this fails
        });
      }
    } catch {
      // Silent fail – preview should never crash.
    }
  }, [jobId, workspace]);

  // Save index.html mutation
  const saveIndexMutation = useMutation({
    mutationFn: async (content: string): Promise<void> => {
      const indexHtmlFile = workspace?.files.find(
        (f) => f.path === "index.html" || f.path.endsWith("/index.html"),
      );
      const path = indexHtmlFile?.path || "index.html";
      await apiRequest("PUT", `/api/workspace/${jobId}/files/${path}`, {
        content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/workspace", jobId, "files"],
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

  // Apply theme CSS variables ONLY to iframe preview
  useEffect(() => {
    if (!theme) return;

    const hexToHSL = (hex: string): string => {
      hex = hex.replace(/^#/, "");
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0,
        s = 0,
        l = (max + min) / 2;

      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
          case r:
            h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            break;
          case g:
            h = ((b - r) / d + 2) / 6;
            break;
          case b:
            h = ((r - g) / d + 4) / 6;
            break;
        }
      }

      h = Math.round(h * 360);
      s = Math.round(s * 100);
      l = Math.round(l * 100);

      return `${h} ${s}% ${l}%`;
    };

    const applyThemeToIframe = () => {
      const iframe = document.querySelector(
        'iframe[data-testid="iframe-preview"]',
      ) as HTMLIFrameElement;
      if (!iframe || !iframe.contentWindow) return;

      try {
        const iframeDoc = iframe.contentWindow.document.documentElement;

        iframeDoc.style.setProperty(
          "--background",
          hexToHSL(theme.colors.background),
        );
        iframeDoc.style.setProperty(
          "--foreground",
          hexToHSL(theme.colors.text),
        );
        iframeDoc.style.setProperty(
          "--primary",
          hexToHSL(theme.colors.primaryBackground),
        );
        iframeDoc.style.setProperty(
          "--primary-foreground",
          hexToHSL(theme.colors.primaryText),
        );
        iframeDoc.style.setProperty(
          "--accent",
          hexToHSL(theme.colors.accentBackground),
        );
        iframeDoc.style.setProperty(
          "--accent-foreground",
          hexToHSL(theme.colors.accentText),
        );
        iframeDoc.style.setProperty(
          "--destructive",
          hexToHSL(theme.colors.destructiveBackground),
        );
        iframeDoc.style.setProperty(
          "--destructive-foreground",
          hexToHSL(theme.colors.destructiveText),
        );
        iframeDoc.style.setProperty(
          "--border",
          hexToHSL(theme.colors.border),
        );
        iframeDoc.style.setProperty(
          "--card",
          hexToHSL(theme.colors.cardBackground),
        );
        iframeDoc.style.setProperty(
          "--card-foreground",
          hexToHSL(theme.colors.cardText),
        );

        iframeDoc.style.setProperty("--font-sans", theme.fonts.sans);
        iframeDoc.style.setProperty("--font-serif", theme.fonts.serif);
        iframeDoc.style.setProperty("--font-mono", theme.fonts.mono);
        iframeDoc.style.setProperty("--radius", theme.borderRadius);
      } catch (error) {
        console.error("Failed to apply theme to iframe:", error);
      }
    };

    applyThemeToIframe();

    const iframe = document.querySelector(
      'iframe[data-testid="iframe-preview"]',
    ) as HTMLIFrameElement;
    if (iframe) {
      iframe.addEventListener("load", applyThemeToIframe);
      return () => {
        iframe.removeEventListener("load", applyThemeToIframe);
      };
    }
  }, [theme]);

  // Auto-select first non-prompt file when workspace loads
  useEffect(() => {
    if (workspace?.files && !selectedFile) {
      const firstNonPromptFile = workspace.files.find(
        (file) =>
          !file.path.includes("/prompts/") && !file.path.endsWith(".md"),
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
  const indexHtmlFile = workspace?.files.find(
    (f) => f.path === "index.html" || f.path.endsWith("/index.html"),
  );

  // Handle prompt submission
  const handlePromptSubmit = async (promptText: string) => {
    try {
      const result = await workspace$.promptToFile({
        promptText,
        filenameHint: promptText.slice(0, 30).replace(/[^a-z0-9]/gi, "-"),
      });

      setUploadedFiles((prev) => [
        ...prev,
        {
          id: result.file.name,
          name: result.file.name,
          path: result.file.path,
        },
      ]);

      toast({
        title: "Prompt Saved",
        description: `Created ${result.file.name}`,
      });

      await buildMutation.mutateAsync({ prompt: promptText });

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
      await workspace$.uploadFile(file);

      const result = await workspace$.promptToFile({
        promptText: `Uploaded file: ${file.name}`,
        filenameHint: file.name.replace(/\.[^/.]+$/, ""),
      });

      setUploadedFiles((prev) => [
        ...prev,
        {
          id: result.file.name,
          name: file.name,
          path: result.file.path,
        },
      ]);

      toast({
        title: "File Uploaded",
        description: `${file.name} uploaded successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Upload Error",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleFileChipClick = (uploadedFile: UploadedFile) => {
    const file = workspace?.files.find((f) => f.path === uploadedFile.path);
    if (file) {
      setSelectedPromptFile(file);
      setShowPromptFileModal(true);
    }
  };

  const handleSaveFile = () => {
    if (!selectedFile || !workspace?.files) {
      toast({
        title: "No File Selected",
        description: "Please select a file to save",
        variant: "destructive",
      });
      return;
    }

    const file = workspace.files.find((f) => f.path === selectedFile);
    if (!file) {
      toast({
        title: "File Not Found",
        description: "Selected file not found in workspace",
        variant: "destructive",
      });
      return;
    }

    const getMimeType = (path: string): string => {
      const ext = path.split(".").pop()?.toLowerCase();
      const mimeTypes: Record<string, string> = {
        html: "text/html",
        css: "text/css",
        js: "application/javascript",
        json: "application/json",
        xml: "application/xml",
        txt: "text/plain",
        md: "text/markdown",
        ts: "application/typescript",
        tsx: "application/typescript",
        jsx: "application/javascript",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        svg: "image/svg+xml",
        webp: "image/webp",
        ico: "image/x-icon",
        pdf: "application/pdf",
        zip: "application/zip",
      };
      return mimeTypes[ext || ""] || "application/octet-stream";
    };

    const mimeType = getMimeType(file.path);
    const blob = new Blob([file.content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.path.split("/").pop() || file.path;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "File Saved",
      description: `Downloaded ${a.download}`,
    });
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

  const handlePromptFileClick = (file: WorkspaceFile) => {
    setSelectedPromptFile(file);
    setShowPromptFileModal(true);
  };

  const handleNewChatAction = (prompt: string) => {
    setPromptText(prompt);
    setShowNewChatModal(false);
  };

  const handleDownloadPromptFile = async () => {
    if (!selectedPromptFile) return;

    try {
      await workspace$.downloadFile({
        path: selectedPromptFile.path,
        suggestedName: selectedPromptFile.path.split("/").pop(),
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
  if (error || (workspace && "error" in workspace)) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#212121]">
        <Card className="max-w-md rounded-2xl bg-neutral-900 p-6 text-neutral-200 shadow-xl ring-1 ring-white/10">
          <h2 className="mb-2 text-xl font-semibold">Workspace Error</h2>
          <p className="mb-4 text-muted-foreground">
            {(workspace as any)?.error ||
              (error as any)?.message ||
              "Failed to load workspace data"}
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: ["/api/workspace", jobId, "files"],
                })
              }
              data-testid="button-retry-workspace"
              className="rounded-xl"
            >
              Retry
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/")}
              data-testid="button-back-home"
              className="rounded-xl"
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
      <div className="flex h-screen items-center justify-center bg-[#212121]">
        <div className="text-center text-neutral-300">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-white/40"></div>
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

  // Left Pane Content
  const leftPane = (
    <div className="flex h-full flex-col bg-[#212121]">
      {/* Header with title and project info */}
      <div className="flex-shrink-0 bg-[#212121] px-4 py-3">
        <div className="mb-1 flex items-center gap-2">
          {/* Gradient icon like GOOD design */}
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 p-0.5">
            <div className="flex h-full w-full items-center justify-center rounded-[6px] bg-[#212121]">
              <span className="bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-xs font-bold text-transparent">
                S
              </span>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-200">
              SAS Page Builder
            </h3>
            <p className="text-xs text-neutral-500">
              Previewing last saved version
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          {new Date().toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
          })}{" "}
          at{" "}
          {new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })}
        </p>
      </div>

      {/* Project name chip */}
      <div className="px-4 pb-3">
        <div className="inline-flex items-center rounded-full bg-white/5 px-3 py-1 text-xs text-neutral-400">
          {workspace.manifest.name}
        </div>
      </div>

      {/* AI Conversation Area */}
      <ScrollArea className="flex-1 px-4 pb-4">
        <div className="space-y-4">
          {/* AI Initial Message */}
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500">
                <Zap className="h-4 w-4 text-white" />
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <p className="text-xs text-neutral-500">Thought for 10s</p>
              <div className="space-y-3 text-sm text-neutral-300">
                <p>
                  I'd love to help you build something amazing! However, I'm
                  not quite sure what you're looking for.
                </p>
                <p>Could you clarify what you'd like to create? For example:</p>
                <ul className="ml-4 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 text-neutral-500">•</span>
                    <span>
                      <strong>SaaS landing page</strong> - A marketing site for
                      a software product?
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 text-neutral-500">•</span>
                    <span>
                      <strong>Something else entirely?</strong>
                    </span>
                  </li>
                </ul>
                <p>
                  Please describe your project so I can create exactly what you
                  need!
                </p>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Quick Action Suggestions */}
      <div className="px-3 pb-2">
        <div className="flex flex-wrap gap-2">
          <button className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-white/10">
            Add Authentication System
          </button>
          <button className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-white/10">
            Add Secure Database
          </button>
        </div>
      </div>

      {/* Enhanced Prompt Bar at Bottom */}
      <div className="px-3 pb-3">
        <div className="overflow-hidden rounded-2xl bg-[#282825] ring-1 ring-white/10">
          {/* Input area */}
          <div className="relative">
            <input
              type="text"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Ask Lovable..."
              className="w-full bg-transparent px-4 py-3.5 text-sm text-neutral-200 placeholder-neutral-500 outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (promptText.trim()) {
                    handlePromptSubmit(promptText);
                  }
                }
              }}
            />
          </div>

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between px-3 pb-2 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowNewChatModal(true)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-transparent text-neutral-400 transition-colors hover:bg-white/5"
              >
                <Plus className="h-4 w-4" />
              </button>

              {/* Magic cursor toggle */}
              <button
                type="button"
                onClick={() => setComposerMode("magic")}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  composerMode === "magic"
                    ? "border-white bg-neutral-100 text-neutral-900"
                    : "border-white/15 bg-transparent text-neutral-400 hover:bg-white/5"
                }`}
                title="Magic cursor"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Magic cursor</span>
              </button>

              {/* Chat toggle */}
              <button
                type="button"
                onClick={() => setComposerMode("chat")}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  composerMode === "chat"
                    ? "border-white bg-neutral-100 text-neutral-900"
                    : "border-white/15 bg-transparent text-neutral-400 hover:bg-white/5"
                }`}
                title="Chat"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Chat</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-transparent text-neutral-400 transition-colors hover:bg-white/5"
                title="Voice input"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <path d="M6 10v4M10 8v8M14 9v6M18 11v2" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (promptText.trim()) {
                    handlePromptSubmit(promptText);
                  }
                }}
                disabled={!promptText.trim() || buildMutation.isPending}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                  promptText.trim()
                    ? "bg-neutral-200 text-neutral-900 hover:bg-neutral-100"
                    : "cursor-not-allowed bg-neutral-700 text-neutral-500"
                }`}
              >
                <svg
                  viewBox="0 0 20 20"
                  className="h-4 w-4"
                  fill="currentColor"
                >
                  <path d="M10 3.5a.75.75 0 0 1 .53.22l4.5 4.5a.75.75 0 0 1-1.06 1.06L10.75 6.06V15.5a.75.75 0 0 1-1.5 0V6.06L6.03 9.28a.75.75 0 1 1-1.06-1.06l4.5-4.5A.75.75 0 0 1 10 3.5Z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Right Pane Content
  const rightPane = (
    <div className="flex h-full flex-col bg-[#212121]">
      <Tabs defaultValue="preview" className="flex flex-1 flex-col overflow-hidden">
        {/* Enhanced Top bar */}
        <div className="sticky top-0 z-[60] flex h-14 flex-shrink-0 items-center justify-between bg-[#212121] px-4">
          <div className="flex items-center gap-2">
            {/* Preview button */}
            <button
              onClick={() => setActiveView("preview")}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                activeView === "preview"
                  ? "rounded-lg border border-blue-500 bg-blue-600/20 text-neutral-200"
                  : "rounded-lg border border-white/10 bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-neutral-200"
              }`}
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              {activeView === "preview" && <span>Preview</span>}
            </button>

            {/* Cloud button */}
            <button
              onClick={() => setActiveView("cloud")}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                activeView === "cloud"
                  ? "rounded-lg border border-blue-500 bg-blue-600/20 text-neutral-200"
                  : "rounded-lg border border-white/10 bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-neutral-200"
              }`}
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
              </svg>
              {activeView === "cloud" && <span>Cloud</span>}
            </button>

            {/* Code button */}
            <button
              onClick={() => setActiveView("code")}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                activeView === "code"
                  ? "rounded-lg border border-blue-500 bg-blue-600/20 text-neutral-200"
                  : "rounded-lg border border-white/10 bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-neutral-200"
              }`}
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              {activeView === "code" && <span>Code</span>}
            </button>

            {/* Analytics button */}
            <button
              onClick={() => setActiveView("analytics")}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                activeView === "analytics"
                  ? "rounded-lg border border-blue-500 bg-blue-600/20 text-neutral-200"
                  : "rounded-lg border border-white/10 bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-neutral-200"
              }`}
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="12" y1="20" x2="12" y2="10" />
                <line x1="18" y1="20" x2="18" y2="4" />
                <line x1="6" y1="20" x2="6" y2="16" />
              </svg>
              {activeView === "analytics" && <span>Analytics</span>}
            </button>

            {/* Add button with dropdown */}
            <div className="view-dropdown-container relative">
              <button
                onClick={() => setShowViewDropdown(!showViewDropdown)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-neutral-400 transition-colors hover:bg-white/10 hover:text-neutral-200"
              >
                <Plus className="h-4 w-4" />
              </button>

              {showViewDropdown && (
                <div className="absolute left-0 top-full z-50 mt-2 w-48 rounded-xl border border-white/10 bg-[#1a1a1a] shadow-xl">
                  <div className="space-y-1 p-2">
                    <button
                      onClick={() => {
                        setActiveView("analytics");
                        setShowViewDropdown(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-white/10"
                    >
                      <div className="flex items-center gap-2">
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <line x1="12" y1="20" x2="12" y2="10" />
                          <line x1="18" y1="20" x2="18" y2="4" />
                          <line x1="6" y1="20" x2="6" y2="16" />
                        </svg>
                        <span>Analytics</span>
                      </div>
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 10h-4V6h-2v4h-4v2h4v4h2v-4h4v-2z" />
                      </svg>
                    </button>

                    <button
                      onClick={() => {
                        setActiveView("cloud");
                        setShowViewDropdown(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-white/10"
                    >
                      <div className="flex items-center gap-2">
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                        </svg>
                        <span>Cloud</span>
                      </div>
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 10h-4V6h-2v4h-4v2h4v4h2v-4h4v-2z" />
                      </svg>
                    </button>

                    <button
                      onClick={() => {
                        setActiveView("code");
                        setShowViewDropdown(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-white/10"
                    >
                      <div className="flex items-center gap-2">
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="16 18 22 12 16 6" />
                          <polyline points="8 6 2 12 8 18" />
                        </svg>
                        <span>Code</span>
                      </div>
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 10h-4V6h-2v4h-4v2h4v4h2v-4h4v-2z" />
                      </svg>
                    </button>

                    <button
                      onClick={() => {
                        setShowViewDropdown(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-white/10"
                    >
                      <div className="flex items-center gap-2">
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        <span>Security</span>
                      </div>
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 10h-4V6h-2v4h-4v2h4v4h2v-4h4v-2z" />
                      </svg>
                    </button>

                    <button
                      onClick={() => {
                        setShowViewDropdown(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-white/10"
                    >
                      <div className="flex items-center gap-2">
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span>Speed</span>
                      </div>
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 10h-4V6h-2v4h-4v2h4v4h2v-4h4v-2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Center rounded pill with icons */}
          <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/20 bg-white/5 px-4 py-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    if (deviceMode === "desktop") setDeviceMode("tablet");
                    else if (deviceMode === "tablet") setDeviceMode("mobile");
                    else setDeviceMode("desktop");
                  }}
                  className="flex h-5 w-5 items-center justify-center text-neutral-400 transition-colors hover:text-neutral-200"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    {/* Desktop/Laptop monitor */}
                    <path
                      d="M2 4h14v10H2V4z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      fill="none"
                    />
                    <path
                      d="M2 14h14"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M7 14v2h4v-2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      fill="none"
                    />
                    <path
                      d="M5 16h8"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    {/* Mobile phone */}
                    <rect
                      x="16"
                      y="8"
                      width="6"
                      height="12"
                      rx="0.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      fill="none"
                    />
                    <path
                      d="M18 19h2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  </svg>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {deviceMode === "desktop"
                  ? "Switch to tablet"
                  : deviceMode === "tablet"
                  ? "Switch to mobile"
                  : "Switch to desktop"}
              </TooltipContent>
            </Tooltip>

            <span className="font-mono text-sm text-neutral-400">/</span>

            <button className="flex h-5 w-5 items-center justify-center text-neutral-400 transition-colors hover:text-neutral-200">
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </button>

            <button
              onClick={() => {
                const iframe = document.querySelector(
                  'iframe[data-testid="iframe-preview"]',
                ) as HTMLIFrameElement;
                if (iframe) iframe.src = iframe.src;
              }}
              className="flex h-5 w-5 items-center justify-center text-neutral-400 transition-colors hover:text-neutral-200"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="preview-toolbar flex items-center gap-3">
            {/* NEW: Autopilot button in the header */}
            <Button
              variant={isAutopilotOn ? "default" : "ghost"}
              size="sm"
              className={`h-9 gap-1.5 rounded-lg px-3 text-sm ${
                isAutopilotOn
                  ? "bg-purple-600 text-neutral-50 hover:bg-purple-700"
                  : "hover:bg-white/5"
              }`}
              onClick={() => {
                setIsAutopilotOn((prev) => !prev);
                toast({
                  title: "Autopilot",
                  description: !isAutopilotOn
                    ? "Autopilot is now ON. Your builder co-pilot is awake."
                    : "Autopilot is now OFF.",
                });
              }}
            >
              <Zap className="h-4 w-4" />
              <span>{isAutopilotOn ? "Autopilot On" : "Autopilot"}</span>
            </Button>

            {/* NEW: Design Store button */}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 gap-1.5 rounded-lg border-white/20 bg-transparent px-3 text-sm text-neutral-200 hover:bg-white/5"
              onClick={() => setDesignStoreOpen(true)}
            >
              <span>Design Store</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 rounded-lg px-3 text-sm hover:bg-white/5"
            >
              <Share2 className="h-4 w-4" />
              <span>Share</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 rounded-lg px-3 text-sm hover:bg-white/5"
            >
              <Crown className="h-4 w-4" />
              <span>Upgrade</span>
            </Button>

            <Button
              variant="default"
              size="sm"
              className="h-9 gap-1.5 rounded-lg bg-blue-600 px-4 text-sm hover:bg-blue-700"
              onClick={() => setShowPublishModal(true)}
              data-testid="button-publish"
            >
              <span>Publish</span>
            </Button>
          </div>
        </div>

        <TabsContent value="preview" className="m-0 flex-1 overflow-hidden">
          <div className="flex h-full items-center justify-center bg-gradient-to-b from-[#212121] to-[#1a1a1a] p-6">
            <div
              style={{
                width: deviceWidths[deviceMode],
                height: "calc(100% - 2rem)",
                maxWidth: "100%",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
              className="relative overflow-hidden rounded-2xl bg-white shadow-2xl shadow-black/50 ring-1 ring-white/10"
            >
              {deviceMode !== "desktop" && (
                <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 h-8 bg-gradient-to-b from-black/10 to-transparent" />
              )}

              <iframe
                ref={previewIframeRef}
                src={`/previews/${jobId}/${workspace.manifest.entryPoint}`}
                className="h-full w-full border-0"
                title="Live Preview"
                data-testid="iframe-preview"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                onLoad={handlePreviewSeen}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );

  return (
    <div
      className="dark flex h-screen flex-col overflow-hidden bg-[#212121] text-neutral-200"
      data-theme="dark"
    >
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
      <ThemeModal
        open={showThemeModal}
        onOpenChange={setShowThemeModal}
        projectId={jobId || ""}
      />
      {/* NEW: Design Store modal wiring */}
      <DesignStoreModal
        open={designStoreOpen}
        onOpenChange={setDesignStoreOpen}
        onUsePack={async (summary: UiDesignPackSummary) => {
          try {
            const fullPack = await fetchDesignPack(summary.id);
            try {
              const maybeWorkspace: any = workspace$;
              if (
                maybeWorkspace &&
                typeof maybeWorkspace.applyDesignPackFromStore === "function"
              ) {
                await maybeWorkspace.applyDesignPackFromStore(fullPack);
              } else {
                console.warn(
                  "[Workspace] Design pack fetched but no applyDesignPackFromStore handler wired.",
                  fullPack,
                );
              }
            } catch (err) {
              console.error(
                "Failed to apply design pack in Workspace",
                err,
              );
            }
            setDesignStoreOpen(false);
          } catch (err) {
            console.error("Failed to fetch design pack in Workspace", err);
          }
        }}
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

      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent
          data-testid="dialog-new-folder"
          className="rounded-2xl border-white/10 bg-[#1f1f1f]"
        >
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
                className="rounded-xl border-white/10 bg-white/5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewFolderDialog(false)}
              data-testid="button-cancel-folder"
              className="rounded-xl border-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleNewFolder}
              data-testid="button-create-folder"
              className="rounded-xl bg-blue-600 hover:bg-blue-700"
            >
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex-1 overflow-hidden">
        <div className="flex h-full">
          {/* Left Pane */}
          <div style={{ width: `${leftPaneWidth}px` }} className="flex-shrink-0">
            {leftPane}
          </div>

          {/* Right Pane with complete border and better rounded corners */}
          <div className="relative m-2 flex-1 overflow-hidden rounded-3xl border border-white/10">
            {/* Invisible resize handle overlay on the left border */}
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                setIsResizing(true);
              }}
              className="absolute left-0 top-0 bottom-0 z-50 w-2 cursor-col-resize"
              style={{ marginLeft: "-4px" }}
            />
            {rightPane}
          </div>
        </div>
      </div>
    </div>
  );
}
