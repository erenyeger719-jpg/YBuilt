import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  bio: text("bio"),
  avatar: text("avatar"),
  publicProfile: boolean("public_profile").default(false).notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  region: text("region"),
  roles: text("roles").array(),
  notificationSettings: jsonb("notification_settings"),
  referralCode: text("referral_code").unique(),
  referralCredits: integer("referral_credits").default(0).notNull(),
});

export const insertUserSchema = createInsertSchema(users)
  .omit({
    id: true,
  })
  .extend({
    bio: z.string().max(140, "Bio must be 140 characters or less").optional(),
    notificationSettings: z.object({
      transactional: z.boolean().default(true),
      marketing: z.boolean().default(false),
    }).optional(),
  });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Job schema for AI generation with extended lifecycle
// States: created → queued → generating → ready_for_finalization → editing → building → deploying → published (or failed/cancelled)
export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  prompt: text("prompt").notNull(),
  status: text("status").notNull().default("created"), // created|queued|generating|ready_for_finalization|editing|building|deploying|published|failed|cancelled
  templateId: varchar("template_id"),
  result: text("result"), // preview URL
  artifacts: text("artifacts"), // JSON array of generated artifacts
  settings: text("settings"), // JSON object with editor/ai settings used
  versionIds: text("version_ids"), // JSON array of version snapshot IDs
  logsPath: text("logs_path"), // path to structured logs file
  error: text("error"), // error message if failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertJobSchema = createInsertSchema(jobs).pick({
  userId: true,
  prompt: true,
  templateId: true,
});

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

// Build schema for tracking build pipeline runs
export const builds = pgTable("builds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull(),
  status: text("status").notNull().default("pending"), // pending|running|completed|failed
  stage: text("stage"), // current stage: content_gen|assemble|build|test|deploy
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
  artifacts: text("artifacts"), // JSON array of build artifacts
  logs: text("logs"), // JSON array of structured log lines
  metrics: text("metrics"), // JSON object with build metrics (duration, compute tier, etc)
  error: text("error"),
});

export type Build = typeof builds.$inferSelect;

// Build Trace Types for BuildTraceViewer
export enum BuildStage {
  GENERATION = "GENERATION",
  ASSEMBLY = "ASSEMBLY",
  LINT = "LINT",
  TEST = "TEST",
  BUNDLE = "BUNDLE"
}

export interface BuildLogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  details?: string;
}

export interface BuildStageTrace {
  stage: BuildStage;
  status: "pending" | "running" | "success" | "failed";
  startedAt?: string;
  completedAt?: string;
  logs: BuildLogEntry[];
  artifacts?: Array<{ label: string; url: string }>;
}

export interface BuildTrace {
  jobId: string;
  currentStage: BuildStage;
  stages: Record<BuildStage, BuildStageTrace>;
  summaryLog: string;
}

// Autonomy System for Auto-Apply
export enum AutonomyLevel {
  NONE = 0,
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  MAXIMUM = 4
}

export function hasHighAutonomy(level: string): boolean {
  const levelMap: Record<string, number> = {
    none: AutonomyLevel.NONE,
    low: AutonomyLevel.LOW,
    medium: AutonomyLevel.MEDIUM,
    high: AutonomyLevel.HIGH,
    max: AutonomyLevel.MAXIMUM,
    maximum: AutonomyLevel.MAXIMUM
  };
  return (levelMap[level?.toLowerCase()] || 0) >= AutonomyLevel.HIGH;
}

// File Operations for AI-generated edits
export interface FileOperation {
  path: string;
  kind: "replace" | "create" | "update";
  content: string;
}

export interface AIResponse {
  html: string;
  operations?: FileOperation[];
}

