// server/intent/experts.ts
import fs from "fs";
import path from "path";
import crypto from "crypto";

/** ---------- Types ---------- **/
export type ExpertId =
  | "cheap-critic"      // quick static/regex critics
  | "taste-net"         // local aesthetic scorer
  | "retrieval-only"    // zero-LLM, retrieval+rules path
  | "granite-shadow"    // cloud provider (shadow only)
  | "proof-a11y";       // a11y/perf/proof gate

export type TaskKind = "review" | "plan" | "clarify" | "compose" | "proof" | "seo";

export type PickOpts = {
  audience?: "developers" | "founders" | "shoppers" | string;
  strict?: boolean;
  seed?: string;          // deterministic choice
  allowCloud?: boolean;   // if false ⇒ no cloud experts
};

type ScoreRow = { wins: number; tries: number; sumLatencyMs?: number; sumTokens?: number; sumCents?: number };
type Priors = { global: Record<ExpertId, ScoreRow>; byTask: Record<TaskKind, Record<ExpertId, ScoreRow>>; _meta?: { lastDecayTs?: number } };

/** ---------- Storage ---------- **/
const FILE = path.join(".cache", "experts.priors.json");
function readPriors(): Priors { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return { global: {}, byTask: {}, _meta: {} }; } }
function writePriors(db: Priors) { try { fs.mkdirSync(".cache", { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(db, null, 2), "utf8"); } catch {} }

/** ---------- Utils ---------- **/
function stableHash(s: string): number { return crypto.createHash("sha256").update(s).digest().readUInt32BE(0); }
function scoreRow(row?: ScoreRow, lambdaCost = 0.2): number {
  if (!row || row.tries === 0) return 0.5;
  const p = (row.wins + 1) / (row.tries + 2); // Laplace smoothing
  const avgCents = (row.sumCents ?? 0) / Math.max(row.tries, 1);
  const costPenalty = isFinite(avgCents) ? lambdaCost * Math.min(avgCents / 2, 1) : 0;
  return Math.max(0, Math.min(1, p - costPenalty));
}

/** ---------- Registry ---------- **/
export function expertsForTask(task: TaskKind, opts: PickOpts = {}): ExpertId[] {
  const base: ExpertId[] = ["retrieval-only", "cheap-critic", "proof-a11y", "taste-net"];
  if (opts.allowCloud !== false) base.push("granite-shadow");

  if (task === "compose") return ["retrieval-only", "taste-net", ...(opts.allowCloud === false ? [] : ["granite-shadow"]), "proof-a11y"];
  if (task === "review" || task === "seo") return ["cheap-critic", "proof-a11y", "retrieval-only", ...(opts.allowCloud === false ? [] : ["granite-shadow"])];
  if (task === "proof") return ["proof-a11y", "retrieval-only"];
  return base;
}

/** ---------- Picker ---------- **/
export function pickExpertFor(task: TaskKind, opts: PickOpts = {}): ExpertId {
  const list = expertsForTask(task, opts);
  if (process.env.NODE_ENV === "test") return list[0]; // deterministic tests

  const db = readPriors();
  const taskRows = db.byTask[task] || {};
  let best: { id: ExpertId; score: number; tie: number } | null = null;

  for (const id of list) {
    const s = 0.6 * scoreRow(taskRows[id]) + 0.4 * scoreRow(db.global[id]);
    const tie = stableHash(`${opts.seed || ""}|${task}|${id}`) >>> 0;
    if (!best || s > best.score || (s === best.score && tie > best.tie)) best = { id, score: s, tie };
  }
  return best ? best.id : list[0];
}

/** ---------- Outcome logging ---------- **/
export function recordExpertOutcome(
  task: TaskKind,
  expert: ExpertId,
  ok: boolean,
  meta?: { latencyMs?: number; tokens?: number; cents?: number }
) {
  const db = readPriors();
  const g = (db.global[expert] ||= { wins: 0, tries: 0 });
  const t = (db.byTask[task] ||= {});
  const r = (t[expert] ||= { wins: 0, tries: 0 });

  g.tries++; r.tries++; if (ok) { g.wins++; r.wins++; }
  if (meta?.latencyMs != null) { g.sumLatencyMs = (g.sumLatencyMs || 0) + meta.latencyMs; r.sumLatencyMs = (r.sumLatencyMs || 0) + meta.latencyMs; }
  if (meta?.tokens != null) { g.sumTokens = (g.sumTokens || 0) + meta.tokens; r.sumTokens = (r.sumTokens || 0) + meta.tokens; }
  if (meta?.cents != null) { g.sumCents = (g.sumCents || 0) + meta.cents; r.sumCents = (r.sumCents || 0) + meta.cents; }

  const now = Date.now(), DAY = 86_400_000; const last = db._meta?.lastDecayTs || now;
  if (now - last > DAY) {
    const decay = (row: ScoreRow) => {
      row.wins = Math.max(0, Math.floor(row.wins * 0.98));
      row.tries = Math.max(0, Math.floor(row.tries * 0.98));
      if (row.sumLatencyMs) row.sumLatencyMs *= 0.98;
      if (row.sumTokens) row.sumTokens *= 0.98;
      if (row.sumCents) row.sumCents *= 0.98;
    };
    (Object.keys(db.global) as ExpertId[]).forEach(id => decay(db.global[id]));
    (Object.keys(db.byTask) as TaskKind[]).forEach(tk => (Object.keys(db.byTask[tk]) as ExpertId[]).forEach(id => decay(db.byTask[tk][id])));
    db._meta = { lastDecayTs: now };
  }

  writePriors(db);
}
