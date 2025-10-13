import { storage } from "./storage";
import fs from "fs/promises";
import path from "path";
import type { RegenerationScope, AIResponse, FileOperation, BuildTrace, BuildStage } from "@shared/schema";
import { hasHighAutonomy } from "@shared/schema";
import { BuildStage as BuildStageEnum } from "@shared/schema";

interface LogEntry {
  timestamp: string;
  level?: "info" | "warn" | "error";
  stage: "GENERATION" | "ASSEMBLY" | "LINT" | "STATIC-BUILD" | "ERROR" | "AGENT";
  source?: string;
  message: string;
  details?: any;
  metadata?: any;
}

// Simple in-memory job queue for mock mode
class JobQueue {
  private processing: Set<string> = new Set();

  async addJob(jobId: string, prompt: string, scope?: RegenerationScope, autonomy?: string) {
    // Add job to queue and start processing
    if (!this.processing.has(jobId)) {
      this.processing.add(jobId);
      // Update to queued state
      await storage.updateJobStatus(jobId, "queued");
      this.processJob(jobId, prompt, scope, autonomy).catch(console.error);
    }
  }

  private async logToFile(jobId: string, entry: LogEntry) {
    const logDir = path.join(process.cwd(), "data", "jobs", jobId);
    await fs.mkdir(logDir, { recursive: true });
    const logFile = path.join(logDir, "logs.jsonl");
    await fs.appendFile(logFile, JSON.stringify(entry) + "\n");
  }

  // Initialize build trace for a job
  private async initBuildTrace(jobId: string): Promise<void> {
    const trace: BuildTrace = {
      jobId,
      currentStage: BuildStageEnum.GENERATION,
      stages: {
        [BuildStageEnum.GENERATION]: { 
          stage: BuildStageEnum.GENERATION, 
          status: "pending", 
          logs: [] 
        },
        [BuildStageEnum.ASSEMBLY]: { 
          stage: BuildStageEnum.ASSEMBLY, 
          status: "pending", 
          logs: [] 
        },
        [BuildStageEnum.LINT]: { 
          stage: BuildStageEnum.LINT, 
          status: "pending", 
          logs: [] 
        },
        [BuildStageEnum.TEST]: { 
          stage: BuildStageEnum.TEST, 
          status: "pending", 
          logs: [] 
        },
        [BuildStageEnum.BUNDLE]: { 
          stage: BuildStageEnum.BUNDLE, 
          status: "pending", 
          logs: [] 
        },
      },
      summaryLog: ""
    };
    
    const tracePath = path.join(process.cwd(), "data", "jobs", jobId, "build-trace.json");
    await fs.mkdir(path.dirname(tracePath), { recursive: true });
    await fs.writeFile(tracePath, JSON.stringify(trace, null, 2));
  }

  // Update stage status
  private async emitStageEvent(jobId: string, stage: BuildStage, status: "pending" | "running" | "success" | "failed"): Promise<void> {
    const tracePath = path.join(process.cwd(), "data", "jobs", jobId, "build-trace.json");
    
    try {
      const data = await fs.readFile(tracePath, "utf-8");
      const trace = JSON.parse(data) as BuildTrace;
      
      trace.currentStage = stage;
      trace.stages[stage].status = status;
      
      if (status === "running") {
        trace.stages[stage].startedAt = new Date().toISOString();
      } else if (status === "success" || status === "failed") {
        trace.stages[stage].completedAt = new Date().toISOString();
      }
      
      await fs.writeFile(tracePath, JSON.stringify(trace, null, 2));
    } catch (error) {
      console.error(`Failed to emit stage event for ${jobId}:`, error);
    }
  }