// Version schema for snapshots and rollback
export const versions = pgTable("versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull(),
  buildId: varchar("build_id"),
  snapshot: text("snapshot").notNull(), // JSON snapshot of artifacts at this version
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Version = typeof versions.$inferSelect;

// Payment schema
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("INR"),
  razorpayPaymentId: text("razorpay_payment_id"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;

// Settings Schema (stored as JSON per user)
export const settingsSchema = z.object({
  userId: z.string(),
  appearance: z.object({
    theme: z.enum(["system", "dark", "light", "force-library"]).default("system"),
    glassIntensity: z.number().min(0).max(100).default(80),
    glossFinish: z.boolean().default(true),
    parallaxIntensity: z.number().min(0).max(100).default(20),
    motion: z.enum(["full", "reduced", "none"]).default("full"),
    lowPower: z.boolean().default(false),
    lowBandwidth: z.boolean().default(false),
    fontFamily: z.enum(["valmeria", "inter", "poppins"]).default("inter"),
    fontSize: z.number().min(12).max(20).default(16),
  }).default({}),
  account: z.object({
    displayName: z.string().default(""),
    handle: z.string().default(""),
    email: z.string().email().default(""),
    avatar: z.string().optional(),
    language: z.string().default("en"),
    locale: z.string().default("en-US"),
    timezone: z.string().default("UTC"),
    emailVerified: z.boolean().default(false),
  }).default({}),
  workspace: z.object({
    // General
    projectVisibility: z.enum(["public", "unlisted", "private"]).default("private"),
    defaultBranch: z.enum(["main", "dev"]).default("main"),
    projectRegion: z.enum(["auto", "asia", "eu", "us"]).default("auto"),
    defaultTemplate: z.enum(["landing", "ecommerce", "blog", "spa", "api"]).default("landing"),
    
    // Runtime & Resources
    computeTier: z.enum(["small", "balanced", "performance"]).default("balanced"),
    memoryLimit: z.number().min(128).max(4096).default(512), // MB
    concurrencySlots: z.number().min(1).max(10).default(2),
    autoScaling: z.boolean().default(false),
    
    // Agent & Build Pipeline
    agentAutonomyDefault: z.enum(["low", "medium", "high", "max"]).default("medium"),
    autoApplyEdits: z.enum(["off", "review", "auto-medium-plus"]).default("review"),
    buildTraceVerbosity: z.enum(["minimal", "normal", "full"]).default("normal"),
    safetyScan: z.boolean().default(true),
    autoSaveDrafts: z.boolean().default(true),
    
    // Preview & Sandbox
    previewSandboxMode: z.enum(["strict", "lenient", "custom"]).default("lenient"),
    devicePreset: z.enum(["desktop", "tablet", "mobile"]).default("desktop"),
    snapshotThumbnails: z.boolean().default(true),
    
    // Integrations & Secrets
    allowProjectWebhooks: z.boolean().default(true),
    envVariables: z.array(z.object({
      key: z.string(),
      value: z.string(),
    })).default([]),
    paidIntegrations: z.boolean().default(false),
    
    // Legacy fields for compatibility
    autoCreatePreview: z.boolean().default(true),
    storageRegion: z.enum(["india", "eu", "us"]).default("india"),
  }).default({}),
  editor: z.object({
    // Core Editor Options
    theme: z.enum(["light", "dark", "system", "custom"]).default("dark"),
    fontFamily: z.enum(["Inter", "Poppins", "Menlo", "Open Sans", "Custom"]).default("Inter"),
    fontSize: z.number().min(12).max(20).default(14),
    lineHeight: z.number().min(1.0).max(1.8).default(1.5),
    tabSize: z.number().min(2).max(8).default(2),
    indentWithTabs: z.boolean().default(false),
    cursorStyle: z.enum(["block", "line", "underline"]).default("line"),
    wordWrap: z.boolean().default(true),
    
    // Code Assist & Linting
    autoComplete: z.boolean().default(true),
    inlineAiSuggestions: z.enum(["off", "suggest", "auto-insert"]).default("suggest"),
    formatOnSave: z.boolean().default(true),
    defaultFormatter: z.enum(["prettier", "eslint", "none"]).default("prettier"),
    linterEnabled: z.boolean().default(true),
    linterRuleset: z.enum(["recommended", "strict", "custom"]).default("recommended"),
    codeLens: z.boolean().default(true),
    minimap: z.boolean().default(true),
    keymap: z.enum(["default", "vscode", "sublime", "emacs"]).default("default"),
    autosaveInterval: z.enum(["off", "5s", "15s", "60s"]).default("15s"),
    
    // AI Integration
    aiModel: z.enum(["gpt-coder", "mistral-codestral", "claude-sonnet"]).default("claude-sonnet"),
    aiComputeTier: z.enum(["low", "balanced", "fast"]).default("balanced"),
    maxTokens: z.number().min(100).max(8000).default(2000),
    autoRunTests: z.boolean().default(false),
    suggestionTrigger: z.enum(["enter", "tab"]).default("tab"),
    codePrivacy: z.enum(["hosted-llm", "self-hosted"]).default("hosted-llm"),
    telemetryOptOut: z.boolean().default(false),
    
    // Legacy fields for compatibility (non-duplicate only)
    template: z.string().default("starter"),
    language: z.enum(["js", "ts", "python", "other"]).default("js"),
    autosave: z.number().default(15),
    previewResolution: z.enum(["auto", "720p", "1080p", "4k"]).default("auto"),
    lintOnSave: z.boolean().default(true),
  }).default({}),
  ai: z.object({
    model: z.enum(["gpt-5-x", "gpt-5-mini", "vision-capable"]).default("gpt-5-x"),
    temperature: z.number().min(0).max(1).default(0.2),
    autoRefine: z.boolean().default(true),
    maxTokens: z.number().default(4000),
    maxRuntime: z.number().default(30), // seconds
    computeTier: z.enum(["fast", "balanced", "high-fidelity"]).default("balanced"),
    previewWatermark: z.boolean().default(true),
    defaultStyle: z.enum(["monochrome", "gloss", "game", "app-ui"]).default("monochrome"),
    safetyFilter: z.boolean().default(true),
    safetyLevel: z.enum(["low", "medium", "high"]).default("medium"),
    promptTemplates: z.array(z.object({
      id: z.string(),
      name: z.string(),
      template: z.string(),
      isDefault: z.boolean().default(false),
    })).default([]),
  }).default({}),
  security: z.object({
    twoFactor: z.boolean().default(false),
    twoFactorMethod: z.enum(["sms", "authenticator"]).default("authenticator"),
    passwordlessLogin: z.boolean().default(false),
    sessions: z.array(z.object({
      id: z.string(),
      device: z.string(),
      lastActive: z.string(),
      ip: z.string().optional(),
    })).default([]),
    apiKeys: z.array(z.object({
      id: z.string(),
      name: z.string(),
      key: z.string(),
      scopes: z.array(z.enum(["read", "write", "admin"])).default(["read"]),
      createdAt: z.string(),
    })).default([]),
    sshKeys: z.array(z.object({
      id: z.string(),
      name: z.string(),
      key: z.string(),
      createdAt: z.string(),
    })).default([]),
  }).default({}),
  integrations: z.object({
    github: z.object({ connected: z.boolean().default(false), username: z.string().optional() }).default({}),
    gitlab: z.object({ connected: z.boolean().default(false), username: z.string().optional() }).default({}),
    bitbucket: z.object({ connected: z.boolean().default(false), username: z.string().optional() }).default({}),
    webhooks: z.array(z.object({
      id: z.string(),
      url: z.string().url(),
      secret: z.string().optional(),
      events: z.array(z.string()),
    })).default([]),
    analytics: z.boolean().default(true),
    paymentGateway: z.enum(["razorpay", "cashfree", "payu"]).default("razorpay"),
  }).default({}),
  organization: z.object({
    name: z.string().default(""),
    domain: z.string().default(""),
    billingOwner: z.string().optional(),
    admins: z.array(z.string()).default([]),
    projectQuota: z.number().default(10),
    storageLimit: z.number().default(5000), // MB
    teamInvitePolicy: z.enum(["admin-only", "anyone"]).default("admin-only"),
  }).default({}),
  billing: z.object({
    plan: z.string().default("free"),
    nextBillingDate: z.string().optional(),
    paymentMethods: z.array(z.object({
      id: z.string(),
      type: z.enum(["card", "upi", "wallet"]),
      last4: z.string().optional(),
      default: z.boolean(),
    })).default([]),
  }).default({}),
  team: z.object({
    invites: z.array(z.object({
      email: z.string().email(),
      role: z.enum(["admin", "editor", "viewer"]),
      status: z.enum(["pending", "accepted", "declined"]),
    })).default([]),
    projectSharingDefault: z.enum(["public", "private"]).default("private"),
  }).default({}),
  notifications: z.object({
    // Channels
    channels: z.object({
      emailTransactional: z.boolean().default(true),
      emailMarketing: z.boolean().default(false),
      inApp: z.boolean().default(true),
      push: z.boolean().default(false),
      sms: z.boolean().default(false),
    }).default({}),
    smsPhone: z.string().optional(),
    pushToken: z.string().optional(),
    
    // Granular events
    events: z.object({
      buildComplete: z.boolean().default(true),
      buildFail: z.boolean().default(true),
      publishComplete: z.boolean().default(true),
      publishFail: z.boolean().default(true),
      creditAlert: z.boolean().default(true),
      billingAlert: z.boolean().default(true),
      agentConfirmation: z.boolean().default(true),
      securityAlert: z.boolean().default(true),
      systemStatus: z.boolean().default(true),
      teamInvite: z.boolean().default(true),
    }).default({}),
    
    // Digest & Rate limits
    digest: z.object({
      enabled: z.boolean().default(false),
      dailyTime: z.string().default("08:00"), // HH:MM format
      weeklyDay: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]).default("monday"),
      timezone: z.string().default("UTC"),
    }).default({}),
    
    quietHours: z.object({
      enabled: z.boolean().default(false),
      start: z.string().default("22:00"), // HH:MM
      end: z.string().default("08:00"), // HH:MM
      timezone: z.string().default("UTC"),
    }).default({}),
    
    delivery: z.enum(["immediate", "batched"]).default("immediate"),
    
    // Webhooks
    webhooks: z.array(z.object({
      id: z.string(),
      url: z.string().url(),
      secret: z.string().optional(),
      events: z.array(z.string()).default([]),
      enabled: z.boolean().default(true),
    })).default([]),
  }).default({}),
  export: z.object({
    retentionDays: z.number().default(30),
    autoExport: z.boolean().default(false),
  }).default({}),
});

