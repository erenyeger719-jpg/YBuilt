import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Plus, FileUp, Save, FolderPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FileToolbarProps {
  onNewFile?: () => void;
  onUpload?: (file: File) => void;
  onSaveFile?: () => void;
  onNewFolder?: () => void;
  onNewChat?: () => void;
}

export default function FileToolbar({
  onNewFile,
  onUpload,
  onSaveFile,
  onNewFolder,
  onNewChat,
}: FileToolbarProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => fileInputRef.current?.click()}
            data-testid="button-upload-file"
            title="Upload file"
          >
            <FileUp className="h-3 w-3" />
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
