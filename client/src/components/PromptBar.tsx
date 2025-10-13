import { useState, useRef, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  onFileClick?: (file: UploadedFile) => void;
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
  onFileClick,
  uploadedFiles = [],
  isLoading = false,
  agentButton,
}: PromptBarProps) {
  const { toast } = useToast();
  const [internalPromptText, setInternalPromptText] = useState("");
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

  const handleFileClick = (file: UploadedFile) => {
    if (onFileClick) {
      onFileClick(file);
    }
  };

  return (
    <div 
      className="border-t border-border bg-background/50 flex-shrink-0 flex flex-col"
      style={{ height: 'var(--prompt-bar-height)' }}
      data-testid="prompt-bar-container"
    >
      {/* Row A: File Chips - Fixed height with horizontal scroll */}
      {uploadedFiles.length > 0 && (
        <div 
          className="px-3 pt-2 pb-1 flex gap-1 overflow-x-auto items-center flex-shrink-0"
          style={{ height: 'var(--file-chips-height)' }}
          data-testid="prompt-file-chips"
        >
          {uploadedFiles.map((file) => (
            <Tooltip key={file.id}>
              <TooltipTrigger asChild>
                <Badge
                  variant="secondary"
                  className="gap-1 pr-1 text-xs flex-shrink-0 cursor-pointer hover-elevate"
                  data-testid={`pill-file-${file.id}`}
                  onClick={() => handleFileClick(file)}
                >
                  <span className="max-w-[120px] truncate whitespace-nowrap">{file.name}</span>
                  {onRemoveFile && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFile(file.id);
                      }}
                      className="ml-1 rounded-sm hover:bg-muted p-0.5"
                      data-testid={`button-remove-file-${file.id}`}
                    >
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">{file.name}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}

      {/* Row B: Textarea - Scrollable, takes remaining space */}
      <div className="px-3 py-2 flex-1 overflow-hidden" data-testid="prompt-input-area">
        <div className="h-full overflow-y-auto">
          <textarea
            ref={textareaRef}
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or paste a file. Press Enter to send, Shift+Enter for newline."
            className="w-full min-h-[48px] resize-none bg-black/35 rounded-lg p-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border disabled:opacity-50 disabled:cursor-not-allowed"
            tabIndex={0}
            aria-label="Build prompt"
            disabled={isLoading}
            data-testid="input-prompt-text"
          />
        </div>
      </div>

      {/* Row C: Controls - Agent + Build buttons (NO upload button) */}
      <div 
        className="px-3 pb-2 flex items-center gap-2 justify-end flex-shrink-0"
        style={{ height: 'var(--prompt-actions-height)' }}
        data-testid="prompt-actions"
      >
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
