import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Upload, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AIDesignerProps {
  jobId: string;
  initialData?: {
    title?: string;
    description?: string;
    theme?: string;
    heroText?: string;
  };
  onUpdate?: (data: any) => void;
}

const colorPresets = {
  monochrome: { primary: "#000000", secondary: "#ffffff", accent: "#808080" },
  "high-contrast": { primary: "#000000", secondary: "#ffffff", accent: "#ffff00" },
  warm: { primary: "#ff6b35", secondary: "#f7931e", accent: "#fdc830" },
  cool: { primary: "#4a90e2", secondary: "#50c9c3", accent: "#8e44ad" },
};

export default function AIDesigner({ jobId, initialData, onUpdate }: AIDesignerProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [theme, setTheme] = useState(initialData?.theme || "monochrome");
  const [heroText, setHeroText] = useState(initialData?.heroText || "");
  const [colorPalette, setColorPalette] = useState<string>("monochrome");
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File size must be less than 25MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("jobId", jobId);
      formData.append("userId", "demo");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const asset = await response.json();
      setUploadedFiles([...uploadedFiles, asset.url]);
      
      toast({
        title: "Success",
        description: `Uploaded ${file.name}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }, [jobId, uploadedFiles, toast]);

  const handleApplyChanges = () => {
    const palette = colorPresets[colorPalette as keyof typeof colorPresets];
    const data = {
      title,
      description,
      theme,
      heroText,
      palette,
      assetUrls: uploadedFiles,
    };
    onUpdate?.(data);
    
    toast({
      title: "Applied",
      description: "Design changes applied to preview",
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">AI Design Assistant</h3>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="title" data-testid="label-title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My Awesome Website"
            className="mt-1.5"
            data-testid="input-title"
          />
        </div>

        <div>
          <Label htmlFor="description" data-testid="label-description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A brief description of your website..."
            className="mt-1.5"
            rows={3}
            data-testid="textarea-description"
          />
        </div>

        <div>
          <Label htmlFor="theme" data-testid="label-theme">Theme</Label>
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger className="mt-1.5" data-testid="select-theme">
              <SelectValue placeholder="Select theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monochrome">Monochrome</SelectItem>
              <SelectItem value="gloss">Gloss</SelectItem>
              <SelectItem value="game">Game</SelectItem>
              <SelectItem value="app-ui">App UI</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="heroText" data-testid="label-hero-text">Hero Text</Label>
          <Textarea
            id="heroText"
            value={heroText}
            onChange={(e) => setHeroText(e.target.value)}
            placeholder="Main headline for your site..."
            className="mt-1.5"
            rows={2}
            data-testid="textarea-hero-text"
          />
        </div>

        <div>
          <Label htmlFor="palette" data-testid="label-palette">Color Palette</Label>
          <Select value={colorPalette} onValueChange={setColorPalette}>
            <SelectTrigger className="mt-1.5" data-testid="select-palette">
              <SelectValue placeholder="Select palette" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monochrome">Monochrome</SelectItem>
              <SelectItem value="high-contrast">High Contrast</SelectItem>
              <SelectItem value="warm">Warm</SelectItem>
              <SelectItem value="cool">Cool</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex gap-2 mt-2">
            {Object.entries(colorPresets[colorPalette as keyof typeof colorPresets] || {}).map(([key, color]) => (
              <div key={key} className="flex-1">
                <div
                  className="h-8 rounded border border-border"
                  style={{ backgroundColor: color }}
                />
                <p className="text-xs text-muted-foreground mt-1 capitalize">{key}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="file-upload" data-testid="label-file-upload">Upload Assets</Label>
          <Card className="mt-1.5 p-6 border-dashed cursor-pointer hover-elevate" data-testid="card-upload">
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">
                {uploading ? "Uploading..." : "Click to upload or drag files here"}
              </p>
              <p className="text-xs text-muted-foreground">
                PDF, DOCX, HTML, images (max 25MB)
              </p>
              <input
                id="file-upload"
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
                data-testid="input-file"
              />
            </label>
          </Card>
          
          {uploadedFiles.length > 0 && (
            <div className="mt-2 space-y-1">
              {uploadedFiles.map((url, i) => (
                <p key={i} className="text-xs text-muted-foreground">✓ {url.split('/').pop()}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      <Button
        onClick={handleApplyChanges}
        className="w-full"
        data-testid="button-apply-changes"
      >
        <Sparkles className="w-4 h-4 mr-2" />
        Apply Changes
      </Button>
    </div>
  );
}