  // Add log entry to build trace
  private async emitTraceLog(jobId: string, stage: BuildStage, level: "info" | "warn" | "error", message: string, details?: string): Promise<void> {
    const tracePath = path.join(process.cwd(), "data", "jobs", jobId, "build-trace.json");
    
    try {
      const data = await fs.readFile(tracePath, "utf-8");
      const trace = JSON.parse(data) as BuildTrace;
      
      trace.stages[stage].logs.push({
        timestamp: new Date().toISOString(),
        level,
        message,
        details
      });
      
      await fs.writeFile(tracePath, JSON.stringify(trace, null, 2));
    } catch (error) {
      console.error(`Failed to emit trace log for ${jobId}:`, error);
    }
  }

  // Update summary log
  private async updateSummaryLog(jobId: string, summary: string): Promise<void> {
    const tracePath = path.join(process.cwd(), "data", "jobs", jobId, "build-trace.json");
    
    try {
      const data = await fs.readFile(tracePath, "utf-8");
      const trace = JSON.parse(data) as BuildTrace;
      
      trace.summaryLog = summary;
      
      await fs.writeFile(tracePath, JSON.stringify(trace, null, 2));
    } catch (error) {
      console.error(`Failed to update summary log for ${jobId}:`, error);
    }
  }

  // Add artifact to stage
  private async addStageArtifact(jobId: string, stage: BuildStage, label: string, url: string): Promise<void> {
    const tracePath = path.join(process.cwd(), "data", "jobs", jobId, "build-trace.json");
    
    try {
      const data = await fs.readFile(tracePath, "utf-8");
      const trace = JSON.parse(data) as BuildTrace;
      
      if (!trace.stages[stage].artifacts) {
        trace.stages[stage].artifacts = [];
      }
      
      trace.stages[stage].artifacts!.push({ label, url });
      
      await fs.writeFile(tracePath, JSON.stringify(trace, null, 2));
    } catch (error) {
      console.error(`Failed to add artifact for ${jobId}:`, error);
    }
  }

