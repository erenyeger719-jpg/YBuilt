// server/sections/bandits.ts
import fs from "fs";
const FILE = ".cache/sections.bandits.json";

type Key = string; // `${family}|${variant}|${audience}`
type Stat = { wins: number; losses: number };
type Store = Record<Key, Stat>;

function load(): Store { try { return JSON.parse(fs.readFileSync(FILE,"utf8")); } catch { return {}; } }
function save(s:Store){ try { fs.mkdirSync(".cache",{recursive:true}); fs.writeFileSync(FILE, JSON.stringify(s,null,2)); } catch {} }
function betaSample(a:number,b:number){ // very cheap approx using mean + small noise
  const mean = a/(a+b);
  const noise = Math.random()*0.05 - 0.025;
  return Math.max(0, Math.min(1, mean + noise));
}

const FAMILIES: Record<string,string[]> = {
  hero: ["hero-basic"],               // add more when you have them: "hero-split","hero-centered"
  pricing: ["pricing-simple"],
  faq: ["faq-accordion"],
  features: ["features-3col"],
  cta: ["cta-simple"]
};

export function pickVariant(sectionId: string, audience: string = "all"): string {
  // family is the prefix before '-', e.g., hero-* → "hero"
  const fam = sectionId.split("-")[0];
  const variants = FAMILIES[fam];
  if (!variants || variants.length <= 1) return sectionId;

  const store = load();
  let best = sectionId; let bestS = -1;
  for (const v of variants) {
    const key = `${fam}|${v}|${audience}`;
    const st = store[key] || { wins: 0, losses: 0 };
    const s = betaSample(1+st.wins, 1+st.losses);
    if (s > bestS) { bestS = s; best = v; }
  }
  return best;
}

export function recordSectionOutcome(sections: string[], audience: string, converted: boolean) {
  const famSeen = new Set<string>();
  for (const sec of sections) {
    const fam = sec.split("-")[0];
    const variants = FAMILIES[fam];
    if (!variants || famSeen.has(fam)) continue; // one credit per family
    famSeen.add(fam);

    const key = `${fam}|${sec}|${audience}`;
    const store = load();
    const st = store[key] || (store[key] = { wins: 0, losses: 0 });
    if (converted) st.wins += 1; else st.losses += 1;
    save(store);
  }
}
