import { useState, useEffect } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Zap, Clock, Shield, Plus, Trash2, Star } from "lucide-react";
import { Card } from "@/components/ui/card";

export function AIForm() {
  const { settings, loading, updateSection } = useSettings();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    model: "gpt-5-x" as "gpt-5-x" | "gpt-5-mini" | "vision-capable",
    temperature: 0.2,
    autoRefine: true,
    maxTokens: 4000,
    maxRuntime: 30,
    computeTier: "balanced" as "fast" | "balanced" | "high-fidelity",
    previewWatermark: true,
    defaultStyle: "monochrome" as "monochrome" | "gloss" | "game" | "app-ui",
    safetyFilter: true,
    safetyLevel: "medium" as "low" | "medium" | "high",
    promptTemplates: [] as Array<{ id: string; name: string; template: string; isDefault: boolean }>,
  });

  const [newTemplate, setNewTemplate] = useState({ name: "", template: "" });

  useEffect(() => {
    if (settings?.ai) {
      setFormData({
        model: settings.ai.model,
        temperature: settings.ai.temperature,
        autoRefine: settings.ai.autoRefine,
        maxTokens: settings.ai.maxTokens,
        maxRuntime: settings.ai.maxRuntime,
        computeTier: settings.ai.computeTier,
        previewWatermark: settings.ai.previewWatermark,
        defaultStyle: settings.ai.defaultStyle,
        safetyFilter: settings.ai.safetyFilter,
        safetyLevel: settings.ai.safetyLevel,
        promptTemplates: settings.ai.promptTemplates || [],
      });
    }
  }, [settings]);

  const handleUpdate = async (field: keyof typeof formData, value: any) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);

    setIsSaving(true);
    try {
      await updateSection("ai", newData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save AI settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTemplate = async () => {
    if (!newTemplate.name.trim() || !newTemplate.template.trim()) {
      toast({
        title: "Error",
        description: "Template name and content are required",
        variant: "destructive",
      });
      return;
    }

    const template = {
      id: crypto.randomUUID(),
      name: newTemplate.name.trim(),
      template: newTemplate.template.trim(),
      isDefault: formData.promptTemplates.length === 0,
    };

    const updatedTemplates = [...formData.promptTemplates, template];
    await handleUpdate("promptTemplates", updatedTemplates);
    setNewTemplate({ name: "", template: "" });
    toast({
      title: "Success",
      description: "Prompt template added",
    });
  };

  const handleDeleteTemplate = async (id: string) => {
    const deletedTemplate = formData.promptTemplates.find(t => t.id === id);
    let updatedTemplates = formData.promptTemplates.filter(t => t.id !== id);
    
    // If deleting the default template and others remain, set first remaining as default
    if (deletedTemplate?.isDefault && updatedTemplates.length > 0) {
      updatedTemplates = updatedTemplates.map((t, index) => ({
        ...t,
        isDefault: index === 0,
      }));
    }
    
    await handleUpdate("promptTemplates", updatedTemplates);
    toast({
      title: "Success",
      description: "Prompt template deleted",
    });
  };

  const handleSetDefault = async (id: string) => {
    const updatedTemplates = formData.promptTemplates.map(t => ({
      ...t,
      isDefault: t.id === id,
    }));
    await handleUpdate("promptTemplates", updatedTemplates);
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
        <h2 className="text-2xl font-semibold settings-text-light">AI & Models</h2>
        <p className="text-muted-foreground mt-1">
          Configure AI generation settings and model preferences
        </p>
      </div>

      {/* Model Selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-muted-foreground" />
            <Label htmlFor="model" className="text-base">AI Model</Label>
          </div>
          {isSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
        <Select
          value={formData.model}
          onValueChange={(value) => handleUpdate("model", value)}
        >
          <SelectTrigger id="model" data-testid="select-ai-model">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gpt-5-x">GPT-5-X (Best Quality)</SelectItem>
            <SelectItem value="gpt-5-mini">GPT-5-Mini (Fast & Efficient)</SelectItem>
            <SelectItem value="vision-capable">Vision-Capable (Image Analysis)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {formData.model === "gpt-5-x" && "Premium model with highest quality outputs"}
          {formData.model === "gpt-5-mini" && "Optimized for speed and lower cost"}
          {formData.model === "vision-capable" && "Supports image and visual analysis"}
        </p>
      </div>

      {/* Temperature */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="temperature" className="text-base">Creativity (Temperature)</Label>
          <span className="text-sm text-muted-foreground">{formData.temperature.toFixed(1)}</span>
        </div>
        <Slider
          id="temperature"
          data-testid="slider-temperature"
          value={[formData.temperature]}
          onValueChange={([value]) => handleUpdate("temperature", value)}
          min={0}
          max={1}
          step={0.1}
          className="w-full"
        />
        <p className="text-sm text-muted-foreground">
          Lower values = more focused, Higher values = more creative
        </p>
      </div>

      {/* Compute Tier */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-muted-foreground" />
          <Label htmlFor="compute-tier" className="text-base">Compute Tier</Label>
        </div>
        <Select
          value={formData.computeTier}
          onValueChange={(value) => handleUpdate("computeTier", value)}
        >
          <SelectTrigger id="compute-tier" data-testid="select-compute-tier">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fast">Fast (2-3 seconds)</SelectItem>
            <SelectItem value="balanced">Balanced (3-5 seconds)</SelectItem>
            <SelectItem value="high-fidelity">High Fidelity (5-10 seconds)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Max Runtime */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <Label htmlFor="max-runtime" className="text-base">Max Runtime</Label>
          </div>
          <span className="text-sm text-muted-foreground">{formData.maxRuntime}s</span>
        </div>
        <Slider
          id="max-runtime"
          data-testid="slider-max-runtime"
          value={[formData.maxRuntime]}
          onValueChange={([value]) => handleUpdate("maxRuntime", value)}
          min={10}
          max={60}
          step={5}
          className="w-full"
        />
        <p className="text-sm text-muted-foreground">
          Maximum time allowed for AI generation before timeout
        </p>
      </div>

      {/* Max Tokens */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="max-tokens" className="text-base">Max Tokens</Label>
          <span className="text-sm text-muted-foreground">{formData.maxTokens}</span>
        </div>
        <Slider
          id="max-tokens"
          data-testid="slider-max-tokens"
          value={[formData.maxTokens]}
          onValueChange={([value]) => handleUpdate("maxTokens", value)}
          min={1000}
          max={8000}
          step={500}
          className="w-full"
        />
        <p className="text-sm text-muted-foreground">
          Maximum output length (higher = more detailed but slower)
        </p>
      </div>

      {/* Default Style */}
      <div className="space-y-3">
        <Label htmlFor="default-style" className="text-base">Default Style</Label>
        <Select
          value={formData.defaultStyle}
          onValueChange={(value) => handleUpdate("defaultStyle", value)}
        >
          <SelectTrigger id="default-style" data-testid="select-default-style">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monochrome">Monochrome (B&W Glass)</SelectItem>
            <SelectItem value="gloss">Glossy (High Contrast)</SelectItem>
            <SelectItem value="game">Game (Epic/Cinematic)</SelectItem>
            <SelectItem value="app-ui">App UI (Clean/Modern)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Auto Refine */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="auto-refine" className="text-base">Auto-Refine</Label>
          <p className="text-sm text-muted-foreground">Automatically improve generated code</p>
        </div>
        <Switch
          id="auto-refine"
          data-testid="toggle-auto-refine"
          checked={formData.autoRefine}
          onCheckedChange={(checked) => handleUpdate("autoRefine", checked)}
        />
      </div>

      {/* Preview Watermark */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="preview-watermark" className="text-base">Preview Watermark</Label>
          <p className="text-sm text-muted-foreground">Show YBUILT watermark on previews</p>
        </div>
        <Switch
          id="preview-watermark"
          data-testid="toggle-preview-watermark"
          checked={formData.previewWatermark}
          onCheckedChange={(checked) => handleUpdate("previewWatermark", checked)}
        />
      </div>

      {/* Safety Settings */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-medium">Safety & Moderation</h3>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="safety-filter" className="text-base">Safety Filter</Label>
            <p className="text-sm text-muted-foreground">Filter harmful or inappropriate content</p>
          </div>
          <Switch
            id="safety-filter"
            data-testid="toggle-safety-filter"
            checked={formData.safetyFilter}
            onCheckedChange={(checked) => handleUpdate("safetyFilter", checked)}
          />
        </div>

        <div className="space-y-3">
          <Label htmlFor="safety-level" className="text-base">Safety Level</Label>
          <Select
            value={formData.safetyLevel}
            onValueChange={(value) => handleUpdate("safetyLevel", value)}
            disabled={!formData.safetyFilter}
          >
            <SelectTrigger id="safety-level" data-testid="select-safety-level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low (Minimal Filtering)</SelectItem>
              <SelectItem value="medium">Medium (Balanced)</SelectItem>
              <SelectItem value="high">High (Strict Filtering)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Prompt Templates */}
      <Card className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-medium">Prompt Templates</h3>
          <p className="text-sm text-muted-foreground">
            Save and reuse custom prompts for consistent website generation
          </p>
        </div>

        {/* Existing Templates List */}
        {formData.promptTemplates.length > 0 && (
          <div className="space-y-3">
            {formData.promptTemplates.map((template) => (
              <Card key={template.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{template.name}</h4>
                      {template.isDefault && (
                        <Star className="w-4 h-4 fill-primary text-primary" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {template.template}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!template.isDefault && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSetDefault(template.id)}
                        data-testid={`button-set-default-${template.id}`}
                      >
                        <Star className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteTemplate(template.id)}
                      data-testid={`button-delete-template-${template.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Add New Template */}
        <div className="space-y-3 pt-3 border-t">
          <Label htmlFor="template-name" className="text-base">Add New Template</Label>
          <Input
            id="template-name"
            placeholder="Template name (e.g., E-commerce Landing Page)"
            value={newTemplate.name}
            onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
            data-testid="input-template-name"
          />
          <Textarea
            id="template-content"
            placeholder="Template prompt (e.g., Create a modern e-commerce landing page with hero section, featured products, and testimonials)"
            value={newTemplate.template}
            onChange={(e) => setNewTemplate({ ...newTemplate, template: e.target.value })}
            rows={3}
            data-testid="input-template-content"
          />
          <Button
            onClick={handleAddTemplate}
            disabled={!newTemplate.name.trim() || !newTemplate.template.trim()}
            data-testid="button-add-template"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Template
          </Button>
        </div>
      </Card>
    </div>
  );
}
