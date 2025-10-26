import { needSections, pickSections } from './retrieve.ts';

function rankByGainPerCost(actions: any[]) {
  return actions
    .map(a => ({...a, ratio: (a.gain_est || 1) / Math.max(1, a.cost_est || 1)}))
    .sort((a,b) => b.ratio - a.ratio)
    .map(({ratio, ...rest}) => rest);
}

function inferChips(spec: any, signals?: any) {
  const chips = ['Use dark mode','More minimal','Add 3-card features'];
  if (spec?.brand?.dark) chips[0] = 'Switch to light';
  return chips;
}

export function nextActions(spec: any, signals?: any) {
  const lowConf = (spec?.confidence ?? 0) < 0.6;
  const missing = needSections(spec);

  const actions: any[] = [];

  if (lowConf) {
    actions.push({
      kind: 'ask',
      cost_est: 5, gain_est: 25,
      args: { chips: inferChips(spec, signals) }
    });
  }

  if (missing.length) {
    actions.push({
      kind: 'retrieve',
      cost_est: 3, gain_est: 20,
      args: { sections: pickSections(spec, missing) }
    });
  }

  if (!lowConf && !missing.length) {
    actions.push({
      kind: 'patch',
      cost_est: 5, gain_est: 10,
      args: { theme: spec?.brand?.dark ? 'light' : 'dark' }
    });
  }

  return rankByGainPerCost(actions);
}
