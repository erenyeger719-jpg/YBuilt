import { useState, useRef, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, X } from "lucide-react";

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
  onRemoveFile,
  uploadedFiles = [],
  isLoading = false,
  agentButton,
}: PromptBarProps) {
  const { toast } = useToast();
  const [internalPromptText, setInternalPromptText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Use controlled value if provided, otherwise use internal state
  const promptText = controlledPromptText !== undefined ? controlledPromptText : internalPromptText;
  const setPromptText = onPromptChange || setInternalPromptText;

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
    <div className="border-t border-border bg-background/50 flex-shrink-0">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        className="hidden"
        data-testid="input-file-upload"
      />

      {/* Row A: Pills - Horizontal scroll, max-height 48px */}
      {uploadedFiles.length > 0 && (
        <div className="px-3 pt-2 pb-1 flex gap-1 overflow-x-auto max-h-[48px] items-center">
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

      {/* Row B: Textarea - Prominent and roomy */}
      <div className="px-3 py-2">
        <textarea
          ref={textareaRef}
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command or paste a file. Press Enter to send, Shift+Enter for newline."
          className="w-full min-h-[48px] max-h-[140px] resize-none bg-black/35 rounded-lg p-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border disabled:opacity-50 disabled:cursor-not-allowed"
          tabIndex={0}
          aria-label="Build prompt"
          disabled={isLoading}
          data-testid="input-prompt-text"
        />
      </div>

      {/* Row C: Controls - Upload, Agent, Build buttons */}
      <div className="px-3 pb-2 flex items-center gap-2 justify-end">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          data-testid="button-upload-file-prompt"
          title="Upload file"
        >
          <Upload className="h-4 w-4" />
        </Button>

        {agentButton && <div className="flex-shrink-0">{agentButton}</div>}

        <Button
          onClick={handleSubmit}
          disabled={isLoading || !promptText.trim()}
          size="default"
          className="flex-shrink-0 min-w-[72px]"
          data-testid="button-build-prompt"
        >
          {isLoading ? "Building..." : "Build"}
        </Button>
      </div>
    </div>
  );
}
