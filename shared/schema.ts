import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
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
    defaultVisibility: z.enum(["public", "private"]).default("private"),
    defaultTemplate: z.enum(["starter", "app", "game", "landing"]).default("starter"),
    autoCreatePreview: z.boolean().default(true),
    storageRegion: z.enum(["india", "eu", "us"]).default("india"),
  }).default({}),
  editor: z.object({
    template: z.string().default("starter"),
    language: z.enum(["js", "ts", "python", "other"]).default("js"),
    autosave: z.number().default(15), // seconds, 0 = off
    previewResolution: z.enum(["auto", "720p", "1080p", "4k"]).default("auto"),
    keybindings: z.enum(["default", "vscode", "vim", "emacs"]).default("default"),
    tabSize: z.number().min(2).max(8).default(2),
    fontSize: z.number().min(10).max(24).default(14),
    lineWrap: z.boolean().default(true),
    lintOnSave: z.boolean().default(true),
    editorTheme: z.enum(["dark", "light"]).default("dark"),
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
    email: z.object({
      jobCompleted: z.boolean().default(true),
      billing: z.boolean().default(true),
      security: z.boolean().default(true),
    }).default({}),
    inApp: z.object({
      jobCompleted: z.boolean().default(true),
      billing: z.boolean().default(true),
      security: z.boolean().default(true),
    }).default({}),
    frequency: z.enum(["instant", "daily", "weekly"]).default("instant"),
  }).default({}),
  export: z.object({
    retentionDays: z.number().default(30),
    autoExport: z.boolean().default(false),
  }).default({}),
});

export type Settings = z.infer<typeof settingsSchema>;
export type SettingsSection = keyof Omit<Settings, "userId">;

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
    defaultVisibility: "private",
    defaultTemplate: "starter",
    autoCreatePreview: true,
    storageRegion: "india",
  },
  editor: {
    template: "starter",
    language: "js",
    autosave: 15,
    previewResolution: "auto",
    keybindings: "default",
    tabSize: 2,
    fontSize: 14,
    lineWrap: true,
    lintOnSave: true,
    editorTheme: "dark",
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
    email: {
      jobCompleted: true,
      billing: true,
      security: true,
    },
    inApp: {
      jobCompleted: true,
      billing: true,
      security: true,
    },
    frequency: "instant",
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
