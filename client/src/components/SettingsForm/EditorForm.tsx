import { useState, useEffect } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import type { Settings } from "@shared/schema";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Loader2, HelpCircle } from "lucide-react";

export function EditorForm() {
  const { settings, loading, updateSection } = useSettings();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<Settings['editor']>({
    theme: "dark",
    fontFamily: "Inter",
    fontSize: 14,
    lineHeight: 1.5,
    tabSize: 2,
    indentWithTabs: false,
    cursorStyle: "line",
    wordWrap: true,
    autoComplete: true,
    inlineAiSuggestions: "suggest",
    formatOnSave: true,
    defaultFormatter: "prettier",
    linterEnabled: true,
    linterRuleset: "recommended",
    codeLens: true,
    minimap: true,
    keymap: "default",
    autosaveInterval: "15s",
    aiModel: "claude-sonnet",
    aiComputeTier: "balanced",
    maxTokens: 2000,
    autoRunTests: false,
    suggestionTrigger: "tab",
    codePrivacy: "hosted-llm",
    telemetryOptOut: false,
    template: "starter",
    language: "js",
    autosave: 15,
    previewResolution: "auto",
    lintOnSave: true,
  });

  useEffect(() => {
    if (settings?.editor) {
      setFormData(settings.editor);
    }
  }, [settings]);

  const handleUpdate = async (updates: Partial<typeof formData>) => {
    const newData = { ...formData, ...updates };
    setFormData(newData);

    setIsSaving(true);
    try {
      await updateSection("editor", newData);
      toast({
        title: "Settings saved",
        description: "Editor preferences updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save editor settings",
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Editor Settings</h2>
          <p className="text-muted-foreground mt-1">
            Configure your code editor and development environment
          </p>
        </div>
        {isSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Core Editor Options */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium">Core Editor Options</h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label>Editor Theme</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Choose the color scheme for your code editor</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <RadioGroup
              value={formData.theme}
              onValueChange={(value) => handleUpdate({ theme: value as any })}
              data-testid="radio-editor-theme"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="light" id="theme-light" data-testid="radio-theme-light" />
                <Label htmlFor="theme-light">Light</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dark" id="theme-dark" data-testid="radio-theme-dark" />
                <Label htmlFor="theme-dark">Dark</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="system" id="theme-system" data-testid="radio-theme-system" />
                <Label htmlFor="theme-system">System</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="theme-custom" data-testid="radio-theme-custom" />
                <Label htmlFor="theme-custom">Custom</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="font-family">Font Family</Label>
            <Select
              value={formData.fontFamily}
              onValueChange={(value) => handleUpdate({ fontFamily: value as any })}
            >
              <SelectTrigger id="font-family" data-testid="select-font-family">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Inter">Inter</SelectItem>
                <SelectItem value="Poppins">Poppins</SelectItem>
                <SelectItem value="Menlo">Menlo</SelectItem>
                <SelectItem value="Open Sans">Open Sans</SelectItem>
                <SelectItem value="Custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="font-size">Font Size</Label>
              <span className="text-sm text-muted-foreground" data-testid="text-font-size-value">
                {formData.fontSize}px
              </span>
            </div>
            <Slider
              id="font-size"
              data-testid="slider-font-size"
              min={12}
              max={20}
              step={1}
              value={[formData.fontSize]}
              onValueChange={([value]) => handleUpdate({ fontSize: value })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="line-height">Line Height</Label>
              <span className="text-sm text-muted-foreground" data-testid="text-line-height-value">
                {formData.lineHeight}
              </span>
            </div>
            <Slider
              id="line-height"
              data-testid="slider-line-height"
              min={1.0}
              max={1.8}
              step={0.1}
              value={[formData.lineHeight]}
              onValueChange={([value]) => handleUpdate({ lineHeight: value })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="tab-size">Tab Size</Label>
              <span className="text-sm text-muted-foreground" data-testid="text-tab-size-value">
                {formData.tabSize}
              </span>
            </div>
            <Slider
              id="tab-size"
              data-testid="slider-tab-size"
              min={2}
              max={8}
              step={1}
              value={[formData.tabSize]}
              onValueChange={([value]) => handleUpdate({ tabSize: value })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="indent-with-tabs">Indent With Tabs</Label>
              <p className="text-sm text-muted-foreground">
                Use tabs instead of spaces for indentation
              </p>
            </div>
            <Switch
              id="indent-with-tabs"
              data-testid="switch-indent-with-tabs"
              checked={formData.indentWithTabs}
              onCheckedChange={(checked) => handleUpdate({ indentWithTabs: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cursor-style">Cursor Style</Label>
            <Select
              value={formData.cursorStyle}
              onValueChange={(value) => handleUpdate({ cursorStyle: value as any })}
            >
              <SelectTrigger id="cursor-style" data-testid="select-cursor-style">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="block">Block</SelectItem>
                <SelectItem value="line">Line</SelectItem>
                <SelectItem value="underline">Underline</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="word-wrap">Word Wrap</Label>
              <p className="text-sm text-muted-foreground">
                Wrap long lines to fit in the editor
              </p>
            </div>
            <Switch
              id="word-wrap"
              data-testid="switch-word-wrap"
              checked={formData.wordWrap}
              onCheckedChange={(checked) => handleUpdate({ wordWrap: checked })}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Code Assist & Linting */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium">Code Assist & Linting</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-complete">Auto Complete</Label>
              <p className="text-sm text-muted-foreground">
                Enable code completion suggestions
              </p>
            </div>
            <Switch
              id="auto-complete"
              data-testid="switch-auto-complete"
              checked={formData.autoComplete}
              onCheckedChange={(checked) => handleUpdate({ autoComplete: checked })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="inline-ai-suggestions">Inline AI Suggestions</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Control how AI-powered code suggestions appear</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Select
              value={formData.inlineAiSuggestions}
              onValueChange={(value) => handleUpdate({ inlineAiSuggestions: value as any })}
            >
              <SelectTrigger id="inline-ai-suggestions" data-testid="select-inline-ai-suggestions">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off</SelectItem>
                <SelectItem value="suggest">Suggest</SelectItem>
                <SelectItem value="auto-insert">Auto Insert</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="format-on-save">Format On Save</Label>
              <p className="text-sm text-muted-foreground">
                Automatically format code when saving
              </p>
            </div>
            <Switch
              id="format-on-save"
              data-testid="switch-format-on-save"
              checked={formData.formatOnSave}
              onCheckedChange={(checked) => handleUpdate({ formatOnSave: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="default-formatter">Default Formatter</Label>
            <Select
              value={formData.defaultFormatter}
              onValueChange={(value) => handleUpdate({ defaultFormatter: value as any })}
            >
              <SelectTrigger id="default-formatter" data-testid="select-default-formatter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prettier">Prettier</SelectItem>
                <SelectItem value="eslint">ESLint</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="linter-enabled">Linter Enabled</Label>
              <p className="text-sm text-muted-foreground">
                Enable code linting and error detection
              </p>
            </div>
            <Switch
              id="linter-enabled"
              data-testid="switch-linter-enabled"
              checked={formData.linterEnabled}
              onCheckedChange={(checked) => handleUpdate({ linterEnabled: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="linter-ruleset">Linter Ruleset</Label>
            <Select
              value={formData.linterRuleset}
              onValueChange={(value) => handleUpdate({ linterRuleset: value as any })}
            >
              <SelectTrigger id="linter-ruleset" data-testid="select-linter-ruleset">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recommended">Recommended</SelectItem>
                <SelectItem value="strict">Strict</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="code-lens">Code Lens</Label>
              <p className="text-sm text-muted-foreground">
                Show inline code annotations and references
              </p>
            </div>
            <Switch
              id="code-lens"
              data-testid="switch-code-lens"
              checked={formData.codeLens}
              onCheckedChange={(checked) => handleUpdate({ codeLens: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="minimap">Minimap</Label>
              <p className="text-sm text-muted-foreground">
                Show code overview minimap on the side
              </p>
            </div>
            <Switch
              id="minimap"
              data-testid="switch-minimap"
              checked={formData.minimap}
              onCheckedChange={(checked) => handleUpdate({ minimap: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="keymap">Keymap</Label>
            <Select
              value={formData.keymap}
              onValueChange={(value) => handleUpdate({ keymap: value as any })}
            >
              <SelectTrigger id="keymap" data-testid="select-keymap">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="vscode">VS Code</SelectItem>
                <SelectItem value="sublime">Sublime</SelectItem>
                <SelectItem value="emacs">Emacs</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="autosave-interval">Autosave Interval</Label>
            <Select
              value={formData.autosaveInterval}
              onValueChange={(value) => handleUpdate({ autosaveInterval: value as any })}
            >
              <SelectTrigger id="autosave-interval" data-testid="select-autosave-interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off</SelectItem>
                <SelectItem value="5s">5 seconds</SelectItem>
                <SelectItem value="15s">15 seconds</SelectItem>
                <SelectItem value="60s">60 seconds</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      {/* AI Integration */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium">AI Integration</h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="ai-model">AI Model</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Choose the AI model for code generation and suggestions</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Select
              value={formData.aiModel}
              onValueChange={(value) => handleUpdate({ aiModel: value as any })}
            >
              <SelectTrigger id="ai-model" data-testid="select-ai-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-coder">GPT Coder</SelectItem>
                <SelectItem value="mistral-codestral">Mistral Codestral</SelectItem>
                <SelectItem value="claude-sonnet">Claude Sonnet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-compute-tier">AI Compute Tier</Label>
            <Select
              value={formData.aiComputeTier}
              onValueChange={(value) => handleUpdate({ aiComputeTier: value as any })}
            >
              <SelectTrigger id="ai-compute-tier" data-testid="select-ai-compute-tier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="balanced">Balanced</SelectItem>
                <SelectItem value="fast">Fast</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="max-tokens">Max Tokens</Label>
              <span className="text-sm text-muted-foreground" data-testid="text-max-tokens-value">
                {formData.maxTokens} tokens
              </span>
            </div>
            <Slider
              id="max-tokens"
              data-testid="slider-max-tokens"
              min={100}
              max={8000}
              step={100}
              value={[formData.maxTokens]}
              onValueChange={([value]) => handleUpdate({ maxTokens: value })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-run-tests">Auto Run Tests</Label>
              <p className="text-sm text-muted-foreground">
                Automatically run tests after code changes
              </p>
            </div>
            <Switch
              id="auto-run-tests"
              data-testid="switch-auto-run-tests"
              checked={formData.autoRunTests}
              onCheckedChange={(checked) => handleUpdate({ autoRunTests: checked })}
            />
          </div>

          <div className="space-y-3">
            <Label>Suggestion Trigger</Label>
            <RadioGroup
              value={formData.suggestionTrigger}
              onValueChange={(value) => handleUpdate({ suggestionTrigger: value as any })}
              data-testid="radio-suggestion-trigger"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="enter" id="trigger-enter" data-testid="radio-trigger-enter" />
                <Label htmlFor="trigger-enter">Enter</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="tab" id="trigger-tab" data-testid="radio-trigger-tab" />
                <Label htmlFor="trigger-tab">Tab</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="code-privacy">Code Privacy</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Choose where your code is processed for AI suggestions</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Select
              value={formData.codePrivacy}
              onValueChange={(value) => handleUpdate({ codePrivacy: value as any })}
            >
              <SelectTrigger id="code-privacy" data-testid="select-code-privacy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hosted-llm">Hosted LLM</SelectItem>
                <SelectItem value="self-hosted">Self-Hosted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex items-center gap-2">
              <Label htmlFor="telemetry-opt-out">Telemetry Opt Out</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Disable anonymous usage data collection</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Switch
              id="telemetry-opt-out"
              data-testid="switch-telemetry-opt-out"
              checked={formData.telemetryOptOut}
              onCheckedChange={(checked) => handleUpdate({ telemetryOptOut: checked })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
