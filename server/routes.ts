import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { jobQueue } from "./queue";
import { insertJobSchema, insertUserSchema, jobFinalizationSchema, draftSchema, regenerationScopeSchema } from "@shared/schema";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import multer from "multer";

const upload = multer({
  dest: "public/uploads/",
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/html", "text/plain"
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Job generation endpoint
  app.post("/api/generate", async (req, res) => {
    try {
      // For backward compatibility, default to demo user if userId not provided
      const bodyWithUserId = {
        ...req.body,
        userId: req.body.userId || "demo"
      };
      
      const validation = insertJobSchema.safeParse(bodyWithUserId);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid request", details: validation.error });
      }

      const job = await storage.createJob(validation.data);
      
      // Add to job queue for processing
      await jobQueue.addJob(job.id, job.prompt);
      
      res.json({ jobId: job.id, status: job.status });
    } catch (error) {
      console.error("Error creating job:", error);
      res.status(500).json({ error: "Failed to create job" });
    }
  });

  // Get job status
  app.get("/api/jobs/:jobId", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.jobId);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      res.json({
        id: job.id,
        prompt: job.prompt,
        status: job.status,
        result: job.result,
        error: job.error,
        settings: job.settings,
        createdAt: job.createdAt,
      });
    } catch (error) {
      console.error("Error fetching job:", error);
      res.status(500).json({ error: "Failed to fetch job" });
    }
  });

  // Finalize job - save edits and move to editing state
  app.post("/api/jobs/:jobId/finalize", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.jobId);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (job.status !== "ready_for_finalization") {
        return res.status(400).json({ error: "Job is not ready for finalization" });
      }

      // Validate request body
      const validationResult = jobFinalizationSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid finalization data", 
          details: validationResult.error.errors 
        });
      }

      const finalizationSettings = validationResult.data;

      await storage.updateJob(req.params.jobId, {
        status: "editing",
        settings: JSON.stringify(finalizationSettings),
      });

      res.json({ success: true, status: "editing" });
    } catch (error) {
      console.error("Error finalizing job:", error);
      res.status(500).json({ error: "Failed to finalize job" });
    }
  });

  // Save draft edits without changing status
  app.post("/api/jobs/:jobId/save-draft", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.jobId);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Validate request body
      const validationResult = jobFinalizationSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid draft data", 
          details: validationResult.error.errors 
        });
      }

      const draftSettings = validationResult.data;

      await storage.updateJob(req.params.jobId, {
        settings: JSON.stringify(draftSettings),
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving draft:", error);
      res.status(500).json({ error: "Failed to save draft" });
    }
  });

  // Upload files for AI Design Assistant
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { jobId, userId } = req.body;
      if (!jobId || !userId) {
        return res.status(400).json({ error: "Missing jobId or userId" });
      }

      const uploadDir = path.join(process.cwd(), "public", "uploads", userId, jobId);
      await fs.mkdir(uploadDir, { recursive: true });

      const filePath = path.join(uploadDir, req.file.originalname);
      await fs.rename(req.file.path, filePath);

      const asset = {
        url: `/uploads/${userId}/${jobId}/${req.file.originalname}`,
        name: req.file.originalname,
        mime: req.file.mimetype,
        size: req.file.size,
        parsed: {
          textPreview: req.file.mimetype.startsWith("text/") ? 
            (await fs.readFile(filePath, "utf-8")).substring(0, 500) : undefined,
          warnings: []
        }
      };

      await storage.addUploadedAsset(jobId, asset);

      res.json(asset);
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  // Create draft for library
  app.post("/api/drafts", async (req, res) => {
    try {
      const { jobId, userId, ...draftData } = req.body;
      
      if (!jobId || !userId) {
        return res.status(400).json({ error: "Missing jobId or userId" });
      }

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const draft = await storage.createDraft({
        jobId,
        userId,
        thumbnail: job.result || undefined,
        ...draftData
      });

      res.json({ ok: true, draftId: draft.draftId, libraryEntry: draft });
    } catch (error) {
      console.error("Error creating draft:", error);
      res.status(500).json({ error: "Failed to create draft" });
    }
  });

  // Get drafts for library
  app.get("/api/drafts/:userId", async (req, res) => {
    try {
      const drafts = await storage.getDrafts(req.params.userId);
      res.json(drafts);
    } catch (error) {
      console.error("Error fetching drafts:", error);
      res.status(500).json({ error: "Failed to fetch drafts" });
    }
  });

  // Regenerate job with scope
  app.post("/api/jobs/:jobId/regenerate", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.jobId);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const { scope, draftEdits } = req.body;
      
      const scopeValidation = regenerationScopeSchema.safeParse(scope);
      if (!scopeValidation.success) {
        return res.status(400).json({ error: "Invalid regeneration scope" });
      }

      await storage.updateJob(req.params.jobId, {
        settings: JSON.stringify(draftEdits),
        status: "queued"
      });

      await jobQueue.addJob(req.params.jobId, job.prompt, scopeValidation.data);

      res.json({ jobId: req.params.jobId, queued: true });
    } catch (error) {
      console.error("Error regenerating job:", error);
      res.status(500).json({ error: "Failed to regenerate" });
    }
  });

  // Select and open workspace
  app.post("/api/jobs/:jobId/select", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.jobId);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const { draftEdits } = req.body;

      await storage.updateJob(req.params.jobId, {
        settings: JSON.stringify(draftEdits),
        status: "editing"
      });

      const workspaceDir = path.join(process.cwd(), "data", "workspaces", req.params.jobId);
      await fs.mkdir(workspaceDir, { recursive: true });

      const manifest = {
        name: draftEdits?.title || "Untitled Project",
        description: draftEdits?.description || "",
        entryPoint: "index.html",
        dependencies: {}
      };

      await fs.writeFile(
        path.join(workspaceDir, "manifest.json"),
        JSON.stringify(manifest, null, 2)
      );

      res.json({ ok: true, workspaceUrl: `/workspace/${req.params.jobId}` });
    } catch (error) {
      console.error("Error selecting job:", error);
      res.status(500).json({ error: "Failed to select" });
    }
  });

  // Get workspace files
  app.get("/api/workspace/:jobId/files", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.jobId);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const previewPath = job.result?.replace("/previews/", "");
      if (!previewPath) {
        return res.status(404).json({ error: "No preview available" });
      }

      const previewDir = path.join(process.cwd(), "public", "previews", req.params.jobId);
      const indexPath = path.join(previewDir, "index.html");

      try {
        const content = await fs.readFile(indexPath, "utf-8");
        
        res.json({
          files: [
            {
              path: "index.html",
              content,
              language: "html"
            }
          ],
          manifest: {
            name: "Generated Site",
            description: job.prompt,
            entryPoint: "index.html"
          }
        });
      } catch (error) {
        res.status(404).json({ error: "Workspace files not found" });
      }
    } catch (error) {
      console.error("Error fetching workspace files:", error);
      res.status(500).json({ error: "Failed to fetch workspace files" });
    }
  });

  // Get job logs
  app.get("/api/jobs/:jobId/logs", async (req, res) => {
    try {
      const logFile = path.join(process.cwd(), "data", "jobs", req.params.jobId, "logs.jsonl");
      
      try {
        const content = await fs.readFile(logFile, "utf-8");
        const logs = content.trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
        res.json(logs);
      } catch (error) {
        res.json([]);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  // Get drafts for user
  app.get("/api/drafts/:userId", async (req, res) => {
    try {
      const drafts = await storage.getDrafts(req.params.userId);
      res.json(drafts);
    } catch (error) {
      console.error("Error fetching drafts:", error);
      res.status(500).json({ error: "Failed to fetch drafts" });
    }
  });

  // Get Razorpay key (mock mode)
  app.get("/api/razorpay_key", (req, res) => {
    // In mock mode, return a test key
    res.json({ 
      key: process.env.RAZORPAY_KEY_ID || "rzp_test_mock_key_12345",
      isMockMode: !process.env.RAZORPAY_KEY_ID 
    });
  });

  // Razorpay webhook
  app.post("/webhooks/razorpay", async (req, res) => {
    try {
      const signature = req.headers["x-razorpay-signature"] as string;
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "mock_webhook_secret";

      // Get raw body (preserved by express.raw middleware)
      const rawBody = req.body as Buffer;
      
      // Verify signature (HMAC SHA256) using raw body
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex");

      if (signature !== expectedSignature) {
        console.error("Invalid webhook signature");
        return res.status(400).json({ error: "Invalid signature" });
      }

      // Parse JSON from raw body
      const body = JSON.parse(rawBody.toString());
      const event = body.event;
      const payload = body.payload;

      if (event === "payment.captured") {
        const paymentId = payload.payment.entity.id;
        const amount = payload.payment.entity.amount / 100; // Convert from paise to rupees
        const userId = payload.payment.entity.notes?.userId || "demo";

        // Update user credits
        const currentCredits = await storage.getUserCredits(userId);
        const creditsToAdd = Math.floor(amount / 799); // 1 credit per ₹799
        await storage.updateUserCredits(userId, currentCredits + creditsToAdd);

        // Log payment
        const logEntry = `${new Date().toISOString()} - Payment captured: ${paymentId}, User: ${userId}, Amount: ₹${amount}, Credits added: ${creditsToAdd}\n`;
        await fs.appendFile(
          path.join(process.cwd(), "data", "payments.log"),
          logEntry
        );

        console.log(`Payment processed: ${paymentId} for user ${userId}`);
      }

      res.json({ status: "ok" });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // Get user credits
  app.get("/api/credits/:userId", async (req, res) => {
    try {
      const credits = await storage.getUserCredits(req.params.userId);
      res.json({ userId: req.params.userId, credits });
    } catch (error) {
      console.error("Error fetching credits:", error);
      res.status(500).json({ error: "Failed to fetch credits" });
    }
  });

  // Auth: Sign in (mock mode)
  app.post("/api/auth/signin", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }

      // Check if user exists
      let user = await storage.getUserByEmail(email);
      
      if (!user) {
        // In mock mode, auto-create user if they don't exist
        const username = email.split('@')[0];
        user = await storage.createUser({
          email,
          username,
          password // In production, hash this password
        });
        console.log(`Mock auth: Auto-created user ${email}`);
      }

      // In mock mode, we don't actually verify password
      // In production, you'd verify against hashed password
      
      const credits = await storage.getUserCredits(user.id);
      
      res.json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          credits
        }
      });
    } catch (error) {
      console.error("Sign in error:", error);
      res.status(500).json({ error: "Sign in failed" });
    }
  });

  // Auth: Sign up (mock mode)
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: "User already exists" });
      }

      // Create username from email
      const username = email.split('@')[0];
      
      // Create user
      const user = await storage.createUser({
        email,
        username,
        password // In production, hash this password
      });

      // Initialize credits
      const credits = await storage.getUserCredits(user.id);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          credits
        }
      });
    } catch (error) {
      console.error("Sign up error:", error);
      res.status(500).json({ error: "Sign up failed" });
    }
  });

  // Get current user
  app.get("/api/me", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      // Validate mock token format (header.payload.signature)
      const parts = token.split('.');
      if (parts.length !== 3) {
        return res.status(401).json({ error: "Invalid token" });
      }

      try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        
        // Check expiration
        if (payload.exp && payload.exp < Date.now()) {
          return res.status(401).json({ error: "Token expired" });
        }

        // Get user by email from token
        const user = await storage.getUserByEmail(payload.email);
        
        if (!user) {
          return res.status(401).json({ error: "User not found" });
        }

        const credits = await storage.getUserCredits(user.id);

        res.json({
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            credits
          }
        });
      } catch (error) {
        return res.status(401).json({ error: "Invalid token" });
      }
    } catch (error) {
      console.error("Get current user error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // Get user projects (mock data for now)
  app.get("/api/projects", async (req, res) => {
    try {
      // For now, return empty array as we don't have project storage yet
      // In a real implementation, this would fetch from storage
      res.json([]);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  // OAuth Mock Endpoints
  app.get("/api/auth/:provider", async (req, res) => {
    const { provider } = req.params;
    const validProviders = ["google", "apple", "facebook", "twitter", "github"];
    
    if (!validProviders.includes(provider.toLowerCase())) {
      return res.status(400).json({ error: "Invalid provider" });
    }

    // In MOCK_MODE, redirect to mock success
    // In production, this would initiate real OAuth flow
    const mockMode = !process.env.OAUTH_CLIENT_ID;
    
    if (mockMode) {
      return res.redirect(`/api/auth/mock-success?provider=${provider}`);
    }

    // Real OAuth flow would go here
    res.status(501).json({ error: "Real OAuth not implemented yet" });
  });

  app.get("/api/auth/mock-success", async (req, res) => {
    const provider = req.query.provider as string || "unknown";
    
    try {
      // Create/get demo OAuth user
      const mockEmail = `demo-${provider.toLowerCase()}@ybuilt.com`;
      let user = await storage.getUserByEmail(mockEmail);
      
      if (!user) {
        user = await storage.createUser({
          email: mockEmail,
          username: `${provider}User`,
          password: "oauth-mock-password"
        });
        console.log(`Mock OAuth: Auto-created ${provider} user`);
      }

      // In a real app, you'd set a secure session cookie here
      // For now, just redirect to homepage with success param
      res.redirect(`/?oauth=success&provider=${provider}&email=${encodeURIComponent(mockEmail)}`);
    } catch (error) {
      console.error("OAuth mock error:", error);
      res.redirect(`/?oauth=error`);
    }
  });

  // Settings API
  app.get("/api/settings", async (req, res) => {
    try {
      // In mock mode, use demo user ID from authorization or default
      const userId = "demo"; // In production, extract from JWT
      const settings = await storage.getSettings(userId);
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings/:section", async (req, res) => {
    try {
      const { section } = req.params;
      const userId = "demo"; // In production, extract from JWT
      
      // Validate section is a valid settings section
      const validSections = ["appearance", "account", "workspace", "editor", "ai", "organization", "security", "integrations", "billing", "team", "notifications", "export"];
      if (!validSections.includes(section)) {
        return res.status(400).json({ error: "Invalid settings section" });
      }
      
      // Get current settings
      const current = await storage.getSettings(userId);
      
      // Validate the section data against the schema
      const { settingsSchema } = await import("@shared/schema");
      const sectionSchema = settingsSchema.shape[section as keyof typeof settingsSchema.shape];
      
      // Parse and validate the incoming section data
      const validatedSectionData = sectionSchema.parse(req.body);
      
      // Update only the specific section
      const updates = { [section]: validatedSectionData };
      const updatedSettings = await storage.updateSettings(userId, updates);
      
      res.json(updatedSettings);
    } catch (error) {
      console.error("Error updating settings:", error);
      if (error instanceof Error && error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid settings data", details: error });
      }
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
