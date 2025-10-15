// server/vite.ts
import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      // Use __dirname (ESM-safe) instead of import.meta.dirname
      const clientTemplate = path.resolve(__dirname, "..", "client", "index.html");

      // Always reload the index.html file from disk in case it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );

      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

// ESM-safe, defensive static serving for production
export function serveStatic(app: Express) {
  // Prefer the new client build dir; keep fallbacks for older layouts
  const candidates = [
    path.resolve(__dirname, "../client/dist"),
    path.resolve(__dirname, "../dist/public"),
    path.resolve(__dirname, "./public"),
  ];

  const dist = candidates.find((p) => fs.existsSync(path.join(p, "index.html")));

  if (!dist) {
    const msg =
      `[STATIC] No built client found.\n` +
      `Looked in:\n - ${candidates.join("\n - ")}\n` +
      `Did 'npm run build:client' run during deploy?`;

    console.error(msg);

    // Don’t crash the process; show a clear error page instead.
    app.get("*", (_req, res) => res.status(500).send(msg.replace(/\n/g, "<br/>")));
    return;
  }

  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}
