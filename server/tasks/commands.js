// server/tasks/commands.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.resolve(process.cwd()); // repo root
const clientSrc = (...p) => path.join(rootDir, "client", "src", ...p);
const serverDir = (...p) => path.join(rootDir, "server", ...p);

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}
function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}
function writeFileSafe(p, contents, { overwrite = false } = {}) {
  if (!overwrite && exists(p)) throw new Error(`File exists: ${path.relative(rootDir, p)}`);
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, contents);
  return p;
}
function pascalCase(s) {
  return s.replace(/[^a-zA-Z0-9]+/g, " ")
          .split(" ")
          .filter(Boolean)
          .map(w => w[0].toUpperCase() + w.slice(1))
          .join("");
}
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** ---------- Commands ---------- **/

// 1) Create Page (React)
export function createPage({ name }) {
  if (!name) throw new Error("name required");
  const C = pascalCase(name);
  const file = clientSrc("pages", `${C}.tsx`);
  const contents = `import React from "react";

export default function ${C}() {
  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold">${C}</h1>
      <p className="text-sm text-zinc-600 mt-2">Scaffolded by Command Palette.</p>
    </div>
  );
}
`;
  writeFileSafe(file, contents);
  return { created: [file], hint: `/` };
}

// 2) Create Component
export function createComponent({ name }) {
  if (!name) throw new Error("name required");
  const C = pascalCase(name);
  const file = clientSrc("components", `${C}.tsx`);
  const contents = `import React from "react";

type Props = { className?: string };

export default function ${C}({ className }: Props) {
  return <div className={className}>${C} component</div>;
}
`;
  writeFileSafe(file, contents);
  return { created: [file] };
}

// 3) Create API Route (Express)
export function createApiRoute({ name }) {
  if (!name) throw new Error("name required");
  const id = slugify(name);
  const file = serverDir("routes", `${id}.js`);
  const contents = `import express from "express";
const router = express.Router();

// GET /api/${id}
router.get("/", (_req, res) => {
  res.json({ ok: true, route: "/api/${id}" });
});

export default router;
`;
  writeFileSafe(file, contents);
  return { created: [file], mountPath: `/api/${id}` };
}

// 4) Inject Route into client/src/App.tsx (Wouter)
export function addRouteToApp({ pageName, routePath }) {
  if (!pageName || !routePath) throw new Error("pageName & routePath required");
  const C = pascalCase(pageName);
  const appFile = clientSrc("App.tsx");
  if (!exists(appFile)) throw new Error("client/src/App.tsx not found");

  let src = fs.readFileSync(appFile, "utf8");

  // Import line — add if missing
  const importLine = `import ${C} from "@/pages/${C}";`;
  if (!src.includes(importLine)) {
    src = src.replace(/(import .+;\s*\n)+/m, (m) => m + importLine + "\n");
  }

  // Route line — insert before the NotFound catch-all route
  const routeLine = `      <Route path="${routePath}" component={${C}} />\n`;
  if (!src.includes(routeLine)) {
    src = src.replace(
      /(\{\s*\/\*\s*Fallback.*\*\/\s*\}\s*<Route>)/m,
      routeLine + "$1"
    );
  }

  fs.writeFileSync(appFile, src);
  return { modified: [appFile] };
}

export const COMMANDS = [
  { id: "create_page", label: "Create Page", params: [{ key: "name", placeholder: "About" }] },
  { id: "create_component", label: "Create Component", params: [{ key: "name", placeholder: "Navbar" }] },
  { id: "create_api_route", label: "Create API Route", params: [{ key: "name", placeholder: "status" }] },
  { id: "add_route_to_app", label: "Add Route to App", params: [
    { key: "pageName", placeholder: "About" },
    { key: "routePath", placeholder: "/about" },
  ]},
];

export function runCommand({ cmd, params }) {
  switch (cmd) {
    case "create_page": return createPage(params || {});
    case "create_component": return createComponent(params || {});
    case "create_api_route": return createApiRoute(params || {});
    case "add_route_to_app": return addRouteToApp(params || {});
    default: throw new Error("unknown command");
  }
}
