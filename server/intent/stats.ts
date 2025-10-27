// server/intent/stats.ts
import fs from "fs";
import path from "path";

const DB = path.resolve(".cache", "router.stats.json");

type Arm = "rules" | "local" | "cloud";
type ArmStats = {
  arm: Arm;
  // Beta prior for success rate (success ~= “shipped with low edits + under budget”)
  a: number; // successes + 1
  b: number; // failures + 1
  // rolling means (for reporting/analysis)
  ema_ms?: number;
  ema_cents?: number;
  ema_tokens?: number;
  n?: number;
};

type Stats = Record<Arm, ArmStats>;

function ensure() {
  const dir = path.dirname(DB);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB)) {
    const init: Stats = {
      rules: { arm: "rules", a: 3, b: 1, n: 0 },
      local: { arm: "local", a: 2, b: 2, n: 0 },
      cloud: { arm: "cloud", a: 1, b: 3, n: 0 },
    };
    fs.writeFileSync(DB, JSON.stringify(init, null, 2));
  }
}

function load(): Stats {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(DB, "utf8"));
  } catch {
    return {
      rules: { arm: "rules", a: 3, b: 1 },
      local: { arm: "local", a: 2, b: 2 },
      cloud: { arm: "cloud", a: 1, b: 3 },
    } as Stats;
  }
}

function save(s: Stats) {
  ensure();
  fs.writeFileSync(DB, JSON.stringify(s, null, 2));
}

// Thompson sample ~ Beta(a,b)
function betaSample(a: number, b: number) {
  // quick + dirty: inverse transform via Gamma
  function gamma(k: number) {
    // Marsaglia-Tsang for k>1; fallback for small k
    const d = k - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    while (true) {
      let x = 0;
      let v = 0;
      // Box-Muller
      const u1 = Math.random() || 1e-9;
      const u2 = Math.random() || 1e-9;
      x = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      v = Math.pow(1 + c * x, 3);
      if (v > 0) {
        const u3 = Math.random() || 1e-9;
        if (Math.log(u3) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
          return d * v;
        }
      }
    }
  }
  const x = gamma(a);
  const y = gamma(b);
  return x / (x + y);
}

// Weighted score: success_sample − λ1*ms − λ2*cents − λ3*tokens
function scoreArm(sample: number, ema_ms?: number, ema_cents?: number, ema_tokens?: number) {
  const ms = (ema_ms ?? 400) / 1000; // seconds
  const cents = ema_cents ?? 0.1; // default small
  const toks = (ema_tokens ?? 500) / 1000; // per-1k
  const λ1 = 0.3,
    λ2 = 0.4,
    λ3 = 0.1; // tweak as you like
  return sample - (λ1 * ms + λ2 * cents + λ3 * toks);
}

export function pickArm(): Arm {
  const s = load();
  const candidates: Arm[] = ["rules", "local", "cloud"];
  let best: { arm: Arm; val: number } | null = null;
  for (const arm of candidates) {
    const st = s[arm] || ({} as ArmStats);
    const draw = betaSample(Math.max(st.a ?? 1, 0.5), Math.max(st.b ?? 1, 0.5));
    const val = scoreArm(draw, st.ema_ms, st.ema_cents, st.ema_tokens);
    if (!best || val > best.val) best = { arm, val };
  }
  return best!.arm;
}

function ema(prev: number | undefined, x: number, α = 0.25) {
  return prev == null ? x : (1 - α) * prev + α * x;
}

export function recordOutcome(
  arm: Arm,
  outcome: {
    success: boolean;
    ms?: number; // wall time
    cents?: number; // cloud cost
    tokens?: number; // cloud tokens used
  }
) {
  const s = load();
  const st = (s[arm] || { arm, a: 1, b: 1, n: 0 }) as ArmStats;
  st.a += outcome.success ? 1 : 0;
  st.b += outcome.success ? 0 : 1;
  st.n = (st.n || 0) + 1;
  if (outcome.ms != null) st.ema_ms = ema(st.ema_ms, outcome.ms);
  if (outcome.cents != null) st.ema_cents = ema(st.ema_cents, outcome.cents);
  if (outcome.tokens != null) st.ema_tokens = ema(st.ema_tokens, outcome.tokens);
  s[arm] = st as ArmStats;
  save(s);
}

// simple budget guard used by router
export function underBudget({
  cents = 0,
  maxCents = 0.5,
  tokens = 0,
  maxTokens = 4000,
}) {
  return cents <= maxCents && tokens <= maxTokens;
}

// --- expert-level stats (per model per task) ---
const EX_DB = path.resolve(".cache", "experts.stats.json");

type ExStats = {
  a: number;
  b: number;
  ema_ms?: number;
  ema_cents?: number;
  ema_tokens?: number;
  n?: number;
};
type ExAll = Record<string, ExStats>;

function exEnsure() {
  const dir = path.dirname(EX_DB);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(EX_DB)) fs.writeFileSync(EX_DB, JSON.stringify({}, null, 2));
}
function exLoad(): ExAll {
  exEnsure();
  try {
    return JSON.parse(fs.readFileSync(EX_DB, "utf8"));
  } catch {
    return {};
  }
}
function exSave(s: ExAll) {
  exEnsure();
  fs.writeFileSync(EX_DB, JSON.stringify(s, null, 2));
}

function exBetaSample(a: number, b: number) {
  // reuse gamma sampler from betaSample above if you prefer; quick safe fallback:
  const u = Math.random() || 1e-9;
  // simple approx; we already use score penalties too
  return Math.pow(u, 1 / a) / (Math.pow(u, 1 / a) + Math.pow(1 - u, 1 / b));
}

function exScore(sample: number, ema_ms?: number, ema_cents?: number, ema_tokens?: number) {
  const ms = (ema_ms ?? 500) / 1000;
  const cents = ema_cents ?? 0.1;
  const toks = (ema_tokens ?? 800) / 1000;
  const λ1 = 0.3,
    λ2 = 0.4,
    λ3 = 0.1;
  return sample - (λ1 * ms + λ2 * cents + λ3 * toks);
}

export function chooseExpertKey(keys: string[]): string {
  const s = exLoad();
  let best: { k: string; v: number } | null = null;
  for (const k of keys) {
    const st = s[k] || ({ a: 2, b: 2 } as ExStats);
    const draw = exBetaSample(Math.max(st.a, 0.5), Math.max(st.b, 0.5));
    const val = exScore(draw, st.ema_ms, st.ema_cents, st.ema_tokens);
    if (!best || val > best.v) best = { k, v: val };
  }
  return best ? best.k : keys[0];
}

function exEma(prev: number | undefined, x: number, α = 0.25) {
  return prev == null ? x : (1 - α) * prev + α * x;
}

export function recordExpertOutcome(key: string, outcome: { success: boolean; ms?: number; cents?: number; tokens?: number }) {
  const s = exLoad();
  const st: ExStats = s[key] || { a: 2, b: 2, n: 0 };
  st.a += outcome.success ? 1 : 0;
  st.b += outcome.success ? 0 : 1;
  st.n = (st.n || 0) + 1;
  if (outcome.ms != null) st.ema_ms = exEma(st.ema_ms, outcome.ms);
  if (outcome.cents != null) st.ema_cents = exEma(st.ema_cents, outcome.cents);
  if (outcome.tokens != null) st.ema_tokens = exEma(st.ema_tokens, outcome.tokens);
  s[key] = st;
  exSave(s);
}
