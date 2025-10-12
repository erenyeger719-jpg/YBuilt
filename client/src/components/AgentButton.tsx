import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bot, Settings2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface AgentSettings {
  autonomyLevel: "low" | "medium" | "high" | "max";
  autoApply: boolean;
  safetyFilter: boolean;
  computeTier: "basic" | "standard" | "premium";
}

interface AgentButtonProps {
  settings: AgentSettings;
  onChange: (settings: AgentSettings) => void;
}

export default function AgentButton({ settings, onChange }: AgentButtonProps) {
  const [open, setOpen] = useState(false);

  const handleAutonomyChange = (value: string) => {
    onChange({
      ...settings,
      autonomyLevel: value as AgentSettings["autonomyLevel"],
    });
  };

  const handleAutoApplyChange = (checked: boolean) => {
    onChange({
      ...settings,
      autoApply: checked,
    });
  };

  const handleSafetyFilterChange = (checked: boolean) => {
    onChange({
      ...settings,
      safetyFilter: checked,
    });
  };

  const handleComputeTierChange = (value: string) => {
    onChange({
      ...settings,
      computeTier: value as AgentSettings["computeTier"],
    });
  };

  const autonomyColor = {
    low: "text-blue-500",
    medium: "text-green-500",
    high: "text-yellow-500",
    max: "text-red-500",
  }[settings.autonomyLevel];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="default"
          className="gap-2"
          data-testid="button-agent-settings"
        >
          <Bot className={`h-4 w-4 ${autonomyColor}`} />
          <span className="hidden sm:inline">Agent</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end" data-testid="popover-agent-settings">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Agent Settings
            </h4>
            <p className="text-xs text-muted-foreground">
              Configure AI agent autonomy and behavior
            </p>
          </div>

          {/* Autonomy Level */}
          <div className="space-y-2">
            <Label className="text-xs">Autonomy Level</Label>
            <Tabs
              value={settings.autonomyLevel}
              onValueChange={handleAutonomyChange}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger
                  value="low"
                  className="text-xs"
                  data-testid="tab-autonomy-low"
                >
                  Low
                </TabsTrigger>
                <TabsTrigger
                  value="medium"
                  className="text-xs"
                  data-testid="tab-autonomy-medium"
                >
                  Med
                </TabsTrigger>
                <TabsTrigger
                  value="high"
                  className="text-xs"
                  data-testid="tab-autonomy-high"
                >
                  High
                </TabsTrigger>
                <TabsTrigger
                  value="max"
                  className="text-xs"
                  data-testid="tab-autonomy-max"
                >
                  Max
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-xs text-muted-foreground">
              {settings.autonomyLevel === "low" && "Agent suggests only, manual apply"}
              {settings.autonomyLevel === "medium" && "Can make code edits, propose tests"}
              {settings.autonomyLevel === "high" && "Run tests, auto-fix lint, propose builds"}
              {settings.autonomyLevel === "max" && "Full build, test suite, optional publish"}
            </p>
          </div>

          {/* Auto-Apply */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs">Auto-Apply Changes</Label>
              <p className="text-xs text-muted-foreground">
                Automatically apply agent suggestions
              </p>
            </div>
            <Switch
              checked={settings.autoApply}
              onCheckedChange={handleAutoApplyChange}
              data-testid="switch-auto-apply"
            />
          </div>

          {/* Safety Filter */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs">Safety Filter</Label>
              <p className="text-xs text-muted-foreground">
                Review destructive operations
              </p>
            </div>
            <Switch
              checked={settings.safetyFilter}
              onCheckedChange={handleSafetyFilterChange}
              data-testid="switch-safety-filter"
            />
          </div>

          {/* Compute Tier */}
          <div className="space-y-2">
            <Label className="text-xs">Compute Tier</Label>
            <Select
              value={settings.computeTier}
              onValueChange={handleComputeTierChange}
            >
              <SelectTrigger className="h-8" data-testid="select-compute-tier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic (Fast)</SelectItem>
                <SelectItem value="standard">Standard (Balanced)</SelectItem>
                <SelectItem value="premium">Premium (Advanced)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
