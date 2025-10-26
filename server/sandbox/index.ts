// server/sandbox/index.ts
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import type { ExecRequest, ExecFile } from "../execute/types.ts";

type RunResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode?: number;
  durationMs: number;
  reason?: string;
};

const RUNNER_IMPL = (process.env.RUNNER_IMPL || "docker").toLowerCase();
const RUNNER_BIN = process.env.RUNNER_BIN || "docker"; // or "podman"
const RUNNER_CPUS = process.env.RUNNER_CPUS || "1";
const RUNNER_MEMORY = process.env.RUNNER_MEMORY || "512m";
const RUNNER_PIDS = process.env.RUNNER_PIDS || "128";
const RUNNER_PLATFORM = process.env.RUNNER_PLATFORM || ""; // e.g. "linux/arm64"
const NODE_IMAGE = process.env.NODE_IMAGE || "node:20-alpine";
const PY_IMAGE = process.env.PY_IMAGE || "python:3.11-alpine";

// Per-language ALLOW lists (block everything else, incl. npm/pip)
const NODE_ALLOW = (process.env.NODE_ALLOW || "path,url,buffer,util,events,crypto")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const PY_ALLOW = (process.env.PY_ALLOW || "math,random,re,json,datetime,statistics")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// keep a minimal env for local fallback (no secrets)
const SAFE_ENV_KEYS = new Set([
  "PATH",
  "HOME",
  "LANG",
  "LC_ALL",
  "PYTHONIOENCODING",
  "NODE_NO_WARNINGS",
]);
function safeEnv(): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const k of Object.keys(process.env)) {
    if (SAFE_ENV_KEYS.has(k)) out[k] = process.env[k]!;
  }
  // make stdout consistent
  out.PYTHONIOENCODING = out.PYTHONIOENCODING || "utf-8";
  return out;
}

// --- tiny utils ---
function safePath(p: string) {
  return /^[a-z0-9/_\-.]+$/i.test(p) && !p.includes("..");
}
function mkTmpDir(prefix = "ybuilt-"): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
function rmDir(dir: string) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}
function writeFiles(root: string, files: ExecFile[] = []) {
  for (const f of files) {
    const fp = path.join(root, f.path);
    if (!safePath(f.path)) throw new Error("bad file path");
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, f.content, "utf8");
  }
}

// --- policy preludes ---
function nodePrelude(allow: string[]) {
  // Lock require() to allowlist + disallow relative paths & external packages
  return `
const __ALLOW = new Set(${JSON.stringify(allow)});
const Module = require('module');
const __origRequire = Module.prototype.require;
Module.prototype.require = function(name){
  name = String(name || '');
  if (name.startsWith('node:')) name = name.slice(5);
  if (name.startsWith('.') || name.startsWith('/') ) {
    throw new Error('Module "'+ name +'" is blocked by policy');
  }
  if (__ALLOW.has(name)) return __origRequire.apply(this, arguments);
  throw new Error('Module "'+ name +'" is blocked by policy');
};
// 🆕 Block Node 18+/20+ global fetch in local mode
try { globalThis.fetch = (..._) => { throw new Error('network blocked by policy'); }; } catch {}
`.trimStart();
}

function pythonPrelude(allow: string[]) {
  // Guard imports to allowlist
  return `
import builtins as __bi
__ALLOW = set(${JSON.stringify(allow)})
__real_import = __bi.__import__
def __guarded_import(name, *args, **kwargs):
    root = (name or "").split(".")[0]
    if root in __ALLOW:
        return __real_import(name, *args, **kwargs)
    raise ImportError(f"import of {name} is blocked by policy")
__bi.__import__ = __guarded_import
`.trimStart();
}

// --- docker args (strict) ---
function dockerArgs(image: string, mountDir: string) {
  const args = [
    "run",
    "--rm",
    "--network",
    "none",
    "--cpus",
    RUNNER_CPUS,
    "--memory",
    RUNNER_MEMORY,
    "--pids-limit",
    RUNNER_PIDS,
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--read-only",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,nodev,size=64m",
    "-u",
    "1000:1000",
    "-w",
    "/workspace",
    "-v",
    `${mountDir}:/workspace:ro`,
  ];
  if (RUNNER_PLATFORM) args.unshift("--platform", RUNNER_PLATFORM);
  args.push(image);
  return args;
}

