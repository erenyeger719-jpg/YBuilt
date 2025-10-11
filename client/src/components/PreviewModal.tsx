import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  previewUrl: string;
}

export default function PreviewModal({ isOpen, onClose, title, previewUrl }: PreviewModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl h-[90vh] p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              data-testid="button-close-modal"
              aria-label="Close preview"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-1 p-6 pt-0">
          <iframe
            src={previewUrl}
            className="w-full h-full border border-border/30 rounded-md bg-white dark:bg-neutral-950"
            title={title}
            data-testid="preview-iframe"
            loading="lazy"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
