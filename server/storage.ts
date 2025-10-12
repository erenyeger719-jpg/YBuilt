import { type User, type InsertUser, type Job, type InsertJob, type Build, type Version, type Settings, settingsSchema, type Draft, type UploadedAsset, type ProjectTheme, projectThemeSchema, themePresets, type SupportTicket, type InsertSupportTicket, type SystemStatus } from "@shared/schema";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";

const JOBS_FILE = path.join(process.cwd(), "data", "jobs.json");
const USERS_FILE = path.join(process.cwd(), "data", "users.json");
const BUILDS_FILE = path.join(process.cwd(), "data", "builds.json");
const VERSIONS_FILE = path.join(process.cwd(), "data", "versions.json");
const SETTINGS_DIR = path.join(process.cwd(), "data", "settings");
const LIBRARY_DIR = path.join(process.cwd(), "data", "library");
const SUPPORT_DIR = path.join(process.cwd(), "data", "support");
const SUPPORT_TICKETS_FILE = path.join(SUPPORT_DIR, "tickets.json");

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUserCredits(userId: string): Promise<number>;
  updateUserCredits(userId: string, credits: number): Promise<void>;
  addCredits(userId: string, amount: number): Promise<void>;
  
  // Job methods
  createJob(job: InsertJob): Promise<Job>;
  getJob(id: string): Promise<Job | undefined>;
  updateJob(id: string, updates: Partial<Job>): Promise<void>;
  updateJobStatus(id: string, status: string, result?: string): Promise<void>;
  getAllJobs(): Promise<Job[]>;
  getUserJobs(userId: string): Promise<Job[]>;
  
  // Build methods
  createBuild(jobId: string): Promise<Build>;
  getBuild(id: string): Promise<Build | undefined>;
  updateBuild(id: string, updates: Partial<Build>): Promise<void>;
  getJobBuilds(jobId: string): Promise<Build[]>;
  
  // Version methods
  createVersion(jobId: string, buildId: string, snapshot: any, description?: string): Promise<Version>;
  getVersion(id: string): Promise<Version | undefined>;
  getJobVersions(jobId: string): Promise<Version[]>;
  
  // Settings methods
  getSettings(userId: string): Promise<Settings>;
  updateSettings(userId: string, settings: Partial<Settings>): Promise<Settings>;
  
  // Draft methods
  createDraft(draft: Omit<Draft, 'draftId' | 'createdAt' | 'updatedAt'>): Promise<Draft>;
  getDrafts(userId: string): Promise<Draft[]>;
  getDraft(draftId: string): Promise<Draft | undefined>;
  updateDraft(draftId: string, updates: Partial<Draft>): Promise<void>;
  
  // Upload methods
  addUploadedAsset(jobId: string, asset: UploadedAsset): Promise<void>;
  getUploadedAssets(jobId: string): Promise<UploadedAsset[]>;
  
  // Billing methods
  createInvoice(invoice: Invoice): Promise<Invoice>;
  getInvoices(userId: string): Promise<Invoice[]>;
  deductCredits(userId: string, amount: number): Promise<void>;
  
  // Theme methods
  getProjectTheme(projectId: string): Promise<ProjectTheme | null>;
  saveProjectTheme(projectId: string, theme: ProjectTheme): Promise<void>;
  
  // Support methods
  getSupportTickets(userId: string): Promise<SupportTicket[]>;
  createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket>;
  getSystemStatus(): Promise<SystemStatus>;
}

export interface Invoice {
  id: string;
  userId: string;
  amount: number;
  type: "publish" | "credit_purchase";
  jobId?: string | null;
  timestamp: string;
  status: "paid" | "pending" | "failed";
  paymentId?: string;
  orderId?: string;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private jobs: Map<string, Job>;
  private builds: Map<string, Build>;
  private versions: Map<string, Version>;
  private userCredits: Map<string, number>;
  private drafts: Map<string, Draft>;
  private uploads: Map<string, UploadedAsset[]>;
  private invoices: Map<string, Invoice>;
  private supportTickets: Map<string, SupportTicket>;

  constructor() {
    this.users = new Map();
    this.jobs = new Map();
    this.builds = new Map();
    this.versions = new Map();
    this.userCredits = new Map([["demo", 100]]); // Initialize demo user with 100 credits
    this.drafts = new Map();
    this.uploads = new Map();
    this.invoices = new Map();
    this.supportTickets = new Map();
    this.loadJobs();
    this.loadUsers();
    this.loadBuilds();
    this.loadVersions();
    this.loadDrafts();
    this.loadInvoices();
    this.loadSupportTickets();
  }

  private async loadJobs() {
    try {
      const data = await fs.readFile(JOBS_FILE, "utf-8");
      const jobsData = JSON.parse(data);
      Object.entries(jobsData).forEach(([id, job]) => {
        this.jobs.set(id, job as Job);
      });
    } catch (error) {
      // File doesn't exist or is empty, that's ok
    }
  }

