import { type User, type InsertUser, type Job, type InsertJob, type Build, type Version, type Settings, settingsSchema, type Draft, type UploadedAsset, type ProjectTheme, projectThemeSchema, themePresets, type ProjectSettings, type SupportTicket, type InsertSupportTicket, type SystemStatus, type SSHKey, type InsertSSHKey, type Secret, type InsertSecret, type Integration, type Domain, type InsertDomain, type ChatMessage, type InsertChatMessage, type CodeExecution, type InsertCodeExecution, type ProjectCollaborator, type ProjectCommit } from "@shared/schema";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
// @ts-ignore - atomicWrite.js is a JavaScript module with .d.ts type definitions
import { atomicWriteFile } from "./utils/atomicWrite.js";
import { logger } from './middleware/logging.js';

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
  updateUser(id: string, updates: Partial<User>): Promise<User>;
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
  
  // Project Settings methods
  getProjectSettings(projectId: string): Promise<ProjectSettings | null>;
  saveProjectSettings(projectId: string, settings: ProjectSettings): Promise<void>;
  
  // Support methods
  getSupportTickets(userId: string): Promise<SupportTicket[]>;
  createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket>;
  getSystemStatus(): Promise<SystemStatus>;
  
  // Profile methods
  getUserProfile(userId: string): Promise<{ user: User, projects: Job[] }>;
  updateUserProfile(userId: string, data: { firstName?: string, lastName?: string, bio?: string, publicProfile?: boolean }): Promise<User>;
  
  // SSH Key methods
  getUserSSHKeys(userId: string): Promise<SSHKey[]>;
  addSSHKey(userId: string, key: InsertSSHKey): Promise<SSHKey>;
  deleteSSHKey(userId: string, keyId: string): Promise<void>;
  
  // Secret methods
  getUserSecrets(userId: string): Promise<Secret[]>;
  addSecret(userId: string, secret: InsertSecret): Promise<Secret>;
  deleteSecret(userId: string, name: string): Promise<void>;
  
  // Integration methods
  getUserIntegrations(userId: string): Promise<Integration[]>;
  connectIntegration(userId: string, provider: string): Promise<void>;
  disconnectIntegration(userId: string, provider: string): Promise<void>;
  
  // Domain methods
  getUserDomains(userId: string): Promise<Domain[]>;
  addDomain(userId: string, domain: InsertDomain): Promise<Domain>;
  deleteDomain(userId: string, domainId: string): Promise<void>;
  
  // Chat methods
  createChatMessage(message: import("@shared/schema").InsertChatMessage): Promise<import("@shared/schema").ChatMessage>;
  getChatHistory(userId: string, projectId?: string, limit?: number): Promise<import("@shared/schema").ChatMessage[]>;
  deleteChatMessage(messageId: string): Promise<void>;
  
  // Code Execution methods
  createCodeExecution(execution: import("@shared/schema").InsertCodeExecution): Promise<import("@shared/schema").CodeExecution>;
  getCodeExecutionHistory(userId: string, projectId?: string, limit?: number): Promise<import("@shared/schema").CodeExecution[]>;
  updateCodeExecution(id: string, updates: Partial<import("@shared/schema").CodeExecution>): Promise<void>;
  
  // Project Collaboration methods
  addCollaborator(projectId: string, userId: string, role: string): Promise<import("@shared/schema").ProjectCollaborator>;
  getCollaborators(projectId: string): Promise<import("@shared/schema").ProjectCollaborator[]>;
  removeCollaborator(projectId: string, userId: string): Promise<void>;
  
  // Project Version Control methods
  createCommit(commit: Omit<import("@shared/schema").ProjectCommit, 'id' | 'createdAt'>): Promise<import("@shared/schema").ProjectCommit>;
  getCommits(projectId: string, limit?: number): Promise<import("@shared/schema").ProjectCommit[]>;
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
  private projectSettings: Map<string, ProjectSettings>;
  private chatMessages: Map<string, ChatMessage>;
  private codeExecutions: Map<string, CodeExecution>;
  private collaborators: Map<string, ProjectCollaborator[]>; // projectId -> collaborators[]
  private commits: Map<string, ProjectCommit[]>; // projectId -> commits[]

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
    this.projectSettings = new Map();
    this.chatMessages = new Map();
    this.codeExecutions = new Map();
    this.collaborators = new Map();
    this.commits = new Map();
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
    await atomicWriteFile(JOBS_FILE, jobsObj);
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
      password: insertUser.password,
      avatar: null,
      region: null,
      roles: null,
      emailVerified: false,
      firstName: null,
      lastName: null,
      bio: null,
      publicProfile: false,
      referralCode: randomUUID().substring(0, 8),
      referralCredits: 0,
      notificationSettings: null,
    };
    this.users.set(id, user);
    this.userCredits.set(id, 0);
    
    // Save to file
    await this.saveUsers();
    
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error("User not found");
    }

    const updatedUser = {
      ...user,
      ...updates,
      id: user.id, // Ensure id doesn't change
      username: user.username, // Ensure username doesn't change
      email: user.email, // Ensure email doesn't change (use separate endpoint for that)
    };

    this.users.set(id, updatedUser);
    await this.saveUsers();
    
    return updatedUser;
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
      await atomicWriteFile(USERS_FILE, usersData);
    } catch (error) {
      logger.error({ err: error }, "Error saving users");
    }
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const id = randomUUID();
    
    // [JOB_CREATE] Debug logging and validation
    logger.info({ id, length: id.length }, "[JOB_CREATE] Generated UUID");
    
    // Validate UUID format and length
    if (id.length !== 36) {
      const error = `[JOB_CREATE] ERROR: UUID length is ${id.length}, expected 36. UUID: ${id}`;
      logger.error(error);
      throw new Error(error);
    }
    
    // Validate UUID format (8-4-4-4-12 pattern)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      const error = `[JOB_CREATE] ERROR: UUID format invalid. UUID: ${id}`;
      logger.error(error);
      throw new Error(error);
    }
    
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
    
    logger.info({ id: job.id, length: job.id.length }, "[JOB_CREATE] Created job object");
    
    this.jobs.set(id, job);
    await this.saveJobs();
    
    // Verify job was saved correctly
    const savedJob = this.jobs.get(id);
    if (!savedJob) {
      throw new Error(`[JOB_CREATE] ERROR: Failed to save job with id: ${id}`);
    }
    
    logger.info({ id: savedJob.id, length: savedJob.id.length }, "[JOB_CREATE] Job saved successfully");
    
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
      await atomicWriteFile(settingsFile, defaults);
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
    await atomicWriteFile(settingsFile, validated);
    
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
    await atomicWriteFile(BUILDS_FILE, buildsObj);
  }

  private async saveVersions() {
    const versionsObj = Object.fromEntries(this.versions);
    await atomicWriteFile(VERSIONS_FILE, versionsObj);
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

  // Atomic file write helper: write to temp → rename to final
  private async atomicWriteFile(finalPath: string, content: string): Promise<void> {
    const dir = path.dirname(finalPath);
    const tempPath = path.join(dir, `.tmp-${randomUUID()}`);
    
    try {
      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true });
      
      // Write to temp file
      await fs.writeFile(tempPath, content, 'utf-8');
      
      // Ensure data is written to disk
      const fileHandle = await fs.open(tempPath, 'r+');
      await fileHandle.sync();
      await fileHandle.close();
      
      // Atomic rename to final location
      await fs.rename(tempPath, finalPath);
    } catch (error) {
      // Cleanup temp file on failure
      try {
        await fs.unlink(tempPath);
      } catch {
        // Temp file might not exist, ignore
      }
      throw error;
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
    
    // Save to file system using atomic write
    const userDraftsDir = path.join(LIBRARY_DIR, draft.userId, "drafts");
    const draftFile = path.join(userDraftsDir, `${draftId}.json`);
    await this.atomicWriteFile(draftFile, JSON.stringify(newDraft, null, 2));
    
    logger.info(`[DRAFT] Created draft ${draftId} atomically for user ${draft.userId}`);
    
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
      
      // Save to file using atomic write
      const draftFile = path.join(LIBRARY_DIR, draft.userId, "drafts", `${draftId}.json`);
      await this.atomicWriteFile(draftFile, JSON.stringify(updated, null, 2));
      
      logger.info(`[DRAFT] Updated draft ${draftId} atomically`);
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
      await atomicWriteFile(billingFile, { invoices: invoicesArray });
    } catch (error) {
      logger.error({ err: error }, "Error saving invoices");
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
    await atomicWriteFile(themeFile, theme);
  }

  // Project Settings methods
  async getProjectSettings(projectId: string): Promise<ProjectSettings | null> {
    // Check if settings exist in Map
    if (this.projectSettings.has(projectId)) {
      return this.projectSettings.get(projectId)!;
    }

    // If not in Map, try to load from file
    try {
      const settingsFile = path.join(process.cwd(), "data", "projects", projectId, "settings.json");
      const data = await fs.readFile(settingsFile, "utf-8");
      const settings = JSON.parse(data);
      
      // Validate and cache in Map
      const workspace = settingsSchema.shape.workspace.parse(settings.workspace);
      const editor = settingsSchema.shape.editor.parse(settings.editor);
      const projectSettings: ProjectSettings = { workspace, editor };
      
      this.projectSettings.set(projectId, projectSettings);
      return projectSettings;
    } catch (error) {
      // Settings file doesn't exist or invalid
      return null;
    }
  }

  async saveProjectSettings(projectId: string, settings: ProjectSettings): Promise<void> {
    // Save to Map
    this.projectSettings.set(projectId, settings);
    
    // Persist to file
    const projectDir = path.join(process.cwd(), "data", "projects", projectId);
    await fs.mkdir(projectDir, { recursive: true });
    
    const settingsFile = path.join(projectDir, "settings.json");
    await atomicWriteFile(settingsFile, settings);
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
      await atomicWriteFile(SUPPORT_TICKETS_FILE, ticketsObj);
    } catch (error) {
      logger.error({ err: error }, "Error saving support tickets");
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

  // Profile methods
  async getUserProfile(userId: string): Promise<{ user: User, projects: Job[] }> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    const projects = await this.getUserJobs(userId);
    return { user, projects };
  }

  async updateUserProfile(userId: string, data: { firstName?: string, lastName?: string, bio?: string, publicProfile?: boolean }): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Validate bio length
    if (data.bio && data.bio.length > 140) {
      throw new Error("Bio must be 140 characters or less");
    }

    const updatedUser = {
      ...user,
      ...data,
    };

    this.users.set(userId, updatedUser);
    await this.saveUsers();
    
    return updatedUser;
  }

  // SSH Key methods
  async getUserSSHKeys(userId: string): Promise<SSHKey[]> {
    const keysFile = path.join(process.cwd(), "data", "users", userId, "ssh_keys.json");
    try {
      const data = await fs.readFile(keysFile, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  async addSSHKey(userId: string, key: InsertSSHKey): Promise<SSHKey> {
    const keys = await this.getUserSSHKeys(userId);
    const newKey: SSHKey = {
      ...key,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      fingerprint: this.generateSSHFingerprint(key.publicKey),
    };
    
    keys.push(newKey);
    
    const keysDir = path.join(process.cwd(), "data", "users", userId);
    await fs.mkdir(keysDir, { recursive: true });
    const keysFile = path.join(keysDir, "ssh_keys.json");
    await atomicWriteFile(keysFile, keys);
    
    return newKey;
  }

  async deleteSSHKey(userId: string, keyId: string): Promise<void> {
    const keys = await this.getUserSSHKeys(userId);
    const filtered = keys.filter(k => k.id !== keyId);
    
    const keysFile = path.join(process.cwd(), "data", "users", userId, "ssh_keys.json");
    await atomicWriteFile(keysFile, filtered);
  }

  private generateSSHFingerprint(publicKey: string): string {
    // Simple mock fingerprint - in production would use proper crypto
    const hash = publicKey.slice(0, 32);
    return `SHA256:${hash}`;
  }

  // Secret methods
  async getUserSecrets(userId: string): Promise<Secret[]> {
    const secretsFile = path.join(process.cwd(), "data", "users", userId, "secrets.json");
    try {
      const data = await fs.readFile(secretsFile, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  async addSecret(userId: string, secret: InsertSecret): Promise<Secret> {
    const secrets = await this.getUserSecrets(userId);
    
    // Base64 encode the value (mock encryption)
    const encodedValue = Buffer.from(secret.value).toString("base64");
    
    const newSecret: Secret = {
      id: randomUUID(),
      name: secret.name,
      value: encodedValue,
      createdAt: new Date().toISOString(),
    };
    
    secrets.push(newSecret);
    
    const secretsDir = path.join(process.cwd(), "data", "users", userId);
    await fs.mkdir(secretsDir, { recursive: true });
    const secretsFile = path.join(secretsDir, "secrets.json");
    await atomicWriteFile(secretsFile, secrets);
    
    return newSecret;
  }

  async deleteSecret(userId: string, name: string): Promise<void> {
    const secrets = await this.getUserSecrets(userId);
    const filtered = secrets.filter(s => s.name !== name);
    
    const secretsFile = path.join(process.cwd(), "data", "users", userId, "secrets.json");
    await atomicWriteFile(secretsFile, filtered);
  }

  // Integration methods
  async getUserIntegrations(userId: string): Promise<Integration[]> {
    const integrationsFile = path.join(process.cwd(), "data", "users", userId, "integrations.json");
    try {
      const data = await fs.readFile(integrationsFile, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      // Return default integrations
      return [
        { provider: "github", connected: false },
        { provider: "gitlab", connected: false },
        { provider: "bitbucket", connected: false },
        { provider: "google", connected: false },
      ];
    }
  }

  async connectIntegration(userId: string, provider: string): Promise<void> {
    const integrations = await this.getUserIntegrations(userId);
    const existing = integrations.find(i => i.provider === provider);
    
    if (existing) {
      existing.connected = true;
      existing.connectedAt = new Date().toISOString();
      existing.username = `${userId}_${provider}`; // Mock username
    } else {
      integrations.push({
        provider,
        connected: true,
        connectedAt: new Date().toISOString(),
        username: `${userId}_${provider}`,
      });
    }
    
    const integrationsDir = path.join(process.cwd(), "data", "users", userId);
    await fs.mkdir(integrationsDir, { recursive: true });
    const integrationsFile = path.join(integrationsDir, "integrations.json");
    await atomicWriteFile(integrationsFile, integrations);
  }

  async disconnectIntegration(userId: string, provider: string): Promise<void> {
    const integrations = await this.getUserIntegrations(userId);
    const existing = integrations.find(i => i.provider === provider);
    
    if (existing) {
      existing.connected = false;
      existing.connectedAt = undefined;
      existing.username = undefined;
    }
    
    const integrationsFile = path.join(process.cwd(), "data", "users", userId, "integrations.json");
    await atomicWriteFile(integrationsFile, integrations);
  }

  // Domain methods
  async getUserDomains(userId: string): Promise<Domain[]> {
    const domainsFile = path.join(process.cwd(), "data", "users", userId, "domains.json");
    try {
      const data = await fs.readFile(domainsFile, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  async addDomain(userId: string, domain: InsertDomain): Promise<Domain> {
    const domains = await this.getUserDomains(userId);
    
    const newDomain: Domain = {
      id: randomUUID(),
      domain: domain.domain,
      verified: false,
      createdAt: new Date().toISOString(),
    };
    
    domains.push(newDomain);
    
    const domainsDir = path.join(process.cwd(), "data", "users", userId);
    await fs.mkdir(domainsDir, { recursive: true });
    const domainsFile = path.join(domainsDir, "domains.json");
    await atomicWriteFile(domainsFile, domains);
    
    return newDomain;
  }

  async deleteDomain(userId: string, domainId: string): Promise<void> {
    const domains = await this.getUserDomains(userId);
    const filtered = domains.filter(d => d.id !== domainId);
    
    const domainsFile = path.join(process.cwd(), "data", "users", userId, "domains.json");
    await atomicWriteFile(domainsFile, filtered);
  }

  // Chat methods
  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const id = randomUUID();
    const chatMessage: ChatMessage = {
      id,
      userId: message.userId,
      projectId: message.projectId || null,
      role: message.role,
      content: message.content,
      metadata: message.metadata || null,
      createdAt: new Date(),
    };
    
    this.chatMessages.set(id, chatMessage);
    return chatMessage;
  }

  async getChatHistory(userId: string, projectId?: string, limit: number = 100): Promise<ChatMessage[]> {
    const messages = Array.from(this.chatMessages.values())
      .filter(m => m.userId === userId && (!projectId || m.projectId === projectId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
    
    return messages.reverse(); // Return in chronological order
  }

  async deleteChatMessage(messageId: string): Promise<void> {
    this.chatMessages.delete(messageId);
  }

  // Code Execution methods
  async createCodeExecution(execution: InsertCodeExecution): Promise<CodeExecution> {
    const id = randomUUID();
    const codeExecution: CodeExecution = {
      id,
      userId: execution.userId,
      projectId: execution.projectId || null,
      language: execution.language,
      code: execution.code,
      stdout: null,
      stderr: null,
      exitCode: null,
      executionTimeMs: null,
      status: "pending",
      createdAt: new Date(),
    };
    
    this.codeExecutions.set(id, codeExecution);
    return codeExecution;
  }

  async getCodeExecutionHistory(userId: string, projectId?: string, limit: number = 50): Promise<CodeExecution[]> {
    return Array.from(this.codeExecutions.values())
      .filter(e => e.userId === userId && (!projectId || e.projectId === projectId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async updateCodeExecution(id: string, updates: Partial<CodeExecution>): Promise<void> {
    const execution = this.codeExecutions.get(id);
    if (!execution) {
      throw new Error(`Code execution ${id} not found`);
    }
    
    Object.assign(execution, updates);
    this.codeExecutions.set(id, execution);
  }

  // Project Collaboration methods
  async addCollaborator(projectId: string, userId: string, role: string): Promise<ProjectCollaborator> {
    const id = randomUUID();
    const collaborator: ProjectCollaborator = {
      id,
      projectId,
      userId,
      role,
      invitedAt: new Date(),
      acceptedAt: new Date(), // Auto-accept for now
    };
    
    const existing = this.collaborators.get(projectId) || [];
    existing.push(collaborator);
    this.collaborators.set(projectId, existing);
    
    return collaborator;
  }

  async getCollaborators(projectId: string): Promise<ProjectCollaborator[]> {
    return this.collaborators.get(projectId) || [];
  }

  async removeCollaborator(projectId: string, userId: string): Promise<void> {
    const existing = this.collaborators.get(projectId) || [];
    const filtered = existing.filter(c => c.userId !== userId);
    this.collaborators.set(projectId, filtered);
  }

  // Project Version Control methods
  async createCommit(commit: Omit<ProjectCommit, 'id' | 'createdAt'>): Promise<ProjectCommit> {
    const id = randomUUID();
    const projectCommit: ProjectCommit = {
      id,
      projectId: commit.projectId,
      userId: commit.userId,
      message: commit.message,
      changes: commit.changes,
      parentCommitId: commit.parentCommitId || null,
      createdAt: new Date(),
    };
    
    const existing = this.commits.get(commit.projectId) || [];
    existing.push(projectCommit);
    this.commits.set(commit.projectId, existing);
    
    return projectCommit;
  }

  async getCommits(projectId: string, limit: number = 50): Promise<ProjectCommit[]> {
    const commits = this.commits.get(projectId) || [];
    return commits
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }
}

export const storage = new MemStorage();
