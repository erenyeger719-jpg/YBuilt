// server/intent/experts.ts
export type Task = "planner" | "coder" | "critic";
export type Expert = {
  key: string;
  task: Task;
  provider: "openai" | "local";
  model: string;
  cost_cents: number;   // rough per-call estimate you can tune later
  tokens_est: number;   // rough token budget per call
  enabled: boolean;
};

const OPENAI = Boolean(process.env.OPENAI_API_KEY);

// Minimal, practical pool. Add Anthropic, etc. later by copying entries.
const EXPERTS: Expert[] = [
  // critic
  { key: "critic/mini/4o-mini", task: "critic", provider: "openai", model: "gpt-4o-mini", cost_cents: 0.03, tokens_est: 1200, enabled: OPENAI },
  { key: "critic/best/4o",      task: "critic", provider: "openai", model: "gpt-4o",      cost_cents: 0.15, tokens_est: 2000, enabled: OPENAI },

  // planner
  { key: "planner/mini/4o-mini", task: "planner", provider: "openai", model: "gpt-4o-mini", cost_cents: 0.02, tokens_est: 800, enabled: OPENAI },
  { key: "planner/best/4o",      task: "planner", provider: "openai", model: "gpt-4o",      cost_cents: 0.12, tokens_est: 1600, enabled: OPENAI },

  // coder
  { key: "coder/mini/4o-mini", task: "coder", provider: "openai", model: "gpt-4o-mini", cost_cents: 0.04, tokens_est: 1600, enabled: OPENAI },
  { key: "coder/best/4o",      task: "coder", provider: "openai", model: "gpt-4o",      cost_cents: 0.40, tokens_est: 4000, enabled: OPENAI },
];

export function expertsForTask(task: Task, maxCents?: number): Expert[] {
  const list = EXPERTS.filter(e => e.task === task && e.enabled);
  return typeof maxCents === "number" ? list.filter(e => e.cost_cents <= maxCents) : list;
}

export function expertByKey(key: string): Expert | undefined {
  return EXPERTS.find(e => e.key === key);
}
