import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { jobQueue } from "./queue";
import { insertJobSchema } from "@shared/schema";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

export async function registerRoutes(app: Express): Promise<Server> {
  // Job generation endpoint
  app.post("/api/generate", async (req, res) => {
    try {
      const validation = insertJobSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid prompt" });
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
        status: job.status,
        result: job.result,
        createdAt: job.createdAt,
      });
    } catch (error) {
      console.error("Error fetching job:", error);
      res.status(500).json({ error: "Failed to fetch job" });
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

  const httpServer = createServer(app);

  return httpServer;
}
