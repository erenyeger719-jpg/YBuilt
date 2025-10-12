import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ProjectTheme } from "@shared/schema";
import { Loader2, Palette, Type, Sparkles } from "lucide-react";

interface ThemeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

const defaultTheme: ProjectTheme = {
  meta: {
    name: "Custom Theme",
    createdAt: new Date().toISOString(),
    author: "demo",
  },
  fonts: {
    sans: "Inter",
    serif: "Georgia",
    mono: "Menlo",
  },
  borderRadius: "0.5rem",
  colors: {
    background: "#ffffff",
    text: "#000000",
    mutedBackground: "#f5f5f5",
    mutedText: "#666666",
    primaryBackground: "#141414",
    primaryText: "#fafafa",
    secondaryBackground: "#e5e5e5",
    secondaryText: "#0a0a0a",
    accentBackground: "#f0f0f0",
    accentText: "#0a0a0a",
    destructiveBackground: "#dc2626",
    destructiveText: "#fafafa",
    input: "#b3b3b3",
    border: "#d9d9d9",
    focusBorder: "#3d3d3d",
    cardBackground: "#fafafa",
    cardText: "#0d0d0d",
    popoverBackground: "#ebebeb",
    popoverText: "#232323",
    chart1: "#383838",
    chart2: "#474747",
    chart3: "#575757",
    chart4: "#666666",
    chart5: "#757575",
  },
  customColors: [],
};

const presets = {
  light: defaultTheme,
  dark: {
    ...defaultTheme,
    meta: { ...defaultTheme.meta, name: "Dark" },
    colors: {
      background: "#000000",
      text: "#ffffff",
      mutedBackground: "#0a0a0a",
      mutedText: "#999999",
      primaryBackground: "#ebebeb",
      primaryText: "#050505",
      secondaryBackground: "#1a1a1a",
      secondaryText: "#f5f5f5",
      accentBackground: "#0f0f0f",
      accentText: "#f5f5f5",
      destructiveBackground: "#dc2626",
      destructiveText: "#fafafa",
      input: "#4d4d4d",
      border: "#262626",
      focusBorder: "#c2c2c2",
      cardBackground: "#050505",
      cardText: "#f2f2f2",
      popoverBackground: "#141414",
      popoverText: "#dcdcdc",
      chart1: "#c7c7c7",
      chart2: "#b8b8b8",
      chart3: "#a8a8a8",
      chart4: "#999999",
      chart5: "#8a8a8a",
    },
  },
  highContrast: {
    ...defaultTheme,
    meta: { ...defaultTheme.meta, name: "High Contrast" },
    colors: {
      background: "#000000",
      text: "#ffffff",
      mutedBackground: "#1a1a1a",
      mutedText: "#e0e0e0",
      primaryBackground: "#ffffff",
      primaryText: "#000000",
      secondaryBackground: "#333333",
      secondaryText: "#ffffff",
      accentBackground: "#ffff00",
      accentText: "#000000",
      destructiveBackground: "#ff0000",
      destructiveText: "#ffffff",
      input: "#666666",
      border: "#ffffff",
      focusBorder: "#ffff00",
      cardBackground: "#1a1a1a",
      cardText: "#ffffff",
      popoverBackground: "#000000",
      popoverText: "#ffffff",
      chart1: "#00ffff",
      chart2: "#ff00ff",
      chart3: "#ffff00",
      chart4: "#00ff00",
      chart5: "#ff0000",
    },
  },
};