export type Settings = z.infer<typeof settingsSchema>;
export type SettingsSection = keyof Omit<Settings, "userId">;

// Project Settings type (separate from user settings)
export interface ProjectSettings {
  workspace: z.infer<typeof settingsSchema.shape.workspace>;
  editor: z.infer<typeof settingsSchema.shape.editor>;
}

// Default settings for new users
export const defaultSettings: Settings = {
  userId: "",
  appearance: {
    theme: "system",
    glassIntensity: 80,
    glossFinish: true,
    parallaxIntensity: 20,
    motion: "full",
    lowPower: false,
    lowBandwidth: false,
    fontFamily: "inter",
    fontSize: 16,
  },
  account: {
    displayName: "",
    handle: "",
    email: "user@example.com",
    language: "en",
    locale: "en-US",
    timezone: "UTC",
    emailVerified: false,
  },
  workspace: {
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
  },
  editor: {
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
  },
  ai: {
    model: "gpt-5-x",
    temperature: 0.2,
    autoRefine: true,
    maxTokens: 4000,
    maxRuntime: 30,
    computeTier: "balanced",
    previewWatermark: true,
    defaultStyle: "monochrome",
    safetyFilter: true,
    safetyLevel: "medium",
    promptTemplates: [],
  },
  security: {
    twoFactor: false,
    twoFactorMethod: "authenticator",
    passwordlessLogin: false,
    sessions: [],
    apiKeys: [],
    sshKeys: [],
  },
  integrations: {
    github: { connected: false },
    gitlab: { connected: false },
    bitbucket: { connected: false },
    webhooks: [],
    analytics: true,
    paymentGateway: "razorpay",
  },
  organization: {
    name: "",
    domain: "",
    admins: [],
    projectQuota: 10,
    storageLimit: 5000,
    teamInvitePolicy: "admin-only",
  },
  billing: {
    plan: "free",
    paymentMethods: [],
  },
  team: {
    invites: [],
    projectSharingDefault: "private",
  },
  notifications: {
    channels: {
      emailTransactional: true,
      emailMarketing: false,
      inApp: true,
      push: false,
      sms: false,
    },
    events: {
      buildComplete: true,
      buildFail: true,
      publishComplete: true,
      publishFail: true,
      creditAlert: true,
      billingAlert: true,
      agentConfirmation: true,
      securityAlert: true,
      systemStatus: true,
      teamInvite: true,
    },
    digest: {
      enabled: false,
      dailyTime: "08:00",
      weeklyDay: "monday",
      timezone: "UTC",
    },
    quietHours: {
      enabled: false,
      start: "22:00",
      end: "08:00",
      timezone: "UTC",
    },
    delivery: "immediate",
    webhooks: [],
  },
  export: {
    retentionDays: 30,
    autoExport: false,
  },
};

