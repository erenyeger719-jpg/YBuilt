import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, FileUp, Save, FolderPlus, MoreVertical, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FileToolbarProps {
  onNewFile?: () => void;
  onUpload?: (file: File) => void;
  onSaveFile?: () => void;
  onNewFolder?: () => void;
  onNewChat?: () => void;
  isCompact?: boolean;
  isUploading?: boolean;
}

export default function FileToolbar({
  onNewFile,
  onUpload,
  onSaveFile,
  onNewFolder,
  onNewChat,
  isCompact = false,
  isUploading = false,
}: FileToolbarProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);

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

    onUpload?.(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // In compact mode, show only primary actions + overflow menu
  if (isCompact) {
    return (
      <div className="flex items-center gap-1">
        {/* New Chat/Message Button - Primary action */}
        {onNewChat && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onNewChat}
            data-testid="button-new-chat"
            title="New message"
          >
            <Plus className="h-3 w-3" />
          </Button>
        )}

        {/* Overflow Menu for secondary actions */}
        <DropdownMenu open={overflowOpen} onOpenChange={setOverflowOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              data-testid="button-toolbar-overflow"
              title="More actions"
            >
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" data-testid="menu-toolbar-overflow">
            {onUpload && (
              <DropdownMenuItem
                onClick={() => {
                  if (!isUploading) {
                    fileInputRef.current?.click();
                    setOverflowOpen(false);
                  }
                }}
                disabled={isUploading}
                data-testid="menu-item-upload-file"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4 mr-2" />
                )}
                {isUploading ? "Uploading..." : "Upload File"}
              </DropdownMenuItem>
            )}
            {onSaveFile && (
              <DropdownMenuItem
                onClick={() => {
                  onSaveFile();
                  setOverflowOpen(false);
                }}
                data-testid="menu-item-save-file"
              >
                <Save className="h-4 w-4 mr-2" />
                Download File
              </DropdownMenuItem>
            )}
            {onNewFolder && (
              <DropdownMenuItem
                onClick={() => {
                  onNewFolder();
                  setOverflowOpen(false);
                }}
                data-testid="menu-item-new-folder"
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Hidden file input */}
        {onUpload && (
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="input-toolbar-file-upload"
          />
        )}
      </div>
    );
  }

  // Normal mode - show all buttons
  return (
    <div className="flex items-center gap-1">
      {/* New Chat/Message Button */}
      {onNewChat && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onNewChat}
          data-testid="button-new-chat"
          title="New message"
        >
          <Plus className="h-3 w-3" />
        </Button>
      )}

      {/* Upload File Button */}
      {onUpload && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="input-toolbar-file-upload"
            disabled={isUploading}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            data-testid="button-upload-file"
            title={isUploading ? "Uploading..." : "Upload file"}
          >
            {isUploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <FileUp className="h-3 w-3" />
            )}
          </Button>
        </>
      )}

      {/* Save/Download File Button */}
      {onSaveFile && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onSaveFile}
          data-testid="button-save-file"
          title="Download file"
        >
          <Save className="h-3 w-3" />
        </Button>
      )}

      {/* New Folder Button */}
      {onNewFolder && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onNewFolder}
          data-testid="button-new-folder"
          title="New folder"
        >
          <FolderPlus className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
