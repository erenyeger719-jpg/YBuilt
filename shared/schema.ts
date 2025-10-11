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

// Job schema for AI generation
export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  prompt: text("prompt").notNull(),
  status: text("status").notNull().default("pending"),
  result: text("result"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertJobSchema = createInsertSchema(jobs).pick({
  prompt: true,
});

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

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
    parallaxIntensity: z.number().min(0).max(100).default(20),
    motion: z.enum(["normal", "reduced", "none"]).default("normal"),
    lowPower: z.boolean().default(false),
    lowBandwidth: z.boolean().default(false),
  }).default({}),
  account: z.object({
    displayName: z.string().default(""),
    email: z.string().email().default(""),
    avatar: z.string().url().optional(),
    language: z.string().default("en"),
    locale: z.string().default("en-US"),
  }).default({}),
  editor: z.object({
    template: z.string().default("starter"),
    language: z.enum(["js", "ts", "python", "other"]).default("js"),
    autosave: z.number().default(15), // seconds
    previewResolution: z.enum(["auto", "1080p", "4k", "mobile"]).default("auto"),
    keybindings: z.enum(["default", "vscode", "vim", "emacs"]).default("default"),
    tabSize: z.number().min(2).max(8).default(2),
    fontSize: z.number().min(10).max(24).default(14),
    lineWrap: z.boolean().default(true),
  }).default({}),
  ai: z.object({
    model: z.string().default("gpt-5-x"),
    temperature: z.number().min(0).max(2).default(0.2),
    autoRefine: z.boolean().default(true),
    maxTokens: z.number().default(4000),
    computeTier: z.enum(["fast", "balanced", "high-fidelity"]).default("balanced"),
    previewWatermark: z.boolean().default(true),
    defaultStyle: z.enum(["monochrome", "gloss", "game", "app-ui"]).default("monochrome"),
  }).default({}),
  security: z.object({
    twoFactor: z.boolean().default(false),
    apiKeys: z.array(z.object({
      id: z.string(),
      name: z.string(),
      key: z.string(),
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
    webhooks: z.array(z.object({
      id: z.string(),
      url: z.string().url(),
      events: z.array(z.string()),
    })).default([]),
    paymentGateway: z.enum(["razorpay", "cashfree", "payu"]).default("razorpay"),
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
    parallaxIntensity: 20,
    motion: "normal",
    lowPower: false,
    lowBandwidth: false,
  },
  account: {
    displayName: "",
    email: "user@example.com", // Valid placeholder email
    language: "en",
    locale: "en-US",
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
  },
  ai: {
    model: "gpt-5-x",
    temperature: 0.2,
    autoRefine: true,
    maxTokens: 4000,
    computeTier: "balanced",
    previewWatermark: true,
    defaultStyle: "monochrome",
  },
  security: {
    twoFactor: false,
    apiKeys: [],
    sshKeys: [],
  },
  integrations: {
    github: { connected: false },
    gitlab: { connected: false },
    webhooks: [],
    paymentGateway: "razorpay",
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
