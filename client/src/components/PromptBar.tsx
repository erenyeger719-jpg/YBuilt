import { useState, useRef, KeyboardEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, Plus, X, ChevronDown, ChevronUp } from "lucide-react";

export interface UploadedFile {
  id: string;
  name: string;
  path: string;
}

interface PromptBarProps {
  jobId: string;
  promptText?: string;
  onPromptChange?: (text: string) => void;
  onSubmit: (promptText: string) => void;
  onFileUpload: (file: File) => void;
  onNewChat?: () => void;
  onRemoveFile?: (fileId: string) => void;
  uploadedFiles?: UploadedFile[];
  isLoading?: boolean;
  agentButton?: React.ReactNode;
}

export default function PromptBar({
  jobId,
  promptText: controlledPromptText,
  onPromptChange,
  onSubmit,
  onFileUpload,
  onNewChat,
  onRemoveFile,
  uploadedFiles = [],
  isLoading = false,
  agentButton,
}: PromptBarProps) {
  const { toast } = useToast();
  const [internalPromptText, setInternalPromptText] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem("promptBarCollapsed");
    return saved === "true";
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Use controlled value if provided, otherwise use internal state
  const promptText = controlledPromptText !== undefined ? controlledPromptText : internalPromptText;
  const setPromptText = onPromptChange || setInternalPromptText;

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem("promptBarCollapsed", isCollapsed.toString());
  }, [isCollapsed]);

  const handleSubmit = () => {
    if (!promptText.trim()) {
      toast({
        title: "Empty Prompt",
        description: "Please enter a command or instruction",
        variant: "destructive",
      });
      return;
    }

    // Call onSubmit - parent (Workspace) will clear promptText on success
    onSubmit(promptText);
    
    // If using internal state (uncontrolled), clear immediately
    if (controlledPromptText === undefined) {
      setPromptText("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter without shift submits
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (25MB limit)
    if (file.size > 25 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "File size must be less than 25MB",
        variant: "destructive",
      });
      return;
    }

    onFileUpload(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="border-t border-border bg-background flex-shrink-0">
      {/* Collapse/Expand Header */}
      <div className="px-3 py-1 flex items-center justify-between border-b border-border/50">
        <span className="text-xs text-muted-foreground font-medium">
          {isCollapsed ? "Prompt Bar (Click to expand)" : "Prompt Bar"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setIsCollapsed(!isCollapsed)}
          data-testid="button-toggle-prompt-bar"
          aria-label={isCollapsed ? "Expand prompt bar" : "Collapse prompt bar"}
        >
          {isCollapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <>
          {/* File Pills Row (if there are uploaded files) - Horizontal scroll */}
          {uploadedFiles.length > 0 && (
            <div className="px-3 pt-2 pb-1 flex gap-1 overflow-x-auto max-h-12 items-center">
              {uploadedFiles.map((file) => (
                <Badge
                  key={file.id}
                  variant="secondary"
                  className="gap-1 pr-1 text-xs flex-shrink-0"
                  data-testid={`pill-file-${file.id}`}
                >
                  <span className="max-w-[120px] truncate whitespace-nowrap">{file.name}</span>
                  {onRemoveFile && (
                    <button
                      onClick={() => onRemoveFile(file.id)}
                      className="ml-1 rounded-sm hover:bg-muted p-0.5"
                      data-testid={`button-remove-file-${file.id}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          )}

          {/* Main Input Row - Heights: 56px mobile, 64px tablet, 72px desktop */}
          <div className="px-3 h-14 sm:h-16 lg:h-18 flex items-center gap-2">
        {/* Upload Icon Button */}
        <div className="flex-shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="input-file-upload"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            data-testid="button-upload-file-prompt"
          >
            <Upload className="h-4 w-4" />
          </Button>
        </div>

        {/* Textarea - Flex-1 */}
        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or paste a file. Press Enter to send, Shift+Enter for newline."
            className="
              w-full resize-none bg-transparent border-0
              focus:outline-none focus:ring-0
              text-sm placeholder:text-muted-foreground
              min-h-[44px] max-h-32 overflow-y-auto
              disabled:opacity-50 disabled:cursor-not-allowed
            "
            rows={2}
            tabIndex={0}
            aria-label="Build prompt"
            disabled={isLoading}
            data-testid="input-prompt-text"
          />
        </div>

        {/* Agent Button (passed as prop) */}
        {agentButton && (
          <div className="flex-shrink-0">
            {agentButton}
          </div>
        )}

        {/* Build Button */}
        <div className="flex-shrink-0">
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !promptText.trim()}
            size="default"
            className="h-10 px-5"
            data-testid="button-build-prompt"
          >
            {isLoading ? "Building..." : "Build"}
          </Button>
        </div>
          </div>
        </>
      )}
    </div>
  );
}
