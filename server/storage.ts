import { type User, type InsertUser, type Job, type InsertJob, type Build, type Version, type Settings, settingsSchema } from "@shared/schema";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";

const JOBS_FILE = path.join(process.cwd(), "data", "jobs.json");
const USERS_FILE = path.join(process.cwd(), "data", "users.json");
const BUILDS_FILE = path.join(process.cwd(), "data", "builds.json");
const VERSIONS_FILE = path.join(process.cwd(), "data", "versions.json");
const SETTINGS_DIR = path.join(process.cwd(), "data", "settings");

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUserCredits(userId: string): Promise<number>;
  updateUserCredits(userId: string, credits: number): Promise<void>;
  
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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private jobs: Map<string, Job>;
  private builds: Map<string, Build>;
  private versions: Map<string, Version>;
  private userCredits: Map<string, number>;

  constructor() {
    this.users = new Map();
    this.jobs = new Map();
    this.builds = new Map();
    this.versions = new Map();
    this.userCredits = new Map([["demo", 0]]);
    this.loadJobs();
    this.loadUsers();
    this.loadBuilds();
    this.loadVersions();
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
}

export const storage = new MemStorage();