  private async applyFileEdit(
    jobId: string, 
    filePath: string, 
    content: string,
    retries = 3
  ): Promise<{ success: boolean; error?: string }> {
    if (filePath.includes("..") || path.isAbsolute(filePath)) {
      return { success: false, error: "Invalid file path" };
    }

    const basePath = path.join(process.cwd(), "public", "previews", jobId);
    const fullPath = path.resolve(basePath, filePath);
    
    if (!fullPath.startsWith(basePath)) {
      return { success: false, error: "Path traversal detected" };
    }

    for (let i = 0; i < retries; i++) {
      try {
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, content, "utf-8");
        return { success: true };
      } catch (error) {
        if (i === retries - 1) {
          return { success: false, error: String(error) };
        }
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
      }
    }
    return { success: false, error: "Max retries exceeded" };
  }

  private async processJob(jobId: string, prompt: string, scope?: RegenerationScope, autonomy: string = "medium") {
    try {
      // Initialize build trace
      await this.initBuildTrace(jobId);
      
      // Fetch job to get userId
      const job = await storage.getJob(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      // Fetch user settings
      const settings = await storage.getSettings(job.userId);
      
      // Determine if auto-apply should be enabled
      const autoApplyMode = settings.workspace?.autoApplyEdits || "review";
      const agentAutonomy = settings.workspace?.agentAutonomyDefault || autonomy;
      const shouldAutoApply = autoApplyMode === "auto-medium-plus" && hasHighAutonomy(agentAutonomy);

      // STAGE 1: GENERATION
      await this.emitStageEvent(jobId, BuildStageEnum.GENERATION, "running");
      await this.emitTraceLog(jobId, BuildStageEnum.GENERATION, "info", 
        scope ? `Starting ${scope} regeneration` : "Starting AI generation...",
        `Prompt: "${prompt}"`
      );
      
      // Legacy logging for backward compatibility
      await this.logToFile(jobId, {
        timestamp: new Date().toISOString(),
        level: "info",
        stage: "GENERATION",
        source: "worker",
        message: scope ? `Starting ${scope} regeneration` : "Starting generation",
        details: { prompt, scope },
        metadata: { autonomy: agentAutonomy, autoApply: shouldAutoApply }
      });

      // Update status to generating
      await storage.updateJobStatus(jobId, "generating");

      // Simulate generation delay (1-2 seconds)
      const genDelay = 1000 + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, genDelay));

      // Generate mock AI response with file operations
      const aiResponse = this.generateMockHTML(prompt);

      await this.emitTraceLog(jobId, BuildStageEnum.GENERATION, "info", "AI generation complete");
      await this.emitStageEvent(jobId, BuildStageEnum.GENERATION, "success");

      // STAGE 2: ASSEMBLY
      await this.emitStageEvent(jobId, BuildStageEnum.ASSEMBLY, "running");
      await this.emitTraceLog(jobId, BuildStageEnum.ASSEMBLY, "info", "Assembling files and components...");

      await this.logToFile(jobId, {
        timestamp: new Date().toISOString(),
        level: "info",
        stage: "ASSEMBLY",
        source: "worker",
        message: "Assembling components",
      });

      // Check if auto-apply is enabled and we have file operations
      if (shouldAutoApply && aiResponse.operations && aiResponse.operations.length > 0) {
        await storage.updateJob(jobId, { status: "applying_edits" });
        
        await this.emitTraceLog(jobId, BuildStageEnum.ASSEMBLY, "info", 
          `Auto-applying ${aiResponse.operations.length} file operations`
        );

        const results = [];
        for (const op of aiResponse.operations) {
          const result = await this.applyFileEdit(jobId, op.path, op.content);
          results.push({ path: op.path, ...result });
          
          const logMessage = result.success 
            ? `Applied ${op.kind} operation to ${op.path}`
            : `Failed to apply ${op.kind} operation to ${op.path}`;
          
          await this.emitTraceLog(jobId, BuildStageEnum.ASSEMBLY, result.success ? "info" : "error", logMessage);
          
          await this.logToFile(jobId, {
            timestamp: new Date().toISOString(),
            level: result.success ? "info" : "error",
            stage: "ASSEMBLY",
            source: "worker",
            message: logMessage,
            details: { path: op.path, kind: op.kind, success: result.success, error: result.error }
          });
        }

        const hasFailures = results.some(r => !r.success);
        const successCount = results.filter(r => r.success).length;
        
        if (hasFailures) {
          await this.emitTraceLog(jobId, BuildStageEnum.ASSEMBLY, "warn", 
            `Auto-apply complete: ${successCount}/${results.length} operations succeeded`
          );
        } else {
          await this.emitTraceLog(jobId, BuildStageEnum.ASSEMBLY, "info", 
            `All ${successCount} file operations applied successfully`
          );
        }
      } else {
        // Original flow - just save preview HTML
        const previewDir = path.join(process.cwd(), "public", "previews", jobId);
        await fs.mkdir(previewDir, { recursive: true });
        await fs.writeFile(path.join(previewDir, "index.html"), aiResponse.html);
        
        await this.emitTraceLog(jobId, BuildStageEnum.ASSEMBLY, "info", "Preview HTML generated");
      }

      await this.emitStageEvent(jobId, BuildStageEnum.ASSEMBLY, "success");
      await this.addStageArtifact(jobId, BuildStageEnum.ASSEMBLY, "Preview HTML", `/previews/${jobId}/index.html`);

      // STAGE 3: LINT
      await this.emitStageEvent(jobId, BuildStageEnum.LINT, "running");
      await this.emitTraceLog(jobId, BuildStageEnum.LINT, "info", "Running code quality checks...");

      await this.logToFile(jobId, {
        timestamp: new Date().toISOString(),
        level: "info",
        stage: "LINT",
        source: "worker",
        message: "Running linting checks",
      });

      // Basic HTML validation
      await new Promise(resolve => setTimeout(resolve, 300));
      await this.emitTraceLog(jobId, BuildStageEnum.LINT, "info", "HTML structure validated");
      await this.emitTraceLog(jobId, BuildStageEnum.LINT, "info", "CSS syntax checked");
      await this.emitStageEvent(jobId, BuildStageEnum.LINT, "success");

      // STAGE 4: TEST
      await this.emitStageEvent(jobId, BuildStageEnum.TEST, "running");
      await this.emitTraceLog(jobId, BuildStageEnum.TEST, "info", "Running basic tests...");

      await new Promise(resolve => setTimeout(resolve, 400));
      await this.emitTraceLog(jobId, BuildStageEnum.TEST, "info", "Responsive design check: passed");
      await this.emitTraceLog(jobId, BuildStageEnum.TEST, "info", "Accessibility validation: passed");
      
      if (agentAutonomy === "max") {
        await this.emitTraceLog(jobId, BuildStageEnum.TEST, "info", "Running extended test suite...");
        await this.logToFile(jobId, {
          timestamp: new Date().toISOString(),
          level: "info",
          stage: "AGENT",
          source: "agent",
          message: "Running test suite...",
          metadata: { autonomy: agentAutonomy, testsRun: 5, testsPassed: 5 }
        });
      }
      
      await this.emitStageEvent(jobId, BuildStageEnum.TEST, "success");

      // STAGE 5: BUNDLE
      await this.emitStageEvent(jobId, BuildStageEnum.BUNDLE, "running");
      await this.emitTraceLog(jobId, BuildStageEnum.BUNDLE, "info", "Finalizing bundle...");

      await this.logToFile(jobId, {
        timestamp: new Date().toISOString(),
        level: "info",
        stage: "STATIC-BUILD",
        source: "worker",
        message: "Build complete",
        details: { outputPath: `/previews/${jobId}/index.html` }
      });

      await new Promise(resolve => setTimeout(resolve, 300));
      await this.emitTraceLog(jobId, BuildStageEnum.BUNDLE, "info", "Assets optimized");
      await this.emitTraceLog(jobId, BuildStageEnum.BUNDLE, "info", "Bundle complete");
      await this.emitStageEvent(jobId, BuildStageEnum.BUNDLE, "success");
      await this.addStageArtifact(jobId, BuildStageEnum.BUNDLE, "Final Build", `/previews/${jobId}/index.html`);

      // Update summary log
      const summaryLines = [
        `Build completed successfully for job ${jobId}`,
        `Generated from prompt: "${prompt.substring(0, 60)}${prompt.length > 60 ? '...' : ''}"`,
        `All 5 stages passed: GENERATION → ASSEMBLY → LINT → TEST → BUNDLE`,
        `Preview available at: /previews/${jobId}/index.html`
      ];
      await this.updateSummaryLog(jobId, summaryLines.join('\n'));

      // Update job status to ready_for_finalization
      await storage.updateJobStatus(jobId, "ready_for_finalization", `/previews/${jobId}/index.html`);
    } catch (error) {
      console.error(`Error processing job ${jobId}:`, error);
      
      // Mark current stage as failed
      try {
        const tracePath = path.join(process.cwd(), "data", "jobs", jobId, "build-trace.json");
        const data = await fs.readFile(tracePath, "utf-8");
        const trace = JSON.parse(data) as BuildTrace;
        
        await this.emitStageEvent(jobId, trace.currentStage, "failed");
        await this.emitTraceLog(jobId, trace.currentStage, "error", `Build failed: ${error}`);
        
        await this.updateSummaryLog(jobId, `Build failed at stage ${trace.currentStage}: ${String(error)}`);
      } catch (traceError) {
        console.error("Failed to update trace on error:", traceError);
      }
      
      await this.logToFile(jobId, {
        timestamp: new Date().toISOString(),
        level: "error",
        stage: "ERROR",
        source: "worker",
        message: `Build failed: ${error}`,
        details: { error: String(error) }
      });

      await storage.updateJob(jobId, {
        status: "failed",
        error: String(error),
      });
    } finally {
      this.processing.delete(jobId);
    }
  }

  private generateMockHTML(prompt: string): AIResponse {
    // Simple mock HTML generator based on prompt keywords
    const lowercasePrompt = prompt.toLowerCase();
    
    let template = "modern";
    let title = "AI Generated Site";
    let bgColor = "#0a0a0a";
    let textColor = "#ffffff";

    if (lowercasePrompt.includes("portfolio")) {
      template = "portfolio";
      title = "Portfolio Site";
    } else if (lowercasePrompt.includes("blog")) {
      template = "blog";
      title = "Blog Platform";
      bgColor = "#fafafa";
      textColor = "#000000";
    } else if (lowercasePrompt.includes("ecommerce") || lowercasePrompt.includes("store") || lowercasePrompt.includes("shop")) {
      template = "ecommerce";
      title = "Online Store";
      bgColor = "#ffffff";
      textColor = "#000000";
    } else if (lowercasePrompt.includes("landing")) {
      template = "landing";
      title = "Landing Page";
      bgColor = "#ffffff";
      textColor = "#000000";
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
      background: ${bgColor}; 
      color: ${textColor}; 
    }
    header { 
      padding: 2rem; 
      border-bottom: 1px solid ${textColor === '#ffffff' ? '#222' : '#ddd'}; 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
    }
    .hero { 
      padding: 6rem 2rem; 
      text-align: center; 
      min-height: 60vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    h1 { 
      font-size: clamp(2rem, 5vw, 4rem); 
      margin-bottom: 1rem; 
      background: linear-gradient(to right, ${textColor}, ${textColor === '#ffffff' ? '#888' : '#666'}); 
      -webkit-background-clip: text; 
      background-clip: text; 
      -webkit-text-fill-color: transparent; 
    }
    p { opacity: 0.8; font-size: 1.2rem; line-height: 1.6; }
    .cta { 
      background: ${textColor === '#ffffff' ? '#fff' : '#000'}; 
      color: ${textColor === '#ffffff' ? '#000' : '#fff'}; 
      padding: 1rem 2rem; 
      border-radius: 8px; 
      text-decoration: none; 
      display: inline-block; 
      margin-top: 2rem;
      font-weight: 600;
    }
    .badge {
      display: inline-block;
      background: ${textColor === '#ffffff' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }
  </style>
</head>
<body>
  <header>
    <div style="font-weight: bold; font-size: 1.25rem;">${title}</div>
    <nav>Menu</nav>
  </header>
  <div class="hero">
    <div class="badge">✨ AI Generated with ybuilt</div>
    <h1>${this.generateHeadline(template, prompt)}</h1>
    <p>${this.generateTagline(template, prompt)}</p>
    <a href="#" class="cta">Get Started</a>
  </div>
</body>
</html>`;

    const operations: FileOperation[] = [
      { 
        path: "index.html", 
        kind: "replace", 
        content: html 
      }
    ];

    return {
      html,
      operations
    };
  }

  private generateHeadline(template: string, prompt: string): string {
    const headlines: Record<string, string> = {
      portfolio: "Creative Developer & Designer",
      blog: "Stories Worth Reading",
      ecommerce: "Discover Amazing Products",
      landing: "Transform Your Business",
      modern: "Welcome to the Future"
    };
    return headlines[template] || "AI Generated Website";
  }

  private generateTagline(template: string, prompt: string): string {
    const taglines: Record<string, string> = {
      portfolio: "Crafting digital experiences that inspire and engage",
      blog: "Insights, tutorials, and thoughts on modern technology",
      ecommerce: "Quality products delivered to your doorstep",
      landing: "Join thousands of satisfied customers today",
      modern: "Built with AI, designed for you"
    };
    return taglines[template] || `Generated from: "${prompt}"`;
  }
}

export const jobQueue = new JobQueue();
