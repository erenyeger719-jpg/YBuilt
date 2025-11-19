// server/intent/budget.ts
export type BudgetSession = { spentTokens?: number };

/**
 * Short-circuits when (spent + pending) >= cap.
 * Returns a test-friendly envelope on block; otherwise runs `fn`.
 */
export async function runWithBudget(
  session: { id?: string; budget_cap?: number; budget_used?: number } = {},
  action: { kind: string; cost_est?: number } = { kind: "noop" },
  runner: () => Promise<any>
) {
  const cap = Number(session.budget_cap ?? 1000);
  const used = Number(session.budget_used ?? 0);
  const remaining = Math.max(0, cap - used);
  const est = Math.max(0, Number(action.cost_est ?? 0));

  if (est > remaining) {
    return { ok: false, error: "over_budget", remaining, est };
  }
  return runner();
}
