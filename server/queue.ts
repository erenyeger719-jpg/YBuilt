import { storage } from "./storage";
import fs from "fs/promises";
import path from "path";

// Simple in-memory job queue for mock mode
class JobQueue {
  private processing: Set<string> = new Set();

  async addJob(jobId: string, prompt: string) {
    // Add job to queue and start processing
    if (!this.processing.has(jobId)) {
      this.processing.add(jobId);
      // Update to queued state
      await storage.updateJobStatus(jobId, "queued");
      this.processJob(jobId, prompt).catch(console.error);
    }
  }

  private async processJob(jobId: string, prompt: string) {
    try {
      // Update status to generating
      await storage.updateJobStatus(jobId, "generating");

      // Simulate generation delay (2-4 seconds)
      const delay = 2000 + Math.random() * 2000;
      await new Promise(resolve => setTimeout(resolve, delay));

      // Generate mock HTML based on prompt
      const html = this.generateMockHTML(prompt);

      // Create directory and save HTML
      const previewDir = path.join(process.cwd(), "public", "previews", jobId);
      await fs.mkdir(previewDir, { recursive: true });
      await fs.writeFile(path.join(previewDir, "index.html"), html);

      // Update job status to ready_for_finalization (user can now tweak before editing)
      await storage.updateJobStatus(jobId, "ready_for_finalization", `/previews/${jobId}/index.html`);
    } catch (error) {
      console.error(`Error processing job ${jobId}:`, error);
      // Use updateJob to set error field instead of result
      await storage.updateJob(jobId, {
        status: "failed",
        error: String(error),
      });
    } finally {
      this.processing.delete(jobId);
    }
  }

  private generateMockHTML(prompt: string): string {
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

    return `<!DOCTYPE html>
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