// Job Finalization Schema
export const jobFinalizationSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  description: z.string().min(1, "Description is required").max(200),
  theme: z.enum(["monochrome", "gloss", "game", "app-ui"]),
  heroText: z.string().max(200),
});

export type JobFinalization = z.infer<typeof jobFinalizationSchema>;

// Uploaded Asset Schema
export const uploadedAssetSchema = z.object({
  url: z.string(),
  name: z.string(),
  mime: z.string(),
  size: z.number(),
  parsed: z.object({
    textPreview: z.string().optional(),
    warnings: z.array(z.string()).default([]),
  }).optional(),
});

export type UploadedAsset = z.infer<typeof uploadedAssetSchema>;

// Draft Schema for Library Persistence
export const draftSchema = z.object({
  draftId: z.string(),
  jobId: z.string(),
  userId: z.string(),
  thumbnail: z.string().optional(),
  title: z.string(),
  description: z.string(),
  theme: z.enum(["monochrome", "gloss", "game", "app-ui"]),
  heroText: z.string(),
  palette: z.object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
    accent: z.string().optional(),
  }).optional(),
  assetUrls: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Draft = z.infer<typeof draftSchema>;

// Regeneration Scope Enum
export const regenerationScopeSchema = z.enum([
  "full-site",
  "hero-only",
  "navigation",
  "footer",
  "specific-block"
]);

