// client/src/types/shims.d.ts

// --- Collab: make effect cleanups type-safe
declare module "@/lib/collab" {
  export function usePresence(room: string, me: any): { peers: any[] };
  export function onCursor(cb: (p: any) => void): () => void;   // cleanup fn
  export function emitCursor(p: any): void;
  export function onMention(cb: (p: any) => void): () => void;  // cleanup fn
  export function getMySocketId(): string | undefined;
}

// --- Shared schema: pragmatic shapes used across UI
declare module "@shared/schema" {
  export type SystemStatus = {
    services?: { id: string; status: "ok" | "degraded" | "down" }[];
  };

  export type SettingsSection =
    | "profile" | "account" | "appearance" | "notifications" | "workspace"
    | "editor" | "ai" | "organization" | "security" | "integrations"
    | "billing" | "team" | "export";

  export interface ProjectTheme {
    meta: { name: string; [k: string]: any };
    colors: {
      background: string; text: string;
      primaryBackground: string; primaryText: string;
      accentBackground: string;  accentText?: string;
      destructiveBackground: string; destructiveText?: string;
      border: string;
      cardBackground: string; cardText?: string;
    };
    fonts: { sans: string; serif: string; mono: string };
    borderRadius: string;
  }

  export interface Settings {
    ai: {
      model: string; temperature: number; autoRefine: boolean;
      maxTokens: number; maxRuntime: number;
      computeTier: "free" | "standard" | "pro" | string;
      previewWatermark: boolean; defaultStyle?: string;
      safetyFilter?: boolean; safetyLevel?: number | string;
      promptTemplates?: string[];
    };
    appearance: {
      theme: "system" | "dark" | "light" | "force-library";
      glassIntensity: number; glossFinish: boolean;
      parallaxIntensity: number; motion: "full" | "reduced" | "none";
      lowPower?: boolean; lowBandwidth: boolean;
      fontFamily: "valmeria" | "inter" | "poppins" | string;
      fontSize: number;
    };
    editor: {
      theme: string; fontFamily: string; fontSize: number;
      lineHeight: number; tabSize: number; indentWithTabs: boolean;
      cursorStyle: string; wordWrap: boolean; autoComplete: boolean;
      inlineAiSuggestions: "off" | "ghost" | "inline";
      formatOnSave: boolean; defaultFormatter: string;
      linterEnabled: boolean; linterRuleset: string;
      codeLens: boolean; minimap: boolean; keymap: string;
      autosaveInterval: number;
      aiModel: string; aiComputeTier: string; maxTokens: number;
      autoRunTests: boolean; suggestionTrigger: string;
      codePrivacy: string; telemetryOptOut: boolean;
    };
    workspace: {
      projectVisibility: string; defaultBranch: string; projectRegion: string;
      defaultTemplate: string; computeTier: string;
      memoryLimit: number; concurrencySlots: number; autoScaling: boolean;
      agentAutonomyDefault: string; autoApplyEdits: string;
      buildTraceVerbosity: string; safetyScan: boolean; autoSaveDrafts: boolean;
      previewSandboxMode: string; devicePreset: string;
      snapshotThumbnails: boolean; allowProjectWebhooks: boolean;
      paidIntegrations: boolean;
      envVariables: { key: string; value: string }[];
    };
    notifications: {
      channels: Record<string, boolean>;
      events: Record<string, boolean>;
      digest: { enabled: boolean; dailyTime?: string; weeklyDay?: string };
      quietHours: { enabled: boolean; start?: string; end?: string; timezone?: string };
      webhooks: { id: string; url: string; secret?: string; events: string[] }[];
      delivery: string;
    };
  }

  export type BuildLogEntry = { ts?: string; level?: string; message?: string } | any;
  export interface BuildStageTrace {
    logs: BuildLogEntry[];
    artifacts?: any[];
    startedAt?: string;
    finishedAt?: string;
    status?: "queued" | "running" | "done" | "error";
  }
  export interface BuildTrace {
    stages: Record<string, BuildStageTrace>;
    currentStage?: string;
  }
  export type BuildStage = string;
}
