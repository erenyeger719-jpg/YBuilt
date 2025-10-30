// scripts/sup.bandits.ts
import assert from "node:assert/strict";

const BASE = process.env.APP_ORIGIN || "http://localhost:5050";
const TRIALS = 200;

async function post(path: string, body: any) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

async function run() {
  console.log("Bandit convergence — start");
  // Tell router two hero arms exist; armB is better (simulated reward)
  await post("/api/ai/sections/register", {
    section: "hero",
    variants: ["A","B"],
  });

  let picksA = 0, picksB = 0;
  for (let i = 0; i < TRIALS; i++) {
    const choice = await post("/api/ai/sections/choose", { section: "hero", seed: i });
    const arm = choice.arm as "A" | "B";
    if (arm === "A") picksA++; else picksB++;

    // Simulate reward: B clicks 60%, A clicks 30%
    const reward = arm === "B" ? (Math.random() < 0.6) : (Math.random() < 0.3);
    await post("/api/ai/sections/reward", { section: "hero", arm, reward: reward ? 1 : 0 });
  }

  console.log({ picksA, picksB });
  assert.ok(picksB > picksA, "bandit should allocate more traffic to better arm");
  console.log("Bandit convergence — ✅");
}

run().catch((e) => { console.error(e); process.exit(1); });