// --- core runner ---
export async function runSandbox(req: ExecRequest): Promise<RunResult> {
  // shape guard (route already validated; keep light)
  const lang = req.lang === "python" ? "python" : "node";
  const timeoutMs = Math.max(100, Math.min(Number(req.timeoutMs ?? 1500), 10_000));
  const args = Array.isArray(req.args) ? req.args.slice(0, 16) : [];
  const files = Array.isArray(req.files) ? req.files : [];

  const dir = mkTmpDir();
  try {
    // write files
    writeFiles(dir, files);

    // prepend policy prelude
    let entry: string;
    if (lang === "node") {
      entry = path.join(dir, "main.js");
      fs.writeFileSync(entry, nodePrelude(NODE_ALLOW) + "\n" + String(req.code || ""), "utf8");
    } else {
      entry = path.join(dir, "main.py");
      fs.writeFileSync(entry, pythonPrelude(PY_ALLOW) + "\n" + String(req.code || ""), "utf8");
    }

    if (RUNNER_IMPL !== "docker") {
      const cmdLocal = lang === "node" ? "node" : process.env.PY_LOCAL || "python3";
      let res = await spawnRun(cmdLocal, [entry, ...args], {
        cwd: dir,
        timeoutMs,
        env: safeEnv(),
      });
      if (
        !res.ok &&
        res.reason === "spawn_error" &&
        /ENOENT/i.test(res.stderr) &&
        lang === "python"
      ) {
        res = await spawnRun("python", [entry, ...args], {
          cwd: dir,
          timeoutMs,
          env: safeEnv(),
        });
      }
      return res;
    }

    // Try Docker first; fallback if daemon unavailable
    {
      const image = lang === "node" ? NODE_IMAGE : PY_IMAGE;
      const base = dockerArgs(image, dir);
      const cmd =
        lang === "node"
          ? ["node", "/workspace/main.js", ...args]
          : ["python", "/workspace/main.py", ...args];

      const res = await spawnRun(RUNNER_BIN, [...base, ...cmd], { cwd: dir, timeoutMs });
      if (
        !res.ok &&
        (res.exitCode === 125 ||
          /Cannot connect to the Docker daemon/i.test(res.stderr))
      ) {
        const cmdLocal = lang === "node" ? "node" : process.env.PY_LOCAL || "python3";
        let fallback = await spawnRun(cmdLocal, [entry, ...args], {
          cwd: dir,
          timeoutMs,
          env: safeEnv(),
        });
        if (
          !fallback.ok &&
          fallback.reason === "spawn_error" &&
          /ENOENT/i.test(fallback.stderr) &&
          lang === "python"
        ) {
          fallback = await spawnRun("python", [entry, ...args], {
            cwd: dir,
            timeoutMs,
            env: safeEnv(),
          });
        }
        return fallback;
      }
      return res;
    }
  } finally {
    rmDir(dir);
  }
}

function spawnRun(
  cmd: string,
  argv: string[],
  opts: { cwd: string; timeoutMs: number; env?: NodeJS.ProcessEnv },
): Promise<RunResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    const t0 = Date.now();

    const child = spawn(cmd, argv, {
      cwd: opts.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: opts.env || { ...process.env }, // use provided env or inherit
    });

    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      try {
        child.kill("SIGKILL");
      } catch {}
    }, opts.timeoutMs);

    child.stdout.on("data", (c) => (stdout += c.toString()));
    child.stderr.on("data", (c) => (stderr += c.toString()));

    child.on("close", (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - t0;
      if (killed) {
        return resolve({
          ok: false,
          stdout,
          stderr,
          exitCode: code ?? undefined,
          durationMs,
          reason: "timeout",
        });
      }
      const ok = code === 0 && !stderr;
      resolve({
        ok,
        stdout,
        stderr,
        exitCode: code ?? undefined,
        durationMs,
        reason: ok ? undefined : "nonzero_exit",
      });
    });

    child.on("error", (err: any) => {
      clearTimeout(timer);
      const durationMs = Date.now() - t0;
      resolve({
        ok: false,
        stdout,
        stderr: String(err?.message || err),
        durationMs,
        reason: "spawn_error",
      });
    });
  });
}
