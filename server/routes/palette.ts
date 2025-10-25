// server/routes/palette.ts
import { Router } from "express";

const router = Router();

// Minimal, safe list — the client will call the target APIs directly.
const COMMANDS = [
  {
    id: "previews:fork",
    label: "Fork template",
    method: "POST",
    path: "/api/previews/fork",
    params: { sourceId: "string" },
  },
  {
    id: "previews:export",
    label: "Export ZIP",
    method: "POST",
    path: "/api/previews/export",
    params: { slug: "string" },
  },
  {
    id: "execute:node",
    label: "Run Node snippet",
    method: "POST",
    path: "/api/execute/run",
    body: { lang: "node", code: "string" },
  },
  {
    id: "execute:python",
    label: "Run Python snippet",
    method: "POST",
    path: "/api/execute/run",
    body: { lang: "python", code: "string" },
  },
  {
    id: "deploy:netlify",
    label: "Deploy (Netlify)",
    method: "POST",
    path: "/api/deploy/netlify",
    params: { siteId: "string" },
  },
  {
    id: "deploy:vercel",
    label: "Deploy (Vercel)",
    method: "POST",
    path: "/api/deploy/vercel",
    params: { projectId: "string" },
  },
  {
    id: "logs:open",
    label: "Open Logs Panel",
    kind: "client", // client-side action (no API call)
  },
];

router.get("/commands", (_req, res) => {
  res.json({ ok: true, items: COMMANDS });
});

export default router;
