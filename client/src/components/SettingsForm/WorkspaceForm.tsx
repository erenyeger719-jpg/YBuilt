import { useState, useEffect } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import type { Settings } from "@shared/schema";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Loader2, HelpCircle, Plus, Trash2, Monitor, Tablet, Smartphone } from "lucide-react";

export function WorkspaceForm() {
  const { settings, loading, updateSection } = useSettings();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<Settings['workspace']>({
    projectVisibility: "private",
    defaultBranch: "main",
    projectRegion: "auto",
    defaultTemplate: "landing",
    computeTier: "balanced",
    memoryLimit: 512,
    concurrencySlots: 2,
    autoScaling: false,
    agentAutonomyDefault: "medium",
    autoApplyEdits: "review",
    buildTraceVerbosity: "normal",
    safetyScan: true,
    autoSaveDrafts: true,
    previewSandboxMode: "lenient",
    devicePreset: "desktop",
    snapshotThumbnails: true,
    allowProjectWebhooks: true,
    envVariables: [],
    paidIntegrations: false,
    autoCreatePreview: true,
    storageRegion: "india",
  });

  useEffect(() => {
    if (settings?.workspace) {
      setFormData(settings.workspace);
    }
  }, [settings]);

  const handleUpdate = async (updates: Partial<typeof formData>) => {
    const newData = { ...formData, ...updates };
    setFormData(newData);

    setIsSaving(true);
    try {
      await updateSection("workspace", newData);
      toast({
        title: "Settings saved",
        description: "Workspace preferences updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save workspace settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const addEnvVariable = () => {
    handleUpdate({
      envVariables: [...formData.envVariables, { key: "", value: "" }]
    });
  };

  const removeEnvVariable = (index: number) => {
    handleUpdate({
      envVariables: formData.envVariables.filter((_, i) => i !== index)
    });
  };

  const updateEnvVariable = (index: number, field: "key" | "value", value: string) => {
    const updated = [...formData.envVariables];
    updated[index] = { ...updated[index], [field]: value };
    handleUpdate({ envVariables: updated });
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Workspace Settings</h2>
          <p className="text-muted-foreground mt-1">
            Configure default project settings and storage preferences
          </p>
        </div>
        {isSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>

      {/* General Settings */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium">General Settings</h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label>Project Visibility</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Control who can see your projects by default</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <RadioGroup
              value={formData.projectVisibility}
              onValueChange={(value) => handleUpdate({ projectVisibility: value as any })}
              data-testid="radio-project-visibility"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="public" id="visibility-public" data-testid="radio-visibility-public" />
                <Label htmlFor="visibility-public">Public</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="unlisted" id="visibility-unlisted" data-testid="radio-visibility-unlisted" />
                <Label htmlFor="visibility-unlisted">Unlisted</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="private" id="visibility-private" data-testid="radio-visibility-private" />
                <Label htmlFor="visibility-private">Private</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="default-branch">Default Branch</Label>
            <Select
              value={formData.defaultBranch}
              onValueChange={(value) => handleUpdate({ defaultBranch: value as any })}
            >
              <SelectTrigger id="default-branch" data-testid="select-default-branch">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">main</SelectItem>
                <SelectItem value="dev">dev</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-region">Project Region</Label>
            <Select
              value={formData.projectRegion}
              onValueChange={(value) => handleUpdate({ projectRegion: value as any })}
            >
              <SelectTrigger id="project-region" data-testid="select-project-region">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="asia">Asia</SelectItem>
                <SelectItem value="eu">Europe</SelectItem>
                <SelectItem value="us">United States</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="default-template">Default Template</Label>
            <Select
              value={formData.defaultTemplate}
              onValueChange={(value) => handleUpdate({ defaultTemplate: value as any })}
            >
              <SelectTrigger id="default-template" data-testid="select-default-template">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="landing">Landing Page</SelectItem>
                <SelectItem value="ecommerce">E-commerce</SelectItem>
                <SelectItem value="blog">Blog</SelectItem>
                <SelectItem value="spa">Single Page App</SelectItem>
                <SelectItem value="api">API</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      {/* Runtime & Resources */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium">Runtime & Resources</h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label>Compute Tier</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Small: 1 vCPU, Balanced: 2 vCPU, Performance: 4 vCPU</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <RadioGroup
              value={formData.computeTier}
              onValueChange={(value) => handleUpdate({ computeTier: value as any })}
              data-testid="radio-compute-tier"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="small" id="tier-small" data-testid="radio-tier-small" />
                <Label htmlFor="tier-small">Small</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="balanced" id="tier-balanced" data-testid="radio-tier-balanced" />
                <Label htmlFor="tier-balanced">Balanced</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="performance" id="tier-performance" data-testid="radio-tier-performance" />
                <Label htmlFor="tier-performance">Performance</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="memory-limit">Memory Limit</Label>
              <span className="text-sm text-muted-foreground" data-testid="text-memory-value">
                {formData.memoryLimit} MB
              </span>
            </div>
            <Slider
              id="memory-limit"
              data-testid="slider-memory-limit"
              min={128}
              max={4096}
              step={128}
              value={[formData.memoryLimit]}
              onValueChange={([value]) => handleUpdate({ memoryLimit: value })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="concurrency-slots">Concurrency Slots</Label>
              <span className="text-sm text-muted-foreground" data-testid="text-concurrency-value">
                {formData.concurrencySlots}
              </span>
            </div>
            <Slider
              id="concurrency-slots"
              data-testid="slider-concurrency-slots"
              min={1}
              max={10}
              step={1}
              value={[formData.concurrencySlots]}
              onValueChange={([value]) => handleUpdate({ concurrencySlots: value })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-scaling">Auto Scaling</Label>
              <p className="text-sm text-muted-foreground">
                Automatically adjust resources based on demand
              </p>
            </div>
            <Switch
              id="auto-scaling"
              data-testid="toggle-auto-scaling"
              checked={formData.autoScaling}
              onCheckedChange={(checked) => handleUpdate({ autoScaling: checked })}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Agent & Build Pipeline */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium">Agent & Build Pipeline</h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label>Agent Autonomy Default</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Low: Ask before changes, Medium: Some auto edits, High: More autonomy, Max: Full autonomy</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <RadioGroup
              value={formData.agentAutonomyDefault}
              onValueChange={(value) => handleUpdate({ agentAutonomyDefault: value as any })}
              data-testid="radio-agent-autonomy"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="low" id="autonomy-low" data-testid="radio-autonomy-low" />
                <Label htmlFor="autonomy-low">Low</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="medium" id="autonomy-medium" data-testid="radio-autonomy-medium" />
                <Label htmlFor="autonomy-medium">Medium</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="high" id="autonomy-high" data-testid="radio-autonomy-high" />
                <Label htmlFor="autonomy-high">High</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="max" id="autonomy-max" data-testid="radio-autonomy-max" />
                <Label htmlFor="autonomy-max">Max</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="auto-apply-edits">Auto Apply Edits</Label>
            <Select
              value={formData.autoApplyEdits}
              onValueChange={(value) => handleUpdate({ autoApplyEdits: value as any })}
            >
              <SelectTrigger id="auto-apply-edits" data-testid="select-auto-apply-edits">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off</SelectItem>
                <SelectItem value="review">Review</SelectItem>
                <SelectItem value="auto-medium-plus">Auto (Medium+)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="build-trace-verbosity">Build Trace Verbosity</Label>
            <Select
              value={formData.buildTraceVerbosity}
              onValueChange={(value) => handleUpdate({ buildTraceVerbosity: value as any })}
            >
              <SelectTrigger id="build-trace-verbosity" data-testid="select-build-trace-verbosity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minimal">Minimal</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="full">Full</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="safety-scan">Safety Scan</Label>
              <p className="text-sm text-muted-foreground">
                Scan builds for security vulnerabilities
              </p>
            </div>
            <Switch
              id="safety-scan"
              data-testid="toggle-safety-scan"
              checked={formData.safetyScan}
              onCheckedChange={(checked) => handleUpdate({ safetyScan: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-save-drafts">Auto Save Drafts</Label>
              <p className="text-sm text-muted-foreground">
                Automatically save your work as drafts
              </p>
            </div>
            <Switch
              id="auto-save-drafts"
              data-testid="toggle-auto-save-drafts"
              checked={formData.autoSaveDrafts}
              onCheckedChange={(checked) => handleUpdate({ autoSaveDrafts: checked })}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Preview & Sandbox */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium">Preview & Sandbox</h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="preview-sandbox-mode">Preview Sandbox Mode</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Strict: Limited permissions, Lenient: More freedom, Custom: Your rules</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Select
              value={formData.previewSandboxMode}
              onValueChange={(value) => handleUpdate({ previewSandboxMode: value as any })}
            >
              <SelectTrigger id="preview-sandbox-mode" data-testid="select-preview-sandbox-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="strict">Strict</SelectItem>
                <SelectItem value="lenient">Lenient</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Device Preset</Label>
            <RadioGroup
              value={formData.devicePreset}
              onValueChange={(value) => handleUpdate({ devicePreset: value as any })}
              data-testid="radio-device-preset"
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="desktop" id="device-desktop" data-testid="radio-device-desktop" />
                <Label htmlFor="device-desktop" className="flex items-center gap-2 cursor-pointer">
                  <Monitor className="w-4 h-4" />
                  Desktop
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="tablet" id="device-tablet" data-testid="radio-device-tablet" />
                <Label htmlFor="device-tablet" className="flex items-center gap-2 cursor-pointer">
                  <Tablet className="w-4 h-4" />
                  Tablet
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mobile" id="device-mobile" data-testid="radio-device-mobile" />
                <Label htmlFor="device-mobile" className="flex items-center gap-2 cursor-pointer">
                  <Smartphone className="w-4 h-4" />
                  Mobile
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="snapshot-thumbnails">Snapshot Thumbnails</Label>
              <p className="text-sm text-muted-foreground">
                Generate preview thumbnails for snapshots
              </p>
            </div>
            <Switch
              id="snapshot-thumbnails"
              data-testid="toggle-snapshot-thumbnails"
              checked={formData.snapshotThumbnails}
              onCheckedChange={(checked) => handleUpdate({ snapshotThumbnails: checked })}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Integrations & Secrets */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium">Integrations & Secrets</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="allow-webhooks">Allow Project Webhooks</Label>
              <p className="text-sm text-muted-foreground">
                Enable webhooks for project events
              </p>
            </div>
            <Switch
              id="allow-webhooks"
              data-testid="toggle-allow-webhooks"
              checked={formData.allowProjectWebhooks}
              onCheckedChange={(checked) => handleUpdate({ allowProjectWebhooks: checked })}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Environment Variables</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={addEnvVariable}
                data-testid="button-add-env-variable"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Variable
              </Button>
            </div>

            {formData.envVariables.length === 0 ? (
              <p className="text-sm text-muted-foreground">No environment variables configured</p>
            ) : (
              <div className="space-y-2">
                {formData.envVariables.map((env, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex gap-2">
                        <Input
                          placeholder="KEY"
                          value={env.key}
                          onChange={(e) => updateEnvVariable(index, "key", e.target.value)}
                          data-testid={`input-env-key-${index}`}
                          className="flex-1"
                        />
                        <Input
                          placeholder="value"
                          value={env.value}
                          onChange={(e) => updateEnvVariable(index, "value", e.target.value)}
                          data-testid={`input-env-value-${index}`}
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeEnvVariable(index)}
                          data-testid={`button-remove-env-${index}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="paid-integrations">Paid Integrations</Label>
              <p className="text-sm text-muted-foreground">
                Enable access to premium integrations
              </p>
            </div>
            <Switch
              id="paid-integrations"
              data-testid="toggle-paid-integrations"
              checked={formData.paidIntegrations}
              onCheckedChange={(checked) => handleUpdate({ paidIntegrations: checked })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
