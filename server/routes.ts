import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { jobQueue } from "./queue";
import { insertJobSchema, insertUserSchema, jobFinalizationSchema, draftSchema, regenerationScopeSchema, insertSupportTicketSchema } from "@shared/schema";
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

const supportUpload = multer({
  dest: "data/support/attachments/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for support attachments
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "application/pdf",
      "text/plain",
      "video/mp4", "video/webm"
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type for support attachment"));
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

      // Verify preview files exist before returning
      const previewDir = path.join(process.cwd(), "public", "previews", req.params.jobId);
      const indexPath = path.join(previewDir, "index.html");
      
      try {
        await fs.access(indexPath);
        res.json({ 
          ok: true, 
          workspaceUrl: `/workspace/${req.params.jobId}`,
          workspaceReady: true 
        });
      } catch (error) {
        res.status(404).json({ error: "Preview files not found" });
      }
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
        
        const files = [
          {
            path: "index.html",
            content,
            language: "html"
          }
        ];

        // Check for prompt files
        const promptsDir = path.join(process.cwd(), "data", "workspaces", req.params.jobId, "prompts");
        try {
          const promptFiles = await fs.readdir(promptsDir);
          
          // Read prompt files and add to files array (newest first)
          const promptFileData = await Promise.all(
            promptFiles.map(async (fileName) => {
              try {
                const filePath = path.join(promptsDir, fileName);
                const content = await fs.readFile(filePath, "utf-8");
                const stats = await fs.stat(filePath);
                
                return {
                  path: `prompts/${fileName}`,
                  content,
                  language: "markdown",
                  type: "prompt",
                  createdAt: stats.mtime.toISOString()
                };
              } catch (err) {
                return null;
              }
            })
          );

          // Filter out nulls and sort by creation time (newest first)
          const validPromptFiles = promptFileData
            .filter((f): f is NonNullable<typeof f> => f !== null)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          // Add prompt files at the beginning
          files.unshift(...validPromptFiles);
        } catch (error) {
          // No prompts directory yet, that's ok
        }
        
        res.json({
          files,
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

  // Get workspace theme
  app.get("/api/workspace/:jobId/theme", async (req, res) => {
    try {
      const { jobId } = req.params;
      
      if (!jobId) {
        return res.status(400).json({ error: "Job ID is required" });
      }

      const theme = await storage.getProjectTheme(jobId);
      
      // Theme is always returned (default theme if no custom theme exists)
      res.json(theme);
    } catch (error) {
      console.error("Error fetching workspace theme:", error);
      res.status(500).json({ error: "Failed to fetch workspace theme" });
    }
  });

  // Save workspace theme
  app.post("/api/workspace/:jobId/theme", async (req, res) => {
    try {
      const { jobId } = req.params;
      
      if (!jobId) {
        return res.status(400).json({ error: "Job ID is required" });
      }

      // Validate theme data
      const { projectThemeSchema } = await import("@shared/schema");
      const theme = projectThemeSchema.parse(req.body);

      await storage.saveProjectTheme(jobId, theme);

      res.json({ success: true, theme });
    } catch (error: any) {
      console.error("Error saving workspace theme:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid theme data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to save workspace theme" });
    }
  });

  // System Status
  app.get("/api/status", async (req, res) => {
    try {
      const status = await storage.getSystemStatus();
      res.json(status);
    } catch (error) {
      console.error("Error fetching system status:", error);
      res.status(500).json({ error: "Failed to fetch system status" });
    }
  });

  // Support Tickets
  app.post("/api/support/tickets", supportUpload.array("attachments", 5), async (req, res) => {
    try {
      const { userId, type, subject, message } = req.body;
      
      if (!userId || !type || !message) {
        return res.status(400).json({ error: "Missing required fields: userId, type, message" });
      }

      // Process uploaded attachments
      const attachments = [];
      if (req.files && Array.isArray(req.files)) {
        for (const file of req.files) {
          const attachmentDir = path.join(process.cwd(), "data", "support", "attachments");
          await fs.mkdir(attachmentDir, { recursive: true });
          
          const fileName = `${Date.now()}-${file.originalname}`;
          const filePath = path.join(attachmentDir, fileName);
          await fs.rename(file.path, filePath);
          
          attachments.push({
            name: file.originalname,
            url: `/support/attachments/${fileName}`,
            size: file.size,
          });
        }
      }

      // Validate and create ticket
      const ticketData = {
        userId,
        type,
        subject: subject || "",
        message,
        attachments,
      };

      const validation = insertSupportTicketSchema.safeParse(ticketData);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid ticket data", 
          details: validation.error.errors 
        });
      }

      const ticket = await storage.createSupportTicket(validation.data);

      res.json({
        ticketId: ticket.id,
        status: ticket.status,
        message: "Support ticket created successfully",
      });
    } catch (error) {
      console.error("Error creating support ticket:", error);
      res.status(500).json({ error: "Failed to create support ticket" });
    }
  });

  app.get("/api/support/tickets/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      const tickets = await storage.getSupportTickets(userId);
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching support tickets:", error);
      res.status(500).json({ error: "Failed to fetch support tickets" });
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

  // ===== NEW WORKSPACE & PUBLISH ROUTES =====

  // Get plan info
  app.get("/api/plan", async (req, res) => {
    try {
      // In mock mode, use demo user
      const userId = "demo";
      const credits = await storage.getUserCredits(userId);

      res.json({
        currentPlan: "free",
        publishCost: 50, // INR per publish
        credits
      });
    } catch (error) {
      console.error("Error fetching plan:", error);
      res.status(500).json({ error: "Failed to fetch plan" });
    }
  });

  // Create Razorpay order for credits purchase
  app.post("/api/create_order", async (req, res) => {
    try {
      const { amount } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      // In mock mode, return a mock order
      const orderId = `order_${crypto.randomUUID().slice(0, 12)}`;
      
      res.json({
        id: orderId,
        amount: amount * 100, // Razorpay expects amount in paise
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
        status: "created"
      });
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  // Verify payment and add credits
  app.post("/api/verify_payment", async (req, res) => {
    try {
      const { orderId, paymentId, amount } = req.body;
      const userId = "demo"; // In production, extract from JWT

      // In mock mode, just add credits
      await storage.addCredits(userId, amount);

      // Create invoice for credit purchase
      const invoice = {
        id: `inv_${crypto.randomUUID().slice(0, 8)}`,
        userId,
        amount,
        type: "credit_purchase" as const,
        jobId: null,
        timestamp: new Date().toISOString(),
        status: "paid" as const,
        paymentId,
        orderId
      };

      await storage.createInvoice(invoice);

      res.json({
        success: true,
        credits: await storage.getUserCredits(userId)
      });
    } catch (error) {
      console.error("Error verifying payment:", error);
      res.status(500).json({ error: "Failed to verify payment" });
    }
  });

  // Publish job
  app.post("/api/jobs/:jobId/publish", async (req, res) => {
    try {
      const { jobId } = req.params;
      const userId = "demo"; // In production, extract from JWT

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Check credits
      const publishCost = 50;
      const credits = await storage.getUserCredits(userId);

      if (credits < publishCost) {
        return res.status(402).json({ 
          error: "Insufficient credits", 
          required: publishCost,
          available: credits 
        });
      }

      // Deduct credits
      await storage.deductCredits(userId, publishCost);

      // Create invoice
      const invoice = {
        id: `inv_${crypto.randomUUID().slice(0, 8)}`,
        userId,
        amount: publishCost,
        type: "publish" as const,
        jobId,
        timestamp: new Date().toISOString(),
        status: "paid" as const
      };

      await storage.createInvoice(invoice);

      // Update job status
      await storage.updateJob(jobId, { status: "published" });

      const publishedUrl = `https://${jobId}.ybuilt.app`;

      res.json({
        success: true,
        publishedUrl,
        invoice
      });
    } catch (error) {
      console.error("Error publishing job:", error);
      res.status(500).json({ error: "Failed to publish" });
    }
  });

  // Get workspace file
  app.get("/api/workspace/:jobId/file", async (req, res) => {
    try {
      const { jobId } = req.params;
      const { path: filePath } = req.query;

      if (!filePath || typeof filePath !== "string") {
        return res.status(400).json({ error: "Missing file path" });
      }

      const fullPath = path.join(process.cwd(), "public", "previews", jobId, filePath);

      try {
        const content = await fs.readFile(fullPath, "utf-8");
        res.json({ path: filePath, content });
      } catch (error) {
        res.status(404).json({ error: "File not found" });
      }
    } catch (error) {
      console.error("Error reading file:", error);
      res.status(500).json({ error: "Failed to read file" });
    }
  });

  // Save workspace file
  app.post("/api/workspace/:jobId/file", async (req, res) => {
    try {
      const { jobId } = req.params;
      const { path: filePath, content } = req.body;

      if (!filePath || typeof content !== "string") {
        return res.status(400).json({ error: "Missing file path or content" });
      }

      const fullPath = path.join(process.cwd(), "public", "previews", jobId, filePath);
      const dirPath = path.dirname(fullPath);

      // Ensure directory exists
      await fs.mkdir(dirPath, { recursive: true });

      // Write file
      await fs.writeFile(fullPath, content, "utf-8");

      res.json({ success: true, path: filePath });
    } catch (error) {
      console.error("Error writing file:", error);
      res.status(500).json({ error: "Failed to write file" });
    }
  });

  // Prompt to file - convert prompt text to file
  app.post("/api/workspace/:jobId/prompt-to-file", async (req, res) => {
    try {
      const { jobId } = req.params;
      const { promptText, filenameHint } = req.body;

      if (!promptText) {
        return res.status(400).json({ error: "Missing prompt text" });
      }

      const ts = Date.now();
      const safeName = (filenameHint || `prompt-${ts}`).replace(/[^a-z0-9._-]/gi, '-').slice(0, 80);
      const promptsDir = path.join(process.cwd(), "data", "workspaces", jobId, "prompts");
      
      // Ensure prompts directory exists
      await fs.mkdir(promptsDir, { recursive: true });

      const fileName = `${safeName}.md`;
      const filePath = path.join(promptsDir, fileName);

      // Write prompt as markdown file
      const content = `# Prompt\n\n${promptText}\n\n---\n\n*Created: ${new Date().toISOString()}*`;
      await fs.writeFile(filePath, content, "utf-8");

      // Log for debugging
      const auditLog = `${new Date().toISOString()} - Prompt to file: ${fileName}, Job: ${jobId}\n`;
      await fs.appendFile(
        path.join(process.cwd(), "data", "audit.log"),
        auditLog
      ).catch(() => {}); // Ignore errors for audit log

      const file = {
        path: `prompts/${fileName}`,
        name: fileName,
        url: `/workspaces/${jobId}/prompts/${fileName}`,
        size: content.length,
        type: 'prompt'
      };

      res.json({ file, fileCreated: true });
    } catch (error) {
      console.error("Error creating prompt file:", error);
      res.status(500).json({ error: "Failed to create prompt file" });
    }
  });

  // Create folder in workspace
  app.post("/api/workspace/:jobId/folder", async (req, res) => {
    try {
      const { jobId } = req.params;
      const { path: folderPath } = req.body;

      if (!folderPath || typeof folderPath !== "string") {
        return res.status(400).json({ error: "Missing folder path" });
      }

      // Sanitize folder path
      const safePath = folderPath.replace(/[^a-z0-9/_-]/gi, '-');
      const fullPath = path.join(process.cwd(), "data", "workspaces", jobId, safePath);

      // Create folder
      await fs.mkdir(fullPath, { recursive: true });

      // Log for debugging
      const auditLog = `${new Date().toISOString()} - New folder: ${safePath}, Job: ${jobId}\n`;
      await fs.appendFile(
        path.join(process.cwd(), "data", "audit.log"),
        auditLog
      ).catch(() => {}); // Ignore errors for audit log

      res.json({ ok: true, path: safePath });
    } catch (error) {
      console.error("Error creating folder:", error);
      res.status(500).json({ error: "Failed to create folder" });
    }
  });

  // Log streaming (SSE)
  app.get("/api/jobs/:jobId/logs/stream", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

    const { jobId } = req.params;
    const logFile = path.join(process.cwd(), "data", "jobs", jobId, "logs.jsonl");

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: "connected", jobId })}\n\n`);

    // Send existing logs first
    try {
      const content = await fs.readFile(logFile, "utf-8");
      const existingLogs = content.trim().split("\n").filter(Boolean);
      
      for (const line of existingLogs) {
        try {
          const log = JSON.parse(line);
          // Transform to expected format
          const transformedLog = {
            timestamp: log.timestamp || new Date(log.ts || Date.now()).toISOString(),
            level: log.level || "info",
            source: log.source || "worker",
            message: log.message || log.msg || "",
            metadata: log.metadata || log.details || log.meta || {}
          };
          res.write(`data: ${JSON.stringify(transformedLog)}\n\n`);
        } catch (parseError) {
          console.error("Failed to parse log line:", parseError);
        }
      }
    } catch (error) {
      // No logs yet or file doesn't exist
      console.log(`No logs found for job ${jobId}`);
    }

    // Poll for new logs every 500ms
    let lastSize = 0;
    try {
      const stats = await fs.stat(logFile);
      lastSize = stats.size;
    } catch (error) {
      // File doesn't exist yet
    }

    const intervalId = setInterval(async () => {
      try {
        const stats = await fs.stat(logFile);
        if (stats.size > lastSize) {
          // File has grown, read new content
          const stream = await fs.open(logFile, "r");
          const buffer = Buffer.alloc(stats.size - lastSize);
          await stream.read(buffer, 0, buffer.length, lastSize);
          await stream.close();
          
          const newContent = buffer.toString("utf-8");
          const newLines = newContent.trim().split("\n").filter(Boolean);
          
          for (const line of newLines) {
            try {
              const log = JSON.parse(line);
              const transformedLog = {
                timestamp: log.timestamp || new Date(log.ts || Date.now()).toISOString(),
                level: log.level || "info",
                source: log.source || "worker",
                message: log.message || log.msg || "",
                metadata: log.metadata || log.details || log.meta || {}
              };
              res.write(`data: ${JSON.stringify(transformedLog)}\n\n`);
            } catch (parseError) {
              console.error("Failed to parse log line:", parseError);
            }
          }
          
          lastSize = stats.size;
        }
      } catch (error) {
        // File doesn't exist yet, that's ok
      }
    }, 500);

    // Clean up on client disconnect
    req.on("close", () => {
      clearInterval(intervalId);
      res.end();
    });
  });

  // Build job
  app.post("/api/jobs/:jobId/build", async (req, res) => {
    try {
      const { jobId } = req.params;
      const { autonomy, autoApply, safetyFilter, computeTier, prompt } = req.body;

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Collect all agent settings
      const agentSettings = {
        autonomy: autonomy || "medium",
        autoApply: autoApply ?? false,
        safetyFilter: safetyFilter ?? true,
        computeTier: computeTier || "standard"
      };

      // Update job with full agent settings
      await storage.updateJob(jobId, { 
        status: "queued",
        settings: JSON.stringify({ agentSettings })
      });

      // Trigger job queue with agent settings
      const buildPrompt = prompt || job.prompt || "Rebuild and refine the application";
      await jobQueue.addJob(jobId, buildPrompt, undefined, agentSettings.autonomy);

      res.json({ 
        success: true, 
        status: "queued",
        agentSettings
      });
    } catch (error) {
      console.error("Error starting build:", error);
      res.status(500).json({ error: "Failed to start build" });
    }
  });

  // Extensions list
  app.get("/api/extensions", async (req, res) => {
    try {
      res.json([
        { id: "prettier", name: "Prettier", icon: "✨", installed: true },
        { id: "eslint", name: "ESLint", icon: "🔍", installed: false },
        { id: "typescript", name: "TypeScript", icon: "📘", installed: true },
        { id: "tailwind", name: "Tailwind IntelliSense", icon: "🎨", installed: true },
      ]);
    } catch (error) {
      console.error("Error fetching extensions:", error);
      res.status(500).json({ error: "Failed to fetch extensions" });
    }
  });

  // Command palette search
  app.post("/api/search/palette", async (req, res) => {
    try {
      const { query } = req.body;
      
      // Mock implementation - return filtered results
      const allCommands = [
        { id: "new-file", label: "New File", category: "Files" },
        { id: "upload", label: "Upload", category: "Files" },
        { id: "preview", label: "Preview", category: "Actions" },
        { id: "console", label: "Console", category: "Actions" },
        { id: "settings", label: "Settings", category: "Tools" },
      ];

      const filtered = query 
        ? allCommands.filter(cmd => 
            cmd.label.toLowerCase().includes(query.toLowerCase())
          )
        : allCommands;

      res.json(filtered);
    } catch (error) {
      console.error("Error searching commands:", error);
      res.status(500).json({ error: "Failed to search commands" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
