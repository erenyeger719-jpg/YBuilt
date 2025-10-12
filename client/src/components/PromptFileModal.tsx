import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Trash2, FileText } from "lucide-react";

interface PromptFileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: {
    path: string;
    content: string;
    createdAt?: string;
  } | null;
  onDownload?: () => void;
  onDelete?: () => void;
}

export default function PromptFileModal({
  open,
  onOpenChange,
  file,
  onDownload,
  onDelete,
}: PromptFileModalProps) {
  if (!file) return null;

  const fileName = file.path.split('/').pop() || 'prompt';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh]" data-testid="modal-prompt-file">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {fileName}
          </DialogTitle>
          {file.createdAt && (
            <DialogDescription>
              Created: {new Date(file.createdAt).toLocaleString()}
            </DialogDescription>
          )}
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[400px] border rounded-lg p-4 bg-muted/30">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-sm font-mono">
              {file.content}
            </pre>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          {onDelete && (
            <Button
              variant="destructive"
              onClick={() => {
                onDelete();
                onOpenChange(false);
              }}
              data-testid="button-delete-prompt-file"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
          {onDownload && (
            <Button
              variant="outline"
              onClick={() => {
                onDownload();
              }}
              data-testid="button-download-prompt-file"
            >
              <Download className="h-4 w-4 mr-2" />
              Save
            </Button>
          )}
          <Button
            onClick={() => onOpenChange(false)}
            data-testid="button-close-prompt-file"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