export type RegenerationScope = z.infer<typeof regenerationScopeSchema>;

// Workspace Metadata Schema
export const workspaceMetadataSchema = z.object({
  files: z.array(z.object({
    path: z.string(),
    content: z.string(),
    language: z.string().optional(),
  })),
  manifest: z.object({
    name: z.string(),
    description: z.string(),
    entryPoint: z.string().default("index.html"),
    dependencies: z.record(z.string()).optional(),
  }),
});

export type WorkspaceMetadata = z.infer<typeof workspaceMetadataSchema>;

// Project Theme Schema (MVP - workspace-specific theming)
export const projectThemeSchema = z.object({
  meta: z.object({
    name: z.string().default("Custom Theme"),
    createdAt: z.string(),
    author: z.string(),
  }),
  fonts: z.object({
    sans: z.string().default("Inter"),
    serif: z.string().default("Georgia"),
    mono: z.string().default("Menlo"),
  }),
  borderRadius: z.string().default("0.5rem"),
  colors: z.object({
    background: z.string().default("#ffffff"),
    text: z.string().default("#000000"),
    mutedBackground: z.string().default("#f5f5f5"),
    mutedText: z.string().default("#666666"),
    primaryBackground: z.string().default("#141414"),
    primaryText: z.string().default("#fafafa"),
    secondaryBackground: z.string().default("#e5e5e5"),
    secondaryText: z.string().default("#0a0a0a"),
    accentBackground: z.string().default("#f0f0f0"),
    accentText: z.string().default("#0a0a0a"),
    destructiveBackground: z.string().default("#dc2626"),
    destructiveText: z.string().default("#fafafa"),
    input: z.string().default("#b3b3b3"),
    border: z.string().default("#d9d9d9"),
    focusBorder: z.string().default("#3d3d3d"),
    cardBackground: z.string().default("#fafafa"),
    cardText: z.string().default("#0d0d0d"),
    popoverBackground: z.string().default("#ebebeb"),
    popoverText: z.string().default("#232323"),
    chart1: z.string().default("#383838"),
    chart2: z.string().default("#474747"),
    chart3: z.string().default("#575757"),
    chart4: z.string().default("#666666"),
    chart5: z.string().default("#757575"),
  }),
  customColors: z.array(z.object({
    name: z.string(),
    value: z.string(),
  })).default([]),
});

