import { useState, useRef, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Upload, Send } from "lucide-react";

interface PromptBarProps {
  jobId: string;
  onSubmit: (promptText: string) => void;
  onFileUpload: (file: File) => void;
  isLoading?: boolean;
  agentButton?: React.ReactNode;
}

export default function PromptBar({
  jobId,
  onSubmit,
  onFileUpload,
  isLoading = false,
  agentButton,
}: PromptBarProps) {
  const { toast } = useToast();
  const [promptText, setPromptText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (!promptText.trim()) {
      toast({
        title: "Empty Prompt",
        description: "Please enter a command or instruction",
        variant: "destructive",
      });
      return;
    }

    onSubmit(promptText);
    setPromptText("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter without shift submits
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    
    // Ctrl/Cmd+Enter also submits
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
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
    <div className="border-t border-border bg-background p-3">
      <div className="flex items-end gap-2">
        {/* File Upload Button */}
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

        {/* Text Input */}
        <div className="flex-1">
          <Textarea
            ref={textareaRef}
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or drop a file — will convert to file."
            className="resize-none border-0 focus-visible:ring-1 min-h-[36px] max-h-32 text-sm"
            rows={1}
            disabled={isLoading}
            data-testid="input-prompt-text"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>

        {/* Agent Button (passed as prop) */}
        {agentButton && (
          <div className="flex-shrink-0">
            {agentButton}
          </div>
        )}

        {/* Build/Send Button */}
        <div className="flex-shrink-0">
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !promptText.trim()}
            size="default"
            data-testid="button-build-prompt"
          >
            <Send className="h-4 w-4 mr-2" />
            {isLoading ? "Building..." : "Build"}
          </Button>
        </div>
      </div>
    </div>
  );
}
