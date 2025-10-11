import { type User, type InsertUser, type Job, type InsertJob } from "@shared/schema";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";

const JOBS_FILE = path.join(process.cwd(), "data", "jobs.json");
const USERS_FILE = path.join(process.cwd(), "data", "users.json");

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createJob(job: InsertJob): Promise<Job>;
  getJob(id: string): Promise<Job | undefined>;
  updateJobStatus(id: string, status: string, result?: string): Promise<void>;
  getAllJobs(): Promise<Job[]>;
  
  getUserCredits(userId: string): Promise<number>;
  updateUserCredits(userId: string, credits: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private jobs: Map<string, Job>;
  private userCredits: Map<string, number>;

  constructor() {
    this.users = new Map();
    this.jobs = new Map();
    this.userCredits = new Map([["demo", 0]]);
    this.loadJobs();
    this.loadUsers();
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
      prompt: insertJob.prompt,
      status: "pending",
      result: null,
      createdAt: new Date(),
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
}

export const storage = new MemStorage();
