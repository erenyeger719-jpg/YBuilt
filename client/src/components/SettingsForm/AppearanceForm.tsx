import { useState, useEffect } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export function AppearanceForm() {
  const { settings, loading, updateSection } = useSettings();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // Local state for immediate UI updates
  const [formData, setFormData] = useState({
    theme: "system" as "system" | "dark" | "light" | "force-library",
    glassIntensity: 80,
    glossFinish: true,
    parallaxIntensity: 20,
    motion: "full" as "full" | "reduced" | "none",
    lowPower: false,
    lowBandwidth: false,
    fontFamily: "inter" as "valmeria" | "inter" | "poppins",
    fontSize: 16,
  });

  // Initialize from settings
  useEffect(() => {
    if (settings?.appearance) {
      setFormData(settings.appearance);
    }
  }, [settings]);

  const handleUpdate = async (field: keyof typeof formData, value: any) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);

    // Debounced save
    setIsSaving(true);
    try {
      await updateSection("appearance", newData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save appearance settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold settings-text-light">Appearance</h2>
        <p className="text-muted-foreground mt-1">
          Customize the visual appearance and theme of the application
        </p>
      </div>

      {/* Theme */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="theme" className="text-base">Theme</Label>
          {isSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
        <RadioGroup
          value={formData.theme}
          onValueChange={(value) => handleUpdate("theme", value)}
          className="grid grid-cols-2 gap-4"
        >
          <div className="flex items-center space-x-2 border rounded-md p-3 hover-elevate active-elevate-2">
            <RadioGroupItem value="system" id="theme-system" data-testid="radio-theme-system" />
            <Label htmlFor="theme-system" className="cursor-pointer flex-1">System</Label>
          </div>
          <div className="flex items-center space-x-2 border rounded-md p-3 hover-elevate active-elevate-2">
            <RadioGroupItem value="dark" id="theme-dark" data-testid="radio-theme-dark" />
            <Label htmlFor="theme-dark" className="cursor-pointer flex-1">Dark</Label>
          </div>
          <div className="flex items-center space-x-2 border rounded-md p-3 hover-elevate active-elevate-2">
            <RadioGroupItem value="light" id="theme-light" data-testid="radio-theme-light" />
            <Label htmlFor="theme-light" className="cursor-pointer flex-1">Light</Label>
          </div>
          <div className="flex items-center space-x-2 border rounded-md p-3 hover-elevate active-elevate-2">
            <RadioGroupItem value="force-library" id="theme-library" data-testid="radio-theme-library" />
            <Label htmlFor="theme-library" className="cursor-pointer flex-1">Library</Label>
          </div>
        </RadioGroup>
      </div>

      {/* Glass Intensity */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="glass-intensity" className="text-base">Glass Intensity</Label>
          <span className="text-sm text-muted-foreground">{formData.glassIntensity}%</span>
        </div>
        <Slider
          id="glass-intensity"
          data-testid="slider-glass-intensity"
          value={[formData.glassIntensity]}
          onValueChange={([value]) => handleUpdate("glassIntensity", value)}
          min={0}
          max={100}
          step={5}
          className="w-full"
        />
      </div>

      {/* Gloss Finish */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="gloss-finish" className="text-base">Gloss Finish</Label>
          <p className="text-sm text-muted-foreground">Add specular highlights to glass surfaces</p>
        </div>
        <Switch
          id="gloss-finish"
          data-testid="toggle-gloss-finish"
          checked={formData.glossFinish}
          onCheckedChange={(checked) => handleUpdate("glossFinish", checked)}
        />
      </div>

      {/* Parallax Intensity */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="parallax-intensity" className="text-base">Parallax Intensity</Label>
          <span className="text-sm text-muted-foreground">{formData.parallaxIntensity}%</span>
        </div>
        <Slider
          id="parallax-intensity"
          data-testid="slider-parallax-intensity"
          value={[formData.parallaxIntensity]}
          onValueChange={([value]) => handleUpdate("parallaxIntensity", value)}
          min={0}
          max={100}
          step={5}
          className="w-full"
        />
      </div>

      {/* Motion */}
      <div className="space-y-3">
        <Label htmlFor="motion" className="text-base">Motion & Animations</Label>
        <Select
          value={formData.motion}
          onValueChange={(value) => handleUpdate("motion", value)}
        >
          <SelectTrigger id="motion" data-testid="select-motion">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="full">Full Motion</SelectItem>
            <SelectItem value="reduced">Reduced Motion</SelectItem>
            <SelectItem value="none">No Motion</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Font Family */}
      <div className="space-y-3">
        <Label htmlFor="font-family" className="text-base">Font Family</Label>
        <Select
          value={formData.fontFamily}
          onValueChange={(value) => handleUpdate("fontFamily", value)}
        >
          <SelectTrigger id="font-family" data-testid="select-font-family">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="inter">Inter</SelectItem>
            <SelectItem value="valmeria">Valmeria</SelectItem>
            <SelectItem value="poppins">Poppins</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Font Size */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="font-size" className="text-base">Font Size</Label>
          <span className="text-sm text-muted-foreground">{formData.fontSize}px</span>
        </div>
        <Slider
          id="font-size"
          data-testid="slider-font-size"
          value={[formData.fontSize]}
          onValueChange={([value]) => handleUpdate("fontSize", value)}
          min={12}
          max={20}
          step={1}
          className="w-full"
        />
      </div>

      {/* Low Power Mode */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="low-power" className="text-base">Low Power Mode</Label>
          <p className="text-sm text-muted-foreground">Reduce visual effects to save battery</p>
        </div>
        <Switch
          id="low-power"
          data-testid="toggle-low-power"
          checked={formData.lowPower}
          onCheckedChange={(checked) => handleUpdate("lowPower", checked)}
        />
      </div>

      {/* Low Bandwidth Mode */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="low-bandwidth" className="text-base">Low Bandwidth Mode</Label>
          <p className="text-sm text-muted-foreground">Use lower quality assets to reduce data usage</p>
        </div>
        <Switch
          id="low-bandwidth"
          data-testid="toggle-low-bandwidth"
          checked={formData.lowBandwidth}
          onCheckedChange={(checked) => handleUpdate("lowBandwidth", checked)}
        />
      </div>
    </div>
  );
}
