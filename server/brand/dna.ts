// server/brand/dna.ts
import fs from "fs";

const FILE = ".cache/branddna.json";

type Tone = "minimal" | "playful" | "serious";
type Row = {
  n: number;
  primary?: string;
  tone?: Tone;
  dark?: boolean;
  sections?: Record<string, number>;
};
type DB = Record<string, Row>;

function read(): DB {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return {}; }
}
function write(db: DB) {
  try { fs.mkdirSync(".cache", { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(db, null, 2)); } catch {}
}

export function suggestFromDNA(sessionId: string) {
  const db = read();
  const row = db[sessionId];
  if (!row) return {};
  const sections = row.sections
    ? Object.entries(row.sections).sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 2)
    : [];
  return {
    brand: { primary: row.primary, tone: row.tone, dark: row.dark },
    sections,
  };
}

export function recordDNA(
  sessionId: string,
  args: { brand?: { primary?: string; tone?: string; dark?: boolean }; sections?: string[] }
) {
  const db = read();
  const row: Row = db[sessionId] || { n: 0, sections: {} };
  row.n++;
  if (args.brand?.primary) row.primary = args.brand.primary;
  if (args.brand?.tone) row.tone = (args.brand.tone as Tone);
  if (typeof args.brand?.dark === "boolean") row.dark = args.brand.dark;
  if (Array.isArray(args.sections)) {
    row.sections = row.sections || {};
    for (const s of args.sections) row.sections[s] = (row.sections[s] || 0) + 1;
  }
  db[sessionId] = row;
  write(db);
}

export function learnFromChip(sessionId: string, chip: string) {
  const db = read();
  const row: Row = db[sessionId] || { n: 0, sections: {} };
  row.n++;
  if (/More minimal|Use minimal style/i.test(chip)) row.tone = "minimal";
  if (/More playful|Use playful style/i.test(chip)) row.tone = "playful";
  if (/Use brutalist style/i.test(chip)) row.tone = "serious";
  if (/Use dark mode/i.test(chip)) row.dark = true;
  if (/Switch to light/i.test(chip)) row.dark = false;
  db[sessionId] = row;
  write(db);
}
