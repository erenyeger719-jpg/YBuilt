import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import crypto from "crypto";
import type { ExecRequest, ExecResult, ExecFile } from "../execute/types.ts";

const HARD_TIMEOUT = 10_000; // ms
const STDIO_CAP = 64 * 1024; // 64KB
const BIN = process.env.RUNNER_BIN || "docker";

// Policy guard (on by default; disable with RUNNER_POLICY_STRICT=false)
const STRICT = String(process.env.RUNNER_POLICY_STRICT || "true") === "true";

const NODE_PRELUDE = `;(function(){
  try {
    const denied = new Set([
      'child_process','cluster','worker_threads','inspector','vm','v8','async_hooks',
      'dns','net','tls','dgram','http','https','http2'
    ]);
    const Module = require('module');
    const orig = Module.prototype.require;
    Module.prototype.require = function(name) {
      if (denied.has(name) || Array.from(denied).some(d => name === d || name.startsWith(d + '/'))) {
        throw new Error('Module "' + name + '" is blocked by policy');
      }
      return orig.apply(this, arguments);
    };
  } catch {}
})();\n`;

const PY_PRELUDE = `# policy prelude
import builtins
_denied = {
  'subprocess','socket','ssl','ctypes','multiprocessing','resource','pty','fcntl','select',
}
_real_import = builtins.__import__
def _guarded_import(name, *args, **kwargs):
    if name in _denied or any(name.startswith(m + '.') for m in _denied):
        raise ImportError(f'import of {name} is blocked by policy')
    return _real_import(name, *args, **kwargs)
builtins.__import__ = _guarded_import
`;

function tmpDir() {
  return path.join(os.tmpdir(), "ybuilt-run-" + crypto.randomBytes(6).toString("hex"));
}

function truncate(buf: Buffer): string {
  if (buf.length <= STDIO_CAP) return buf.toString("utf8");
  return Buffer.concat([buf.subarray(0, STDIO_CAP), Buffer.from("\n…[truncated]\n")]).toString(
    "utf8",
  );
}

async function writeFiles(root: string, mainName: string, code: string, files?: ExecFile[]) {
  await fs.promises.mkdir(root, { recursive: true });
  await fs.promises.writeFile(path.join(root, mainName), code, "utf8");
  if (files && Array.isArray(files)) {
    for (const f of files) {
      const full = path.join(root, f.path);
      const dir = path.dirname(full);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(full, f.content, "utf8");
    }
  }
}

export async function runDockerSandbox(req: ExecRequest): Promise<ExecResult> {
  const started = Date.now();
  const imageNode = process.env.RUNNER_IMAGE_NODE || "node:20-alpine";
  const imagePy = process.env.RUNNER_IMAGE_PYTHON || "python:3.11-alpine";

  const t = Math.max(100, Math.min(Number(req.timeoutMs ?? 1500), HARD_TIMEOUT));

  const dir = tmpDir();
  const name = "ybuilt-" + crypto.randomBytes(6).toString("hex");
  const isNode = req.lang === "node";

  const main = isNode ? "main.js" : "main.py";

  // prepend language-specific policy prelude if strict
  const userCode = String(req.code || "");
  const codeWithPrelude = isNode
    ? STRICT
      ? NODE_PRELUDE + userCode
      : userCode
    : STRICT
    ? PY_PRELUDE + "\n" + userCode
    : userCode;

  await writeFiles(dir, main, codeWithPrelude, req.files);

  const image = isNode ? imageNode : imagePy;
  const cmd = isNode ? "node" : "python";
  // -B to avoid .pyc on read-only mounts, -u unbuffered
  const args = isNode ? [main] : ["-u", "-B", main];

  // Pass user-provided args to the script
  const scriptArgs = req.args && Array.isArray(req.args) ? req.args : [];

  // Build docker run args
  const runArgs = [
    "run",
    "--rm",
    "--name",
    name,
    "--network",
    "none",
    "--cpus",
    "0.5",
    "--memory",
    "256m",
    "--pids-limit",
    "64",
    "--read-only",
    "--tmpfs",
    "/tmp:rw,size=64m",
    "--security-opt",
    "no-new-privileges",
    "--cap-drop",
    "ALL",
    "--user",
    "1000:1000",
    "-v",
    `${dir}:/workspace:ro`,
    "-w",
    "/workspace",
    image,
    cmd,
    ...args,
    ...scriptArgs,
  ];

  // Optional platform hint (e.g. linux/amd64 for Apple Silicon)
  const platform = process.env.RUNNER_PLATFORM;
  if (platform) runArgs.splice(1, 0, "--platform", platform); // insert after "run"

  let stdout = Buffer.alloc(0);
  let stderr = Buffer.alloc(0);

  return await new Promise<ExecResult>((resolve) => {
    const child = spawn(BIN, runArgs, { stdio: ["ignore", "pipe", "pipe"] });

    let killedForTimeout = false;
    const timer = setTimeout(() => {
      killedForTimeout = true;
      // best-effort kill + rely on --rm
      spawn(BIN, ["rm", "-f", name]);
    }, t);

    child.stdout?.on("data", (chunk) => {
      if (stdout.length < STDIO_CAP) stdout = Buffer.concat([stdout, chunk]);
    });
    child.stderr?.on("data", (chunk) => {
      if (stderr.length < STDIO_CAP) stderr = Buffer.concat([stderr, chunk]);
    });

    child.on("error", async (e: any) => {
      clearTimeout(timer);
      // Cleanup local tmp
      fs.rm(dir, { recursive: true, force: true }, () => {});
      const msg = e?.code === "ENOENT" ? "docker_unavailable" : "spawn_error";
      resolve({
        ok: false,
        reason: msg,
        durationMs: Date.now() - started,
      });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      // Cleanup local tmp
      fs.rm(dir, { recursive: true, force: true }, () => {});

      if (killedForTimeout) {
        resolve({
          ok: false,
          reason: "timeout",
          stdout: truncate(stdout),
          stderr: truncate(stderr),
          exitCode: null as any,
          durationMs: Date.now() - started,
        });
        return;
      }

      resolve({
        ok: code === 0,
        stdout: truncate(stdout),
        stderr: truncate(stderr),
        exitCode: code ?? -1,
        durationMs: Date.now() - started,
      });
    });
  });
}
