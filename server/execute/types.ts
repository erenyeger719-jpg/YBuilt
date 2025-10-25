export type ExecLang = "node" | "python";

export type ExecFile = {
  path: string;      // e.g., "main.py" or "src/app.js"
  content: string;   // raw text
};

export type ExecRequest = {
  lang: ExecLang;
  code: string;
  args?: string[];
  files?: ExecFile[];
  timeoutMs?: number; // requested cap (we'll clamp)
};

export type ExecResult = {
  ok: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  durationMs: number;
  reason?: string; // e.g., "disabled", "validation"
};
