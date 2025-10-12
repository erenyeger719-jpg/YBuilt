import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { File, ChevronDown, ChevronRight, MessageSquare } from "lucide-react";

interface FileItem {
  path: string;
  content: string;
  language: string;
  type?: string;
  createdAt?: string;
}

interface FileTreeProps {
  files: FileItem[];
  selectedFile: string | null;
  onFileSelect: (path: string) => void;
  onPromptFileClick?: (file: FileItem) => void;
}

export default function FileTree({
  files,
  selectedFile,
  onFileSelect,
  onPromptFileClick,
}: FileTreeProps) {
  const [promptsExpanded, setPromptsExpanded] = useState(true);
  const [filesExpanded, setFilesExpanded] = useState(true);

  // Separate prompt files from regular files
  const promptFiles = files.filter((f) => f.type === "prompt");
  const regularFiles = files.filter((f) => f.type !== "prompt");

  const renderFileItem = (file: FileItem, isPrompt: boolean = false) => {
    const isSelected = selectedFile === file.path;
    
    return (
      <button
        key={file.path}
        onClick={() => {
          if (isPrompt && onPromptFileClick) {
            onPromptFileClick(file);
          } else {
            onFileSelect(file.path);
          }
        }}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover-elevate ${
          isSelected
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground"
        }`}
        data-testid={`file-${file.path}`}
      >
        {isPrompt ? (
          <MessageSquare className="w-4 h-4" />
        ) : (
          <File className="w-4 h-4" />
        )}
        <span className="truncate flex-1 text-left">
          {file.path.split('/').pop()}
        </span>
      </button>
    );
  };

  return (
    <ScrollArea className="flex-1">
      <div className="p-2 space-y-1">
        {/* Prompts & Chat Files Section */}
        {promptFiles.length > 0 && (
          <div className="mb-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-1 h-7 px-2 text-xs font-semibold"
              onClick={() => setPromptsExpanded(!promptsExpanded)}
              data-testid="button-toggle-prompts"
            >
              {promptsExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Prompts & Chat Files ({promptFiles.length})
            </Button>
            {promptsExpanded && (
              <div className="mt-1 space-y-0.5">
                {promptFiles.map((file) => renderFileItem(file, true))}
              </div>
            )}
          </div>
        )}

        {/* Regular Files Section */}
        {regularFiles.length > 0 && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-1 h-7 px-2 text-xs font-semibold"
              onClick={() => setFilesExpanded(!filesExpanded)}
              data-testid="button-toggle-files"
            >
              {filesExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Project Files ({regularFiles.length})
            </Button>
            {filesExpanded && (
              <div className="mt-1 space-y-0.5">
                {regularFiles.map((file) => renderFileItem(file, false))}
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {files.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No files yet
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
