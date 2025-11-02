// server/sup/ledger.ts
import fs from "fs";
import path from "path";
import * as crypto from "crypto";


const FILE = path.join(".cache", "ledger.v1.json");
type Stamp = { last: number; burst: number; credit: number };
type State = Record<string, Stamp>; // key = ip|session|apiKey

function read(): State {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); }
  catch { return {}; }
}
function write(s: State) {
  try { fs.mkdirSync(".cache", { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(s)); } catch {}
}

export type Budget = { allowed: boolean; tier: "full" | "light" | "safe"; reason: string; remaining: number };

export function assessAndUpdate(key: string, endpoint: string, cost = 1): Budget {
  const now = Date.now();
  const s = read();
  const rec = s[key] || { last: now, burst: 0, credit: 100 }; // credit starts at 100
  const dt = Math.max(1, (now - rec.last) / 1000);

  // decay burst, replenish credit slowly
  rec.burst = Math.max(0, rec.burst - dt * 0.5);
  rec.credit = Math.min(150, rec.credit + dt * 0.1);

  // apply this request
  rec.burst += cost;

  // quick heuristics: shape thresholds per endpoint
  const hardBurst = endpoint === "compose" ? 12 : 6;
  const softBurst = endpoint === "compose" ? 8 : 4;

  let tier: Budget["tier"] = "full";
  let allowed = true;
  let reason = "ok";

  if (rec.burst > hardBurst || rec.credit < 10) {
    tier = "safe"; allowed = endpoint !== "compose"; reason = "over_budget_hard";
  } else if (rec.burst > softBurst || rec.credit < 30) {
    tier = "light"; allowed = true; reason = "over_budget_soft";
  }

  // penalize if soft/hard
  if (tier !== "full") rec.credit = Math.max(0, rec.credit - 5);

  rec.last = now; s[key] = rec; write(s);
  return { allowed, tier, reason, remaining: Math.max(0, hardBurst - rec.burst) };
}