export default function ThemeModal({ open, onOpenChange, projectId }: ThemeModalProps) {
  const { toast } = useToast();
  const [theme, setTheme] = useState<ProjectTheme>(defaultTheme);
  const [livePreview, setLivePreview] = useState(false);

  // Load theme from API
  const { data: loadedTheme, isLoading } = useQuery<ProjectTheme | null>({
    queryKey: ["/api/workspace", projectId, "theme"],
    enabled: !!projectId && open,
  });

  // Initialize theme when loaded
  useEffect(() => {
    if (loadedTheme) {
      setTheme(loadedTheme);
      if (livePreview) {
        applyTheme(loadedTheme);
      }
    }
  }, [loadedTheme]);

  // Save theme mutation
  const saveMutation = useMutation({
    mutationFn: async (themeData: ProjectTheme) => {
      return apiRequest("POST", `/api/workspace/${projectId}/theme`, themeData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspace", projectId, "theme"] });
      toast({
        title: "Theme Saved",
        description: "Project theme has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save theme",
        variant: "destructive",
      });
    },
  });

  // Apply theme to CSS variables
  const applyTheme = (themeData: ProjectTheme) => {
    const root = document.documentElement;
    
    // Helper to convert hex to HSL
    const hexToHSL = (hex: string): string => {
      // Remove # if present
      hex = hex.replace(/^#/, '');
      
      // Convert hex to RGB
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;
      
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0, s = 0, l = (max + min) / 2;
      
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
        switch(max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      
      h = Math.round(h * 360);
      s = Math.round(s * 100);
      l = Math.round(l * 100);
      
      return `${h} ${s}% ${l}%`;
    };
    
    // Apply colors (convert to HSL and map to existing variables)
    root.style.setProperty("--background", hexToHSL(themeData.colors.background));
    root.style.setProperty("--foreground", hexToHSL(themeData.colors.text));
    root.style.setProperty("--primary", hexToHSL(themeData.colors.primaryBackground));
    root.style.setProperty("--primary-foreground", hexToHSL(themeData.colors.primaryText));
    root.style.setProperty("--accent", hexToHSL(themeData.colors.accentBackground));
    root.style.setProperty("--accent-foreground", hexToHSL(themeData.colors.accentText));
    root.style.setProperty("--destructive", hexToHSL(themeData.colors.destructiveBackground));
    root.style.setProperty("--destructive-foreground", hexToHSL(themeData.colors.destructiveText));
    root.style.setProperty("--border", hexToHSL(themeData.colors.border));
    root.style.setProperty("--card", hexToHSL(themeData.colors.cardBackground));
    root.style.setProperty("--card-foreground", hexToHSL(themeData.colors.cardText));
    
    // Apply fonts (these don't need conversion)
    root.style.setProperty("--font-sans", themeData.fonts.sans);
    root.style.setProperty("--font-serif", themeData.fonts.serif);
    root.style.setProperty("--font-mono", themeData.fonts.mono);
    
    // Apply border radius
    root.style.setProperty("--radius", themeData.borderRadius);
  };

  // Reset theme to default
  const handleReset = () => {
    setTheme(defaultTheme);
    if (livePreview) {
      applyTheme(defaultTheme);
    }
  };

  // Apply preset
  const handleApplyPreset = (presetKey: keyof typeof presets) => {
    const preset = presets[presetKey];
    setTheme({
      ...preset,
      meta: {
        ...preset.meta,
        createdAt: new Date().toISOString(),
        author: "demo",
      },
    });
    if (livePreview) {
      applyTheme(preset);
    }
  };

  // Update color
  const updateColor = (key: keyof ProjectTheme["colors"], value: string) => {
    const updated = {
      ...theme,
      colors: {
        ...theme.colors,
        [key]: value,
      },
    };
    setTheme(updated);
    if (livePreview) {
      applyTheme(updated);
    }
  };

  // Update font
  const updateFont = (key: keyof ProjectTheme["fonts"], value: string) => {
    const updated = {
      ...theme,
      fonts: {
        ...theme.fonts,
        [key]: value,
      },
    };
    setTheme(updated);
    if (livePreview) {
      applyTheme(updated);
    }
  };

  // Update border radius
  const updateBorderRadius = (value: string) => {
    const updated = {
      ...theme,
      borderRadius: value,
    };
    setTheme(updated);
    if (livePreview) {
      applyTheme(updated);
    }
  };

  // Toggle live preview
  const toggleLivePreview = () => {
    const newLivePreview = !livePreview;
    setLivePreview(newLivePreview);
    if (newLivePreview) {
      applyTheme(theme);
    }
  };

  // Save theme
  const handleSave = () => {
    saveMutation.mutate(theme);
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl" data-testid="modal-theme">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]" data-testid="modal-theme">
        <DialogHeader>
          <DialogTitle data-testid="text-theme-title">Theme for Project</DialogTitle>
          <DialogDescription>
            Customize colors, fonts, and visual styles for this workspace
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="colors" className="flex-1">
          <TabsList className="grid w-full grid-cols-3" data-testid="tabs-theme">
            <TabsTrigger value="colors" data-testid="tab-colors">
              <Palette className="w-4 h-4 mr-2" />
              Colors
            </TabsTrigger>
            <TabsTrigger value="typography" data-testid="tab-typography">
              <Type className="w-4 h-4 mr-2" />
              Typography
            </TabsTrigger>
            <TabsTrigger value="presets" data-testid="tab-presets">
              <Sparkles className="w-4 h-4 mr-2" />
              Presets
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[400px] mt-4">
            <TabsContent value="colors" className="space-y-4 px-1">
              <div className="grid grid-cols-2 gap-4">
                {/* Core Colors */}
                <div className="space-y-2">
                  <Label htmlFor="color-background" data-testid="label-background">
                    Background
                  </Label>
                  <Input
                    id="color-background"
                    type="color"
                    value={theme.colors.background}
                    onChange={(e) => updateColor("background", e.target.value)}
                    className="h-10"
                    data-testid="input-background"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="color-text" data-testid="label-text">
                    Text
                  </Label>
                  <Input
                    id="color-text"
                    type="color"
                    value={theme.colors.text}
                    onChange={(e) => updateColor("text", e.target.value)}
                    className="h-10"
                    data-testid="input-text"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="color-primary-bg" data-testid="label-primary-bg">
                    Primary Background
                  </Label>
                  <Input
                    id="color-primary-bg"
                    type="color"
                    value={theme.colors.primaryBackground}
                    onChange={(e) => updateColor("primaryBackground", e.target.value)}
                    className="h-10"
                    data-testid="input-primary-bg"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="color-primary-text" data-testid="label-primary-text">
                    Primary Text
                  </Label>
                  <Input
                    id="color-primary-text"
                    type="color"
                    value={theme.colors.primaryText}
                    onChange={(e) => updateColor("primaryText", e.target.value)}
                    className="h-10"
                    data-testid="input-primary-text"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="color-accent-bg" data-testid="label-accent-bg">
                    Accent Background
                  </Label>
                  <Input
                    id="color-accent-bg"
                    type="color"
                    value={theme.colors.accentBackground}
                    onChange={(e) => updateColor("accentBackground", e.target.value)}
                    className="h-10"
                    data-testid="input-accent-bg"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="color-destructive-bg" data-testid="label-destructive-bg">
                    Destructive
                  </Label>
                  <Input
                    id="color-destructive-bg"
                    type="color"
                    value={theme.colors.destructiveBackground}
                    onChange={(e) => updateColor("destructiveBackground", e.target.value)}
                    className="h-10"
                    data-testid="input-destructive-bg"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="color-border" data-testid="label-border">
                    Border
                  </Label>
                  <Input
                    id="color-border"
                    type="color"
                    value={theme.colors.border}
                    onChange={(e) => updateColor("border", e.target.value)}
                    className="h-10"
                    data-testid="input-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="color-card-bg" data-testid="label-card-bg">
                    Card Background
                  </Label>
                  <Input
                    id="color-card-bg"
                    type="color"
                    value={theme.colors.cardBackground}
                    onChange={(e) => updateColor("cardBackground", e.target.value)}
                    className="h-10"
                    data-testid="input-card-bg"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="typography" className="space-y-4 px-1">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="font-sans" data-testid="label-font-sans">
                    Sans Serif Font
                  </Label>
                  <Select value={theme.fonts.sans} onValueChange={(value) => updateFont("sans", value)}>
                    <SelectTrigger id="font-sans" data-testid="select-font-sans">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Inter">Inter</SelectItem>
                      <SelectItem value="system-ui">System UI</SelectItem>
                      <SelectItem value="Arial">Arial</SelectItem>
                      <SelectItem value="Helvetica">Helvetica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="font-serif" data-testid="label-font-serif">
                    Serif Font
                  </Label>
                  <Select value={theme.fonts.serif} onValueChange={(value) => updateFont("serif", value)}>
                    <SelectTrigger id="font-serif" data-testid="select-font-serif">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Georgia">Georgia</SelectItem>
                      <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                      <SelectItem value="serif">Serif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="font-mono" data-testid="label-font-mono">
                    Monospace Font
                  </Label>
                  <Select value={theme.fonts.mono} onValueChange={(value) => updateFont("mono", value)}>
                    <SelectTrigger id="font-mono" data-testid="select-font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Menlo">Menlo</SelectItem>
                      <SelectItem value="Monaco">Monaco</SelectItem>
                      <SelectItem value="Courier New">Courier New</SelectItem>
                      <SelectItem value="monospace">Monospace</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="border-radius" data-testid="label-border-radius">
                    Border Radius: {theme.borderRadius}
                  </Label>
                  <Slider
                    id="border-radius"
                    value={[parseFloat(theme.borderRadius)]}
                    onValueChange={([value]) => updateBorderRadius(`${value}rem`)}
                    min={0}
                    max={2}
                    step={0.1}
                    className="w-full"
                    data-testid="slider-border-radius"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="presets" className="space-y-4 px-1">
              <div className="grid grid-cols-1 gap-4">
                <Button
                  variant="outline"
                  onClick={() => handleApplyPreset("light")}
                  className="justify-start h-auto p-4"
                  data-testid="button-preset-light"
                >
                  <div className="text-left">
                    <div className="font-semibold">Light</div>
                    <div className="text-sm text-muted-foreground">Clean, bright theme for daylight use</div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleApplyPreset("dark")}
                  className="justify-start h-auto p-4"
                  data-testid="button-preset-dark"
                >
                  <div className="text-left">
                    <div className="font-semibold">Dark</div>
                    <div className="text-sm text-muted-foreground">Comfortable dark theme for low light</div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleApplyPreset("highContrast")}
                  className="justify-start h-auto p-4"
                  data-testid="button-preset-high-contrast"
                >
                  <div className="text-left">
                    <div className="font-semibold">High Contrast</div>
                    <div className="text-sm text-muted-foreground">Maximum contrast for accessibility</div>
                  </div>
                </Button>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLivePreview}
              data-testid="button-live-preview"
            >
              {livePreview ? "Disable" : "Enable"} Live Preview
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              data-testid="button-reset-theme"
            >
              Reset
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-theme"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              data-testid="button-save-theme"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Theme"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