export type ProjectTheme = z.infer<typeof projectThemeSchema>;

// Support Ticket Schema
export const supportTicketSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.enum(["billing", "account", "technical"]),
  subject: z.string().default(""),
  message: z.string(),
  attachments: z.array(z.object({
    name: z.string(),
    url: z.string(),
    size: z.number(),
  })).default([]),
  status: z.enum(["open", "pending", "resolved", "closed"]).default("open"),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const insertSupportTicketSchema = supportTicketSchema.omit({ id: true, createdAt: true, updatedAt: true, status: true });
export type SupportTicket = z.infer<typeof supportTicketSchema>;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;

// System Status Schema
export const systemStatusSchema = z.object({
  ok: z.boolean(),
  summary: z.string(),
  services: z.array(z.object({
    name: z.string(),
    status: z.enum(["operational", "degraded", "outage"]),
  })).default([]),
  lastUpdated: z.string(),
});

export type SystemStatus = z.infer<typeof systemStatusSchema>;

// SSH Key Schema
export const sshKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  publicKey: z.string(),
  fingerprint: z.string().optional(),
  createdAt: z.string(),
});

export const insertSSHKeySchema = sshKeySchema.omit({ id: true, createdAt: true, fingerprint: true });
export type SSHKey = z.infer<typeof sshKeySchema>;
export type InsertSSHKey = z.infer<typeof insertSSHKeySchema>;

// Secret Schema
export const secretSchema = z.object({
  id: z.string(),
  name: z.string(),
  value: z.string(), // base64 encoded
  createdAt: z.string(),
});

export const insertSecretSchema = secretSchema.omit({ id: true, createdAt: true });
export type Secret = z.infer<typeof secretSchema>;
export type InsertSecret = z.infer<typeof insertSecretSchema>;

// Integration Schema
export const integrationSchema = z.object({
  provider: z.string(),
  connected: z.boolean(),
  username: z.string().optional(),
  connectedAt: z.string().optional(),
});

export type Integration = z.infer<typeof integrationSchema>;

// Domain Schema
export const domainSchema = z.object({
  id: z.string(),
  domain: z.string(),
  verified: z.boolean().default(false),
  createdAt: z.string(),
});

export const insertDomainSchema = domainSchema.omit({ id: true, createdAt: true, verified: true });
export type Domain = z.infer<typeof domainSchema>;
export type InsertDomain = z.infer<typeof insertDomainSchema>;

// Theme presets
export const themePresets = {
  light: {
    meta: { name: "Light", createdAt: new Date().toISOString(), author: "system" },
    fonts: { sans: "Inter", serif: "Georgia", mono: "Menlo" },
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
  },
  dark: {
    meta: { name: "Dark", createdAt: new Date().toISOString(), author: "system" },
    fonts: { sans: "Inter", serif: "Georgia", mono: "Menlo" },
    borderRadius: "0.5rem",
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
    customColors: [],
  },
  highContrast: {
    meta: { name: "High Contrast", createdAt: new Date().toISOString(), author: "system" },
    fonts: { sans: "Inter", serif: "Georgia", mono: "Menlo" },
    borderRadius: "0.5rem",
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
    customColors: [],
  },
} as const;