  private async loadUsers() {
    try {
      const data = await fs.readFile(USERS_FILE, "utf-8");
      const usersData = JSON.parse(data);
      Object.entries(usersData).forEach(([id, userData]: [string, any]) => {
        // Extract user fields and credits
        const { credits, ...user } = userData;
        this.users.set(id, user as User);
        if (credits !== undefined) {
          this.userCredits.set(id, credits);
        }
      });
    } catch (error) {
      // File doesn't exist or is empty, that's ok
    }
  }

  private async saveJobs() {
    const jobsObj = Object.fromEntries(this.jobs);
    await fs.writeFile(JOBS_FILE, JSON.stringify(jobsObj, null, 2));
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      id,
      username: insertUser.username,
      email: insertUser.email,
      password: insertUser.password
    };
    this.users.set(id, user);
    this.userCredits.set(id, 0);
    
    // Save to file
    await this.saveUsers();
    
    return user;
  }

  private async saveUsers() {
    try {
      // Combine users and credits into one file
      const usersData: any = {};
      this.users.forEach((user, id) => {
        usersData[id] = {
          ...user,
          credits: this.userCredits.get(id) || 0
        };
      });
      await fs.writeFile(USERS_FILE, JSON.stringify(usersData, null, 2));
    } catch (error) {
      console.error("Error saving users:", error);
    }
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const id = randomUUID();
    const job: Job = {
      id,
      userId: insertJob.userId,
      prompt: insertJob.prompt,
      templateId: insertJob.templateId || null,
      status: "created",
      result: null,
      artifacts: null,
      settings: null,
      versionIds: null,
      logsPath: null,
      error: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.jobs.set(id, job);
    await this.saveJobs();
    return job;
  }

  async getJob(id: string): Promise<Job | undefined> {
    return this.jobs.get(id);
  }

  async updateJobStatus(id: string, status: string, result?: string): Promise<void> {
    const job = this.jobs.get(id);
    if (job) {
      job.status = status;
      job.updatedAt = new Date();
      if (result !== undefined) {
        job.result = result;
      }
      this.jobs.set(id, job);
      await this.saveJobs();
    }
  }

  async getAllJobs(): Promise<Job[]> {
    return Array.from(this.jobs.values());
  }

  async getUserCredits(userId: string): Promise<number> {
    return this.userCredits.get(userId) ?? 0;
  }

  async updateUserCredits(userId: string, credits: number): Promise<void> {
    this.userCredits.set(userId, credits);
    await this.saveUsers();
  }

  async getSettings(userId: string): Promise<Settings> {
    const settingsFile = path.join(SETTINGS_DIR, `${userId}.json`);
    try {
      const data = await fs.readFile(settingsFile, "utf-8");
      const parsed = JSON.parse(data);
      return settingsSchema.parse(parsed);
    } catch (error) {
      // Return default settings if file doesn't exist
      const { defaultSettings } = await import("@shared/schema");
      const defaults = { ...defaultSettings, userId };
      // Ensure settings directory exists
      await fs.mkdir(SETTINGS_DIR, { recursive: true });
      await fs.writeFile(settingsFile, JSON.stringify(defaults, null, 2));
      return defaults;
    }
  }

  async updateSettings(userId: string, updates: Partial<Settings>): Promise<Settings> {
    const current = await this.getSettings(userId);
    // Deep merge updates with current settings
    const updated = {
      ...current,
      ...updates,
      userId, // Ensure userId stays consistent
    };
    
    // Validate merged settings
    const validated = settingsSchema.parse(updated);
    
    const settingsFile = path.join(SETTINGS_DIR, `${userId}.json`);
    await fs.mkdir(SETTINGS_DIR, { recursive: true });
    await fs.writeFile(settingsFile, JSON.stringify(validated, null, 2));
    
    return validated;
  }

  // Load/save methods for builds and versions
  private async loadBuilds() {
    try {
      const data = await fs.readFile(BUILDS_FILE, "utf-8");
      const buildsData = JSON.parse(data);
      Object.entries(buildsData).forEach(([id, build]) => {
        this.builds.set(id, build as Build);
      });
    } catch (error) {
      // File doesn't exist, that's ok
    }
  }

  private async loadVersions() {
    try {
      const data = await fs.readFile(VERSIONS_FILE, "utf-8");
      const versionsData = JSON.parse(data);
      Object.entries(versionsData).forEach(([id, version]) => {
        this.versions.set(id, version as Version);
      });
    } catch (error) {
      // File doesn't exist, that's ok
    }
  }

  private async saveBuilds() {
    const buildsObj = Object.fromEntries(this.builds);
    await fs.writeFile(BUILDS_FILE, JSON.stringify(buildsObj, null, 2));
  }

  private async saveVersions() {
    const versionsObj = Object.fromEntries(this.versions);
    await fs.writeFile(VERSIONS_FILE, JSON.stringify(versionsObj, null, 2));
  }

  // Extended job methods
  async updateJob(id: string, updates: Partial<Job>): Promise<void> {
    const job = this.jobs.get(id);
    if (job) {
      Object.assign(job, updates, { updatedAt: new Date() });
      this.jobs.set(id, job);
      await this.saveJobs();
    }
  }

  async getUserJobs(userId: string): Promise<Job[]> {
    return Array.from(this.jobs.values()).filter(job => job.userId === userId);
  }

  // Build methods
  async createBuild(jobId: string): Promise<Build> {
    const id = randomUUID();
    const build: Build = {
      id,
      jobId,
      status: "pending",
      stage: null,
      startedAt: new Date(),
      finishedAt: null,
      artifacts: null,
      logs: null,
      metrics: null,
      error: null,
    };
    this.builds.set(id, build);
    await this.saveBuilds();
    return build;
  }

  async getBuild(id: string): Promise<Build | undefined> {
    return this.builds.get(id);
  }

  async updateBuild(id: string, updates: Partial<Build>): Promise<void> {
    const build = this.builds.get(id);
    if (build) {
      Object.assign(build, updates);
      this.builds.set(id, build);
      await this.saveBuilds();
    }
  }

  async getJobBuilds(jobId: string): Promise<Build[]> {
    return Array.from(this.builds.values()).filter(build => build.jobId === jobId);
  }

  // Version methods
  async createVersion(jobId: string, buildId: string, snapshot: any, description?: string): Promise<Version> {
    const id = randomUUID();
    const version: Version = {
      id,
      jobId,
      buildId,
      snapshot: JSON.stringify(snapshot),
      description: description || null,
      createdAt: new Date(),
    };
    this.versions.set(id, version);
    await this.saveVersions();
    return version;
  }

  async getVersion(id: string): Promise<Version | undefined> {
    return this.versions.get(id);
  }

  async getJobVersions(jobId: string): Promise<Version[]> {
    return Array.from(this.versions.values()).filter(version => version.jobId === jobId);
  }

  // Draft methods
  private async loadDrafts() {
    try {
      // Load all user draft directories
      const userDirs = await fs.readdir(LIBRARY_DIR);
      for (const userId of userDirs) {
        const draftsDir = path.join(LIBRARY_DIR, userId, "drafts");
        try {
          const draftFiles = await fs.readdir(draftsDir);
          for (const file of draftFiles) {
            if (file.endsWith(".json")) {
              const data = await fs.readFile(path.join(draftsDir, file), "utf-8");
              const draft = JSON.parse(data);
              this.drafts.set(draft.draftId, draft);
            }
          }
        } catch (error) {
          // No drafts for this user yet
        }
      }
    } catch (error) {
      // Library directory doesn't exist yet
    }
  }

  async createDraft(draft: Omit<Draft, 'draftId' | 'createdAt' | 'updatedAt'>): Promise<Draft> {
    const draftId = randomUUID();
    const now = new Date().toISOString();
    const newDraft: Draft = {
      ...draft,
      draftId,
      createdAt: now,
      updatedAt: now,
    };
    
    this.drafts.set(draftId, newDraft);
    
    // Save to file system
    const userDraftsDir = path.join(LIBRARY_DIR, draft.userId, "drafts");
    await fs.mkdir(userDraftsDir, { recursive: true });
    const draftFile = path.join(userDraftsDir, `${draftId}.json`);
    await fs.writeFile(draftFile, JSON.stringify(newDraft, null, 2));
    
    return newDraft;
  }

  async getDrafts(userId: string): Promise<Draft[]> {
    return Array.from(this.drafts.values()).filter(draft => draft.userId === userId);
  }

  async getDraft(draftId: string): Promise<Draft | undefined> {
    return this.drafts.get(draftId);
  }

  async updateDraft(draftId: string, updates: Partial<Draft>): Promise<void> {
    const draft = this.drafts.get(draftId);
    if (draft) {
      const updated = {
        ...draft,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.drafts.set(draftId, updated);
      
      // Save to file
      const draftFile = path.join(LIBRARY_DIR, draft.userId, "drafts", `${draftId}.json`);
      await fs.writeFile(draftFile, JSON.stringify(updated, null, 2));
    }
  }

  // Upload methods
  async addUploadedAsset(jobId: string, asset: UploadedAsset): Promise<void> {
    const existing = this.uploads.get(jobId) || [];
    this.uploads.set(jobId, [...existing, asset]);
  }

  async getUploadedAssets(jobId: string): Promise<UploadedAsset[]> {
    return this.uploads.get(jobId) || [];
  }

  // Billing methods
  private async loadInvoices() {
    try {
      const billingFile = path.join(process.cwd(), "data", "billing.json");
      const data = await fs.readFile(billingFile, "utf-8");
      const billingData = JSON.parse(data);
      if (billingData.invoices) {
        billingData.invoices.forEach((invoice: Invoice) => {
          this.invoices.set(invoice.id, invoice);
        });
      }
    } catch (error) {
      // File doesn't exist yet or is empty
    }
  }

  private async saveInvoices() {
    try {
      const billingFile = path.join(process.cwd(), "data", "billing.json");
      const invoicesArray = Array.from(this.invoices.values());
      await fs.writeFile(
        billingFile,
        JSON.stringify({ invoices: invoicesArray }, null, 2)
      );
    } catch (error) {
      console.error("Error saving invoices:", error);
    }
  }

  async createInvoice(invoice: Invoice): Promise<Invoice> {
    this.invoices.set(invoice.id, invoice);
    await this.saveInvoices();
    return invoice;
  }

  async getInvoices(userId: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter(
      (invoice) => invoice.userId === userId
    );
  }

  async deductCredits(userId: string, amount: number): Promise<void> {
    const currentCredits = this.userCredits.get(userId) ?? 0;
    const newCredits = Math.max(0, currentCredits - amount);
    this.userCredits.set(userId, newCredits);
    await this.saveUsers();
  }

  async addCredits(userId: string, amount: number): Promise<void> {
    const currentCredits = this.userCredits.get(userId) ?? 0;
    const newCredits = currentCredits + amount;
    this.userCredits.set(userId, newCredits);
    await this.saveUsers();
  }

  // Theme methods
  async getProjectTheme(projectId: string): Promise<ProjectTheme | null> {
    try {
      const themeFile = path.join(process.cwd(), "data", "workspaces", projectId, "theme.json");
      const data = await fs.readFile(themeFile, "utf-8");
      const theme = JSON.parse(data);
      // Validate with schema
      return projectThemeSchema.parse(theme);
    } catch (error) {
      // Theme file doesn't exist or invalid, return default theme
      const DEFAULT_THEME: ProjectTheme = {
        meta: { 
          name: "Default", 
          createdAt: new Date().toISOString(), 
          author: "system" 
        },
        fonts: { 
          sans: "Inter", 
          serif: "Georgia", 
          mono: "Menlo" 
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
          accentBackground: "#f2f2f2",
          accentText: "#1a1a1a",
          destructiveBackground: "#8c1717",
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
      return DEFAULT_THEME;
    }
  }

  async saveProjectTheme(projectId: string, theme: ProjectTheme): Promise<void> {
    const workspaceDir = path.join(process.cwd(), "data", "workspaces", projectId);
    await fs.mkdir(workspaceDir, { recursive: true });
    
    const themeFile = path.join(workspaceDir, "theme.json");
    await fs.writeFile(themeFile, JSON.stringify(theme, null, 2));
  }

  // Support ticket methods
  private async loadSupportTickets() {
    try {
      const data = await fs.readFile(SUPPORT_TICKETS_FILE, "utf-8");
      const ticketsData = JSON.parse(data);
      Object.entries(ticketsData).forEach(([id, ticket]) => {
        this.supportTickets.set(id, ticket as SupportTicket);
      });
    } catch (error) {
      // File doesn't exist yet, that's ok
    }
  }

  private async saveSupportTickets() {
    try {
      await fs.mkdir(SUPPORT_DIR, { recursive: true });
      const ticketsObj = Object.fromEntries(this.supportTickets);
      await fs.writeFile(SUPPORT_TICKETS_FILE, JSON.stringify(ticketsObj, null, 2));
    } catch (error) {
      console.error("Error saving support tickets:", error);
    }
  }

  async getSupportTickets(userId: string): Promise<SupportTicket[]> {
    return Array.from(this.supportTickets.values()).filter(
      ticket => ticket.userId === userId
    );
  }

  async createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const newTicket: SupportTicket = {
      ...ticket,
      id,
      status: "open",
      createdAt: now,
      updatedAt: now,
    };
    
    this.supportTickets.set(id, newTicket);
    await this.saveSupportTickets();
    
    return newTicket;
  }

  async getSystemStatus(): Promise<SystemStatus> {
    // Mock system status - always operational
    return {
      ok: true,
      summary: "All systems operational",
      services: [
        { name: "API", status: "operational" },
        { name: "Build Pipeline", status: "operational" },
        { name: "Storage", status: "operational" },
        { name: "AI Generation", status: "operational" },
      ],
      lastUpdated: new Date().toISOString(),
    };
  }
}

export const storage = new MemStorage();
