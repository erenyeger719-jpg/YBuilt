// super light: session budget in memory
const SESS: Record<string,{spent:number,limit:number}> = {};

function sessFor(id: string) {
  if (!SESS[id]) SESS[id] = { spent: 0, limit: 100 }; // points
  return SESS[id];
}

function routeTier(action: any) {
  // 0: rules, 1: small model, 2: mid, 3: large (placeholder for now)
  if (action.kind === 'retrieve' || action.kind === 'ask') return 0;
  return 1;
}

export async function runWithBudget(sessionId: string, action: any, fn: (tier:number)=>Promise<any>) {
  const s = sessFor(sessionId);
  const tier = routeTier(action);
  const est = (action.cost_est || 5) * (tier + 1);
  if (s.spent + est > s.limit) return { skipped: true, reason: 'budget' };
  const res = await fn(tier);
  s.spent += est;
  return res;
}
