import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import crypto from "crypto";
import type { ExecRequest, ExecResult, ExecFile } from "../execute/types.ts";

const HARD_TIMEOUT = 10_000; // ms
const STDIO_CAP = 64 * 1024; // 64KB
const BIN = process.env.RUNNER_BIN || "docker";

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
  await writeFiles(dir, main, req.code, req.files);

  const image = isNode ? imageNode : imagePy;
  const cmd = isNode ? "node" : "python";
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
