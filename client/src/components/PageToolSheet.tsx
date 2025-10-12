import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { Download, Save } from "lucide-react";

interface PageToolSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  indexHtmlContent?: string;
  onSave?: (content: string) => Promise<void>;
}

export default function PageToolSheet({
  open,
  onOpenChange,
  jobId,
  indexHtmlContent = "",
  onSave,
}: PageToolSheetProps) {
  const { toast } = useToast();
  const [content, setContent] = useState(indexHtmlContent);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setContent(indexHtmlContent);
  }, [indexHtmlContent]);

  const handleSave = async () => {
    if (!onSave) return;

    setIsSaving(true);
    try {
      await onSave(content);
      toast({
        title: "Saved",
        description: "index.html saved successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save file",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "index.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Exported",
      description: "index.html downloaded to your device",
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[50vh] p-0 flex flex-col"
        data-testid="sheet-page-tool"
      >
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>Page Tool - Edit index.html</SheetTitle>
          <SheetDescription>
            Edit the HTML structure of your page
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-hidden">
          <Editor
            height="100%"
            language="html"
            value={content}
            onChange={(value) => setContent(value || "")}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: "on",
            }}
          />
        </div>

        <SheetFooter className="px-6 py-4 border-t flex-shrink-0">
          <div className="flex gap-2 w-full justify-end">
            <Button
              variant="outline"
              onClick={handleExport}
              data-testid="button-export-html"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              data-testid="button-save-html"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
