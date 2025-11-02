// client/src/pages/CodeWorkspace.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";

type TreeNode = { name: string; path: string; type: "file" | "dir"; children?: TreeNode[] };

// ---- tiny fetch helpers ----
async function getTree() {
  const r = await fetch("/api/code/tree");
  if (!r.ok) throw new Error("tree_fetch_failed");
  return r.json();
}
async function readFile(path: string) {
  const r = await fetch(`/api/code/read?path=${encodeURIComponent(path)}`);
  if (!r.ok) throw new Error("read_fetch_failed");
  return r.json();
}
async function propose(path: string, instruction: string) {
  const r = await fetch("/api/code/propose", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path, instruction }),
  });
  if (!r.ok) throw new Error("propose_fetch_failed");
  return r.json();
}
async function applyFile(path: string, newContent: string, dryRun = false) {
  const r = await fetch("/api/code/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path, newContent, dryRun }),
  });
  if (!r.ok) throw new Error("apply_fetch_failed");
  return r.json();
}
async function explain(path: string, line?: number) {
  const r = await fetch("/api/code/explain", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path, line }),
  });
  if (!r.ok) throw new Error("explain_fetch_failed");
  return r.json();
}

// --- A/B helpers ---
async function abStart(path: string, aContent: string, bContent: string, note?: string) {
  const r = await fetch("/api/code/ab/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path, aContent, bContent, note }),
  });
  if (!r.ok) throw new Error("ab_start_failed");
  return r.json();
}
async function abMark(id: string, arm: "A" | "B", event: "seen" | "convert") {
  const r = await fetch("/api/code/ab/mark", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, arm, event }),
  });
  if (!r.ok) throw new Error("ab_mark_failed");
  return r.json();
}
async function abStats(id: string) {
  const r = await fetch(`/api/code/ab/stats?id=${encodeURIComponent(id)}`);
  if (!r.ok) throw new Error("ab_stats_failed");
  return r.json();
}

// --- Tests helpers ---
async function testsPropose(sourcePath: string, targetPath?: string) {
  const r = await fetch("/api/code/tests/propose", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sourcePath, targetPath }),
  });
  if (!r.ok) throw new Error("tests_propose_failed");
  return r.json();
}
async function testsApply(testPath: string, newContent: string, dryRun = false) {
  const r = await fetch("/api/code/tests/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ testPath, newContent, dryRun }),
  });
  if (!r.ok) throw new Error("tests_apply_failed");
  return r.json();
}

// --- Migration helpers (repo-wide) ---
async function migratePreview(params: {
  dirPrefix?: string; find: string; replace?: string; regex?: boolean; caseSensitive?: boolean; maxFiles?: number;
}) {
  const r = await fetch("/api/code/migrate/preview", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(params),
  });
  if (!r.ok) throw new Error("migrate_preview_failed");
  return r.json();
}
async function migrateApply(params: {
  dirPrefix?: string; find: string; replace?: string; regex?: boolean; caseSensitive?: boolean; maxFiles?: number;
}) {
  const r = await fetch("/api/code/migrate/apply", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(params),
  });
  if (!r.ok) throw new Error("migrate_apply_failed");
  return r.json();
}

// Optional: proof/perf endpoint (skip gracefully if absent)
const CONTRACTS_CHECK_URL = "/api/ai/proof/current";

// ---- tiny intent heuristic over diff (client-only, deterministic) ----
type IntentSummary = { cta: number; claim: number; price: number; feature: number; riskyClaims: number };
function computeIntentSummary(base: string, next: string): IntentSummary {
  const added = new Set<string>();
  const baseLines = new Set(base.split("\n"));
  for (const line of next.split("\n")) if (!baseLines.has(line)) added.add(line.toLowerCase());
  const str = Array.from(added).join(" ");
  const hit = (re: RegExp) => (str.match(re) || []).length;

  const cta = hit(/\b(sign up|get started|start trial|join (now|waitlist)|buy now|request demo|subscribe)\b/g);
  const price = hit(/₹|\$|\b(rs\.?|inr|usd)\b|\b(per month|\/mo|monthly|price|pricing)\b/g);
  const riskyClaims = hit(/\b(best|#1|number\s*one|guaranteed|unlimited|fastest)\b/g) + hit(/\b\d{1,3}%\b/g);
  const claim = riskyClaims + hit(/\b(revolutionary|industry-leading|no\.?1|breakthrough|game[- ]changing|prove|evidence)\b/g);
  const feature = hit(/\b(feature|supports|integrates|includes|dark mode|offline|api|sdk|webhooks|a11y)\b/g);

  return { cta, claim, price, feature, riskyClaims };
}

// add below computeIntentSummary(...)
type OutcomeHint = { text: string };

function predictOutcome(base: string, next: string, intent: IntentSummary | null): OutcomeHint | null {
  if (!intent) return null;
  const ctas = Math.min(intent.cta, 4);
  const risk = Math.min(intent.riskyClaims, 3);
  const baseLift = 0.06 + ctas * 0.02; // 6% + 2% per CTA
  const penalty = risk * 0.01; // -1% per risky claim
  const low = Math.max(0.02, baseLift - penalty - 0.02);
  const high = Math.max(low + 0.02, baseLift - penalty + 0.02);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return { text: `Outcome hint: Predicted +${pct(low)}–${pct(high)} CTR (heuristic)` };
}

// ---- small TS helpers ----
function isFiniteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}
function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---- flatten files for quick-open ----
type FlatFile = { name: string; path: string };
function flattenTree(root: TreeNode | null): FlatFile[] {
  const out: FlatFile[] = [];
  const walk = (n: TreeNode | undefined) => {
    if (!n) return;
    if (n.type === "file") out.push({ name: n.name, path: n.path });
    n.children?.forEach((c) => walk(c));
  };
  if (root) walk(root);
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// ---- fuzzy-lite matcher ----
function scoreMatch(q: string, f: FlatFile): number {
  if (!q) return 1;
  const hay = `${f.name} ${f.path}`.toLowerCase();
  const needle = q.toLowerCase().trim();
  if (!needle) return 0.5;
  if (f.name.toLowerCase().startsWith(needle)) return 5;
  if (hay.includes(needle)) return 3;
  const toks = needle.split(/\W+/).filter(Boolean);
  const miss = toks.some((t) => !hay.includes(t));
  return miss ? 0 : 2 + toks.length * 0.1;
}

// ---- diff + hunks (minimal LCS) ----
type Op = { t: "equal" | "add" | "del"; lines: string[] };
type Hunk = {
  idx: number;
  aStart: number;
  aLen: number;
  bStart: number;
  bLen: number;
  lines: { sign: " " | "+" | "-"; text: string }[];
};
function lcsOps(a: string[], b: string[]): Op[] {
  const n = a.length,
    m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops: Op[] = [];
  let i = 0,
    j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      const buf: string[] = [];
      while (i < n && j < m && a[i] === b[j]) {
        buf.push(a[i]);
        i++;
        j++;
      }
      ops.push({ t: "equal", lines: buf });
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      const buf: string[] = [];
      while (i < n && (j >= m || dp[i + 1][j] >= dp[i][j + 1]) && !(i < n && j < m && a[i] === b[j])) {
        buf.push(a[i]);
        i++;
      }
      ops.push({ t: "del", lines: buf });
    } else {
      const buf: string[] = [];
      while (j < m && (i >= n || dp[i][j + 1] > dp[i + 1][j]) && !(i < n && j < m && a[i] === b[j])) {
        buf.push(b[j]);
        j++;
      }
      ops.push({ t: "add", lines: buf });
    }
  }
  if (i < n) ops.push({ t: "del", lines: a.slice(i) });
  if (j < m) ops.push({ t: "add", lines: b.slice(j) });
  return ops;
}
function toHunks(a: string[], b: string[], context = 2): Hunk[] {
  const ops = lcsOps(a, b);
  const hunks: Hunk[] = [];
  let ai = 0,
    bi = 0,
    idx = 0;
  let curLines: { sign: " " | "+" | "-"; text: string }[] = [];
  let aStart = ai,
    bStart = bi;
  let aLen = 0,
    bLen = 0;
  let open = false;
  function flush() {
    if (!open) return;
    hunks.push({ idx: idx++, aStart, aLen, bStart, bLen, lines: curLines });
    curLines = [];
    open = false;
    aLen = 0;
    bLen = 0;
  }
  for (const op of ops) {
    if (op.t === "equal") {
      const eq = op.lines;
      if (open) {
        const head = eq.slice(0, context);
        for (const l of head) {
          curLines.push({ sign: " ", text: l });
          ai++;
          bi++;
          aLen++;
          bLen++;
        }
        flush();
      }
      const tail = eq.slice(Math.max(0, eq.length - context));
      // carry trailing context into next hunk opener
      if (tail.length) {
        aStart = ai + Math.max(0, eq.length - context);
        bStart = bi + Math.max(0, eq.length - context);
      }
      ai += eq.length;
      bi += eq.length;
    } else {
      if (!open) {
        open = true;
        aStart = ai;
        bStart = bi;
        curLines = [];
      }
      if (op.t === "del") {
        for (const l of op.lines) {
          curLines.push({ sign: "-", text: l });
          ai++;
          aLen++;
        }
      } else {
        for (const l of op.lines) {
          curLines.push({ sign: "+", text: l });
          bi++;
          bLen++;
        }
      }
    }
  }
  flush();
  // add leading/trailing context for first/last hunk (best-effort)
  return hunks;
}
function applySelectedHunks(
  base: string,
  a: string,
  b: string,
  selected: number[]
): { ok: boolean; next?: string; reason?: string } {
  if (base !== a) return { ok: false, reason: "Base changed since snapshot; restore base, then cherry-pick." };
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const hunks = toHunks(aLines, bLines);
  const chosen = new Set(selected);
  let out: string[] = [];
  let ai = 0;
  for (const h of hunks) {
    // copy unchanged until hunk start (from 'a')
    while (ai < h.aStart) {
      out.push(aLines[ai++]);
    }
    if (chosen.has(h.idx)) {
      // apply hunk: remove '-' and add '+'
      for (const ln of h.lines) {
        if (ln.sign === "-") {
          ai++;
        } // skip original
        else if (ln.sign === "+") {
          out.push(ln.text);
        } // add new
        else {
          out.push(aLines[ai++]);
        } // context
      }
    } else {
      // keep original lines
      for (const ln of h.lines) {
        if (ln.sign !== "+") {
          // '-' or ' ' come from a
          out.push(aLines[ai++]);
        }
        // skip '+' (since not selected)
      }
    }
  }
  // copy remainder
  while (ai < aLines.length) out.push(aLines[ai++]);
  return { ok: true, next: out.join("\n") };
}

// ---- history types ----
type Snapshot = {
  id: string;
  ts: number;
  path: string;
  before: string;
  after: string;
  summary: string[];
  intent?: IntentSummary | null;
};

type ABStats = { seen: number; convert: number; cr: number };
type ABState = { A: ABStats; B: ABStats };
type Tab = { path: string; name: string };

export default function CodeWorkspace() {
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [activePath, setActivePath] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [proposal, setProposal] = useState<{ newContent: string; summary: string[] } | null>(null);
  const [instruction, setInstruction] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [explainLines, setExplainLines] = useState<string[]>([]);
  const [intent, setIntent] = useState<IntentSummary | null>(null);
  const [outcomeHint, setOutcomeHint] = useState<OutcomeHint | null>(null); // NEW

  // tabs + quick-open
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [showQO, setShowQO] = useState(false);
  const [qoQuery, setQoQuery] = useState("");
  const [qoSel, setQoSel] = useState(0);

  // A/B state
  const [abId, setAbId] = useState<string | null>(null);
  const [abStatsState, setAbStatsState] = useState<ABState | null>(null);
  const [abNote, setAbNote] = useState<string>("");

  // Tests state
  const [testProposal, setTestProposal] = useState<{ path: string; newContent: string; summary: string[] } | null>(null);
  const [testStatus, setTestStatus] = useState<string>("");

  // Migration state
  const [migFind, setMigFind] = useState("");
  const [migReplace, setMigReplace] = useState("");
  const [migRegex, setMigRegex] = useState(false);
  const [migCase, setMigCase] = useState(false);
  const [migDir, setMigDir] = useState("");
  const [migPrev, setMigPrev] = useState<{ total: number; changed: number; items: { path: string; hits: number }[] } | null>(null);
  const [migStatus, setMigStatus] = useState<string>("");

  // History state
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [historyStatus, setHistoryStatus] = useState<string>("");
  const [historyFilterActive, setHistoryFilterActive] = useState<boolean>(true);
  const [selectedSnap, setSelectedSnap] = useState<Snapshot | null>(null);
  const [selectedHunks, setSelectedHunks] = useState<Record<number, boolean>>({});
  const [diffHunksState, setDiffHunksState] = useState<Hunk[] | null>(null);

  // voice
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // editor refs
  const leftTextRef = useRef<HTMLTextAreaElement | null>(null);

  // preview
  const previewRef = useRef<HTMLIFrameElement | null>(null);
  const previewUrl = "/";

  // overlays / metrics
  const [perfOn, setPerfOn] = useState(false);
  const [a11yOn, setA11yOn] = useState(false);
  const [perfStats, setPerfStats] = useState<{ lcp: number; cls: number }>({ lcp: 0, cls: 0 });
  const perfTimerRef = useRef<number | null>(null);

  // flattened files (memoized)
  const flat = useMemo(() => flattenTree(tree), [tree]);
  const qoMatches = useMemo(() => {
    const ranked = flat
      .map((f) => ({ f, s: scoreMatch(qoQuery, f) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 40)
      .map((x) => x.f);
    return ranked;
  }, [flat, qoQuery]);

  // load tree on mount
  useEffect(() => {
    let alive = true;
    getTree()
      .then((d) => {
        if (!alive) return;
        if (d?.ok) setTree(d.tree);
        else setStatus(d?.error || "Could not load tree");
      })
      .catch(() => setStatus("Could not load tree"));
    return () => {
      alive = false;
    };
  }, []);

  // keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setShowQO(true);
        setQoQuery("");
        setQoSel(0);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "w") {
        e.preventDefault();
        if (activePath) closeTab(activePath);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        onPropose();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "[" || e.key === "]")) {
        e.preventDefault();
        if (!tabs.length) return;
        const idx = tabs.findIndex((t) => t.path === activePath);
        const next = e.key === "]" ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length;
        openFile(tabs[next].path);
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tabs, activePath, instruction, proposal]);

  function ensureTab(path: string) {
    const name = path.split("/").pop() || path;
    setTabs((t) => (t.find((x) => x.path === path) ? t : [...t, { path, name }]));
  }
  function activateTab(path: string) {
    setActivePath(path);
  }
  function closeTab(path: string) {
    setTabs((t) => {
      const idx = t.findIndex((x) => x.path === path);
      const nextTabs = t.filter((x) => x.path !== path);
      if (path === activePath) {
        const pick = nextTabs[idx] || nextTabs[idx - 1];
        if (pick) openFile(pick.path);
        else {
          setActivePath("");
          setContent("");
          setProposal(null);
          setExplainLines([]);
          setTestProposal(null);
          setSelectedSnap(null);
          setDiffHunksState(null);
          setSelectedHunks({});
        }
      }
      return nextTabs;
    });
  }

  async function openFile(p: string, line?: number) {
    try {
      const d = await readFile(p);
      if (d.ok) {
        ensureTab(d.path);
        setActivePath(d.path);
        setContent(d.content);
        setProposal(null);
        setIntent(null);
        setExplainLines([]);
        setAbId(null);
        setAbStatsState(null);
        setTestProposal(null);
        setStatus("");
        setTestStatus("");
        setSelectedSnap(null);
        setDiffHunksState(null);
        setSelectedHunks({});
        setOutcomeHint(null); // NEW: clear hint when switching files
        if (isFiniteNum(line) && line > 0) {
          setTimeout(() => {
            scrollEditorToLine(leftTextRef.current, d.content, line);
          }, 30);
        }
      } else setStatus(d.error || "read failed");
    } catch {
      setStatus("read failed");
    }
  }

  async function onPropose() {
    if (!activePath || !instruction.trim()) return;
    setStatus("Proposing…");
    try {
      const d = await propose(activePath, instruction);
      if (d.ok) {
        const intentNow = computeIntentSummary(content, d.newContent);
        setProposal({ newContent: d.newContent, summary: d.summary });
        setIntent(intentNow);
        setOutcomeHint(predictOutcome(content, d.newContent, intentNow));
        setStatus("Proposed");
      } else setStatus(d.error || "propose failed");
    } catch {
      setStatus("propose failed");
    }
  }

  async function onDryRun() {
    if (!activePath || !proposal) return;
    setStatus("Dry-run…");
    try {
      const d = await applyFile(activePath, proposal.newContent, true);
      setStatus(d.ok ? "Dry-run OK (contracts next)" : (d.error + (Array.isArray(d.reasons) ? ": " + d.reasons.join("; ") : "")));
    } catch {
      setStatus("dry-run failed");
    }
  }

  async function runContractsCheck(): Promise<{ ok: boolean; reason?: string }> {
    try {
      const r = await fetch(CONTRACTS_CHECK_URL);
      if (!r.ok) return { ok: true };
      const j = await r.json();
      if (j && typeof j.ok === "boolean") return j;
      return { ok: true };
    } catch {
      return { ok: true };
    }
  }

  // central commit util (used by normal commit + history actions)
  async function commitContent(newContent: string, summary: string[], tag = "commit") {
    setStatus("Contracts check…");
    const proof = await runContractsCheck();
    if (!proof.ok) {
      setStatus(proof.reason || "Blocked by contracts");
      return false;
    }
    setStatus("Committing…");
    try {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const d = await applyFile(activePath!, newContent, false);
      if (d.ok) {
        const before = content;
        setContent(newContent);
        setProposal(null);
        setInstruction("");
        setExplainLines([]);
        setIntent(null);
        setStatus("Committed");
        pushSnapshot({
          id: uid(),
          ts: Date.now(),
          path: activePath,
          before,
          after: newContent,
          summary,
          intent,
        });
        softReloadPreview();
        return true;
      } else {
        const reasons = Array.isArray(d.reasons) ? ": " + d.reasons.join("; ") : "";
        setStatus((d.error || "commit failed") + reasons);
        return false;
      }
    } catch {
      setStatus("commit failed");
      return false;
    }
  }

  function pushSnapshot(s: Snapshot) {
    setHistory((h) => [s, ...h].slice(0, 200)); // simple cap
  }

  function softReloadPreview() {
    const ifr = previewRef.current;
    if (!ifr) return;
    const reload = () => {
      if (ifr) ifr.src = ifr.src;
    };
    try {
      const doc = ifr.contentDocument;
      if (doc && doc.readyState === "complete") reload();
      else ifr.addEventListener("load", reload, { once: true });
    } catch {
      reload();
    }
  }

  async function onCommit() {
    if (!activePath || !proposal) return;
    const add = outcomeHint ? [...proposal.summary, outcomeHint.text] : proposal.summary;
    await commitContent(proposal.newContent, add, "commit");
  }

  // voice input
  function toggleMic() {
    // @ts-ignore
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setStatus("Voice not supported");
      return;
    }
    if (!recognitionRef.current) {
      recognitionRef.current = new SR();
      recognitionRef.current.lang = "en-US";
      recognitionRef.current.interimResults = true;
      recognitionRef.current.continuous = false;
      recognitionRef.current.onresult = (e: any) => {
        let finalText = "";
        for (let i = 0; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) finalText += res[0].transcript;
        }
        if (finalText.trim()) setInstruction((prev) => (prev ? prev + " " : "") + finalText.trim());
      };
      recognitionRef.current.onend = () => setListening(false);
      recognitionRef.current.onerror = () => setListening(false);
    }
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      setListening(true);
      recognitionRef.current.start();
    }
  }

  // Explain
  async function onExplain() {
    if (!activePath) return;
    setStatus("Explaining…");
    try {
      let caretLine: number | undefined = undefined;
      const ta = leftTextRef.current;
      if (ta) {
        const txt = ta.value.slice(0, ta.selectionStart || 0);
        caretLine = txt.split("\n").length; // 1-based
      }
      const d = await explain(activePath, caretLine);
      if (d.ok) {
        const pretty = [
          d.summary,
          "",
          ...(Array.isArray(d.lines)
            ? d.lines.map((pair: [number, string]) => `${String(pair[0]).padStart(3, " ")} | ${pair[1]}`)
            : []),
        ];
        setExplainLines(pretty);
        setStatus("Explained");
      } else setStatus(d.error || "explain failed");
    } catch {
      setStatus("explain failed");
    }
  }

  // preview → source jump
  useEffect(() => {
    const iframe = previewRef.current;
    if (!iframe) return;
    function attach() {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        doc.addEventListener(
          "click",
          (ev: MouseEvent) => {
            const target = ev.target as HTMLElement | null;
            if (!target) return;
            const el = target.closest("[data-file]") as HTMLElement | null;
            if (!el) return;
            const file = el.getAttribute("data-file") || "";
            const lineStr = el.getAttribute("data-line") || "";
            if (file) {
              const parsed = parseInt(lineStr || "0", 10);
              openFile(file, isFiniteNum(parsed) && parsed > 0 ? parsed : undefined);
            }
          },
          true
        );
      } catch {
        /* cross-origin; ignore */
      }
    }
    iframe.addEventListener("load", attach);
    try {
      const doc = iframe.contentDocument;
      if (doc && doc.readyState === "complete") attach();
    } catch {}
    return () => {
      iframe.removeEventListener("load", attach);
    };
  }, [previewUrl]);

  // ----- A/B: start / mark / poll stats -----
  async function onAbStart() {
    if (!activePath || !proposal) return;
    setStatus("Starting A/B…");
    try {
      const j = await abStart(activePath, content, proposal.newContent, abNote || undefined);
      if (j.ok) {
        setAbId(j.id);
        setStatus("A/B started");
        const s = await abStats(j.id);
        if (s.ok) setAbStatsState({ A: s.A, B: s.B });
      } else setStatus(j.error || "ab start failed");
    } catch {
      setStatus("ab start failed");
    }
  }
  async function onAbMark(arm: "A" | "B", event: "seen" | "convert") {
    if (!abId) return;
    await abMark(abId, arm, event);
    const s = await abStats(abId);
    if (s.ok) setAbStatsState({ A: s.A, B: s.B });
  }
  const bBeatsA = (() => {
    if (!abStatsState) return false;
    const { A, B } = abStatsState;
    return B.seen >= 10 && B.cr > A.cr * 1.2;
  })();

  // ---- Quick Chips ----
  function selectionText(): string {
    const ta = leftTextRef.current;
    if (!ta) return "";
    const start = ta.selectionStart || 0;
    const end = ta.selectionEnd || 0;
    return ta.value.slice(start, end);
  }
  function chipRename() {
    const sel = selectionText().trim() || "name";
    const next = window.prompt(`Rename "${sel}" to:`, `${sel}2`);
    if (!next || next === sel) return;
    setInstruction(`rename ${sel} to ${next}`);
  }
  function chipAxiosToFetch() {
    setInstruction("replace axios with fetch");
  }
  function chipStickyHeader() {
    setInstruction("make header sticky only on desktop");
  }
  function chipSoftenClaims() {
    setInstruction("soften superlatives and risky claims");
  }
  function chipExtractComponent() {
    const sel = selectionText().trim();
    const name = window.prompt("Extract selection into React component named:", "NewSection");
    if (!name) return;
    const base = sel ? `extract selected code into React component ${name}` : `extract into React component ${name}`;
    setInstruction(`${base} and import/use it in this file`);
  }

  // ---- Perf/A11y overlays ----
  function getIframeDoc(): Document | null {
    try {
      return previewRef.current?.contentDocument || null;
    } catch {
      return null;
    }
  }
  function ensureA11yStyle(doc: Document, on: boolean) {
    const id = "yb-a11y-style";
    const prev = doc.getElementById(id);
    if (on) {
      if (!prev) {
        const st = doc.createElement("style");
        st.id = id;
        st.textContent = `.yb-a11y-issue { outline: 2px solid red !important; outline-offset: 2px; }`;
        doc.head.appendChild(st);
      }
    } else if (prev) prev.remove();
  }
  function computeAccessibleName(doc: Document, el: HTMLElement): string {
    const aria = el.getAttribute("aria-label") || el.getAttribute("title") || "";
    if (aria.trim()) return aria.trim();
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const by = doc.getElementById(labelledBy);
      if (by && by.textContent) return by.textContent.trim();
    }
    if (el.tagName === "INPUT") {
      const input = el as HTMLInputElement;
      if (input.value?.trim()) return input.value.trim();
      const id = input.id;
      if (id) {
        const esc = (s: string) => {
          // @ts-ignore
          const fn = (window as any).CSS?.escape as ((s: string) => string) | undefined;
          return fn ? fn(s) : s.replace(/[^a-z0-9_\-]/gi, (m) => `\\${m}`);
        };
        const lbl = doc.querySelector(`label[for="${esc(id)}"]`);
        if (lbl && lbl.textContent) return lbl.textContent.trim();
      }
    }
    const txt = (el.textContent || "").trim();
    return txt;
  }
  function markA11yIssues() {
    const doc = getIframeDoc();
    if (!doc) return;
    doc.querySelectorAll<HTMLElement>(".yb-a11y-issue").forEach((n) => n.classList.remove("yb-a11y-issue"));
    if (!a11yOn) return;
    ensureA11yStyle(doc, true);
    doc.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
      const alt = img.getAttribute("alt");
      if (!alt || !alt.trim()) img.classList.add("yb-a11y-issue");
    });
    doc.querySelectorAll<HTMLElement>("button, a, input[type=button], input[type=submit]").forEach((el) => {
      const name = computeAccessibleName(doc, el);
      if (!name) el.classList.add("yb-a11y-issue");
    });
    doc
      .querySelectorAll<HTMLElement>("input:not([type=hidden]):not([type=button]):not([type=submit]), select, textarea")
      .forEach((el) => {
        const name = computeAccessibleName(doc, el);
        if (!name) el.classList.add("yb-a11y-issue");
      });
  }
  function injectPerfObserver() {
    const doc = getIframeDoc();
    if (!doc) return;
    const id = "yb-perf-script";
    if (doc.getElementById(id)) return;
    const sc = doc.createElement("script");
    sc.id = id;
    sc.text = `
      (function(){
        try {
          window.__ybPerf = window.__ybPerf || { lcp: 0, cls: 0 };
          if (typeof PerformanceObserver !== 'undefined') {
            try {
              const po = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const last = entries[entries.length - 1];
                if (last) window.__ybPerf.lcp = (last.renderTime || last.loadTime || last.startTime) || 0;
              });
              po.observe({ type: 'largest-contentful-paint', buffered: true });
            } catch(_) {}
            try {
              let cls = 0;
              const po2 = new PerformanceObserver((list) => {
                for (const e of list.getEntries()) {
                  // @ts-ignore
                  if (!e.hadRecentInput && e.value) cls += e.value;
                }
                window.__ybPerf.cls = cls;
              });
              po2.observe({ type: 'layout-shift', buffered: true });
            } catch(_) {}
          }
        } catch(_) {}
      })();
    `;
    doc.head.appendChild(sc);
  }
  function startPerfPolling() {
    stopPerfPolling();
    const win = previewRef.current?.contentWindow as any;
    if (!win) return;
    perfTimerRef.current = window.setInterval(() => {
      try {
        const p = win.__ybPerf || { lcp: 0, cls: 0 };
        if (typeof p.lcp === "number" && typeof p.cls === "number") setPerfStats({ lcp: p.lcp, cls: p.cls });
      } catch {}
    }, 500);
  }
  function stopPerfPolling() {
    if (perfTimerRef.current) {
      window.clearInterval(perfTimerRef.current);
      perfTimerRef.current = null;
    }
  }
  function togglePerf() {
    const next = !perfOn;
    setPerfOn(next);
    const doc = getIframeDoc();
    if (!doc) return;
    if (next) {
      injectPerfObserver();
      startPerfPolling();
    } else {
      stopPerfPolling();
    }
  }
  function toggleA11y() {
    const next = !a11yOn;
    setA11yOn(next);
    const doc = getIframeDoc();
    if (!doc) return;
    ensureA11yStyle(doc, next);
    markA11yIssues();
  }

  // ----- UI -----
  const lcpMs = Math.round(perfStats.lcp || 0);
  const clsFmt = (perfStats.cls || 0).toFixed(3);

  // Quick Open actions
  function qoOpenSelected(idx: number) {
    const hit = qoMatches[idx];
    if (!hit) return;
    setShowQO(false);
    openFile(hit.path);
  }
  function qoKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setQoSel((s) => Math.min(s + 1, Math.max(0, qoMatches.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setQoSel((s) => Math.max(0, s - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      qoOpenSelected(qoSel);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowQO(false);
    }
  }

  // ---- History helpers ----
  const filteredHistory = useMemo(() => {
    return historyFilterActive && activePath ? history.filter((h) => h.path === activePath) : history;
  }, [history, historyFilterActive, activePath]);

  function openDiff(s: Snapshot) {
    if (activePath !== s.path) {
      setHistoryStatus("Open the snapshot's file to view/apply diff.");
      return;
    }
    const a = s.before.split("\n"),
      b = s.after.split("\n");
    if (a.length > 20000 || b.length > 20000) {
      setSelectedSnap(null);
      setDiffHunksState(null);
      setSelectedHunks({});
      setHistoryStatus("Diff too large; apply or revert snapshot instead.");
      return;
    }
    const hunks = toHunks(a, b);
    setSelectedSnap(s);
    setDiffHunksState(hunks);
    const box: Record<number, boolean> = {};
    hunks.forEach((h) => {
      box[h.idx] = true;
    });
    setSelectedHunks(box);
    setHistoryStatus(`Diff • ${hunks.length} hunk(s)`);
  }

  async function revertToBefore(s: Snapshot) {
    if (activePath !== s.path) {
      setHistoryStatus("Open the snapshot's file to revert.");
      return;
    }
    const ok = await commitContent(s.before, ["revert to before", ...(s.summary || [])], "revert");
    setHistoryStatus(ok ? "Reverted" : "Revert failed");
  }
  async function reapplyAfter(s: Snapshot) {
    if (activePath !== s.path) {
      setHistoryStatus("Open the snapshot's file to apply.");
      return;
    }
    const ok = await commitContent(s.after, ["reapply snapshot", ...(s.summary || [])], "apply");
    setHistoryStatus(ok ? "Applied" : "Apply failed");
  }
  async function cherryPickSelected(s: Snapshot) {
    if (!diffHunksState || !selectedSnap || s.id !== selectedSnap.id) return;
    if (activePath !== s.path) {
      setHistoryStatus("Open the snapshot's file to cherry-pick.");
      return;
    }
    const chosen = Object.entries(selectedHunks)
      .filter(([k, v]) => v)
      .map(([k]) => parseInt(k, 10));
    const res = applySelectedHunks(content, s.before, s.after, chosen);
    if (!res.ok || !res.next) {
      setHistoryStatus(res.reason || "Cherry-pick failed");
      return;
    }
    const ok = await commitContent(res.next, ["cherry-pick hunks", ...(s.summary || [])], "cherry");
    setHistoryStatus(ok ? "Cherry-picked" : "Cherry-pick failed");
  }

  return (
    <div className="w-screen h-screen grid" style={{ gridTemplateColumns: "280px 1fr 40%" }}>
      {/* Left: Tree */}
      <div className="border-r overflow-auto p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Files</h3>
          <button
            onClick={() => {
              setShowQO(true);
              setQoQuery("");
              setQoSel(0);
            }}
            className="px-2 py-1 border rounded text-xs"
            title="Quick Open (Ctrl/Cmd+P)"
          >
            Quick Open
          </button>
        </div>
        {tree ? <Tree node={tree} onOpen={openFile} /> : <div>Loading…</div>}
      </div>

      {/* Center: Code + Tabs + Diff + Chips */}
      <div className="flex flex-col h-full">
        {/* Tabs */}
        <div className="border-b px-2 py-1 flex gap-1 overflow-auto">
          {tabs.map((t) => {
            const active = t.path === activePath;
            return (
              <div
                key={t.path}
                className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer ${active ? "bg-gray-200" : "hover:bg-gray-100"}`}
                onClick={() => activateTab(t.path)}
                title={t.path}
              >
                <span className="text-xs font-medium">{t.name}</span>
                <button
                  className="text-xs opacity-70 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(t.path);
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
          {!tabs.length && <span className="text-xs opacity-60">No tabs open</span>}
        </div>

        {/* Prompt row */}
        <div className="p-3 border-b flex items-center gap-2">
          <input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="What do you want to change?"
            className="flex-1 border px-3 py-2 rounded"
          />
          <div className="flex gap-1">
            <button onClick={chipRename} className="px-2 py-1 border rounded text-xs" title="Uses selection">
              Rename
            </button>
            <button onClick={chipExtractComponent} className="px-2 py-1 border rounded text-xs" title="Uses selection if any">
              Extract ↗︎
            </button>
            <button onClick={chipAxiosToFetch} className="px-2 py-1 border rounded text-xs">
              Axios→fetch
            </button>
            <button onClick={chipStickyHeader} className="px-2 py-1 border rounded text-xs">
              Sticky header
            </button>
            <button onClick={chipSoftenClaims} className="px-2 py-1 border rounded text-xs">
              Soften claims
            </button>
          </div>
          <button onClick={toggleMic} className="px-3 py-2 border rounded" title="Hold to dictate">
            {listening ? "Stop 🎙️" : "Mic 🎙️"}
          </button>
          <button onClick={onPropose} className="px-3 py-2 border rounded" title="Ctrl/Cmd+Enter">
            Propose
          </button>
          <button onClick={onExplain} className="px-3 py-2 border rounded">
            Explain
          </button>
          {intent && (
            <span className="text-xs px-2 py-1 border rounded ml-2">
              Intent: CTA {intent.cta} • CLAIM {intent.claim}
              {intent.riskyClaims ? ` ⚠︎${intent.riskyClaims}` : ""} • PRICE {intent.price} • FEAT {intent.feature}
            </span>
          )}
          <span className="text-sm opacity-70 ml-auto">{status}</span>
        </div>

        {/* Code + Context */}
        <div className="grid grid-cols-2 gap-0 flex-1">
          <textarea
            ref={leftTextRef}
            value={content}
            readOnly
            className="font-mono text-sm p-3 outline-none resize-none w-full h-full"
            spellCheck={false}
          />
          <div className="border-l h-full flex flex-col">
            <div className="p-2 text-sm font-semibold border-b">Proposal / Explain / A/B / Tests / History</div>

            {explainLines.length > 0 && (
              <pre className="p-3 text-xs opacity-80 whitespace-pre-wrap border-b max-h-28 overflow-auto">{explainLines.join("\n")}</pre>
            )}

            {/* Proposal */}
            {!proposal ? (
              <div className="p-3 text-sm opacity-70 border-b">No proposal yet.</div>
            ) : (
              <>
                <div className="p-3 text-xs opacity-80 space-y-1">
                  {proposal.summary.map((s: string, i: number) => (
                    <div key={i}>• {s}</div>
                  ))}
                  {outcomeHint && (
                    <div className="px-2 py-1 text-xs border rounded bg-gray-50 mx-3 my-1">{outcomeHint.text}</div>
                  )}
                </div>
                <textarea
                  value={proposal.newContent}
                  readOnly
                  className="font-mono text-sm p-3 outline-none resize-none h-52 w-full"
                  spellCheck={false}
                />
                <div className="p-2 border-t flex flex-wrap gap-2">
                  {!abId ? (
                    <>
                      <input
                        value={abNote}
                        onChange={(e) => setAbNote(e.target.value)}
                        placeholder="A/B note (optional)"
                        className="flex-1 border px-2 py-1 rounded text-xs"
                      />
                      <button onClick={onDryRun} className="px-3 py-2 border rounded">
                        Apply (Dry-run)
                      </button>
                      <button onClick={onCommit} className="px-3 py-2 border rounded">
                        Commit
                      </button>
                      <button onClick={onAbStart} className="px-3 py-2 border rounded">
                        Start A/B (A=current, B=proposal)
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-xs">
                        Experiment: <span className="font-mono">{abId}</span>
                      </div>
                      <button onClick={() => onAbMark("A", "seen")} className="px-2 py-1 border rounded text-xs">
                        Seen A
                      </button>
                      <button onClick={() => onAbMark("A", "convert")} className="px-2 py-1 border rounded text-xs">
                        Convert A
                      </button>
                      <button onClick={() => onAbMark("B", "seen")} className="px-2 py-1 border rounded text-xs">
                        Seen B
                      </button>
                      <button onClick={() => onAbMark("B", "convert")} className="px-2 py-1 border rounded text-xs">
                        Convert B
                      </button>
                      {abStatsState && (
                        <span className="text-xs px-2 py-1 border rounded">
                          A: {abStatsState.A.convert}/{abStatsState.A.seen} ({(abStatsState.A.cr * 100).toFixed(1)}%) • B:{" "}
                          {abStatsState.B.convert}/{abStatsState.B.seen} ({(abStatsState.B.cr * 100).toFixed(1)}%)
                        </span>
                      )}
                      <button
                        disabled={!bBeatsA || !proposal}
                        onClick={onCommit}
                        className="px-2 py-1 border rounded text-xs disabled:opacity-50"
                        title="Commits the proposal (Variant B) if B is winning"
                      >
                        Promote B (commit)
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Tests panel */}
            <div className="p-2 border-t">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Tests</div>
                <div className="text-xs opacity-70">{testStatus}</div>
              </div>
              {!activePath ? (
                <div className="text-xs opacity-60 mt-2">Open a file to generate tests.</div>
              ) : (
                <>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="px-3 py-2 border rounded text-sm"
                      onClick={async () => {
                        setTestStatus("Proposing tests…");
                        try {
                          const j = await testsPropose(activePath);
                          if (j.ok) {
                            setTestProposal({ path: j.testPath, newContent: j.newContent, summary: j.summary || [] });
                            setTestStatus("Proposed");
                          } else {
                            setTestStatus(j.error || "tests_propose_failed");
                          }
                        } catch {
                          setTestStatus("tests_propose_failed");
                        }
                      }}
                    >
                      Propose Tests (Vitest)
                    </button>
                    {!!testProposal && (
                      <button
                        className="px-3 py-2 border rounded text-sm"
                        onClick={async () => {
                          if (!testProposal) return;
                          setTestStatus("Applying tests…");
                          try {
                            const j = await testsApply(testProposal.path, testProposal.newContent, false);
                            setTestStatus(j.ok ? `Wrote ${testProposal.path}` : (j.error + (Array.isArray(j.reasons) ? ": " + j.reasons.join("; ") : "")));
                          } catch {
                            setTestStatus("tests_apply_failed");
                          }
                        }}
                      >
                        Apply Tests
                      </button>
                    )}
                  </div>
                  {testProposal && (
                    <div className="mt-3">
                      <div className="text-xs opacity-70 mb-1">
                        {testProposal.summary?.map((s, i) => (
                          <span key={i} className="mr-2">
                            • {s}
                          </span>
                        ))}
                      </div>
                      <div className="text-xs mb-1 opacity-80">
                        Path: <span className="font-mono">{testProposal.path}</span>
                      </div>
                      <textarea
                        value={testProposal.newContent}
                        readOnly
                        className="font-mono text-xs p-3 outline-none resize-none w-full h-48 border rounded"
                        spellCheck={false}
                      />
                      <div className="text-[11px] opacity-60 mt-2">
                        Run locally: <code>npx vitest</code> (or <code>npm test</code>) • jsdom env pre-set in scaffold
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Migrations (repo-wide) */}
            <div className="p-2 border-t">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Migrations (repo-wide)</div>
                <div className="text-xs opacity-70">{migStatus}</div>
              </div>

              <div className="mt-2 grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
                <input
                  value={migFind}
                  onChange={(e) => setMigFind(e.target.value)}
                  placeholder="Find (text or regex)"
                  className="md:col-span-2 border px-2 py-1 rounded text-sm"
                />
                <input
                  value={migReplace}
                  onChange={(e) => setMigReplace(e.target.value)}
                  placeholder="Replace with"
                  className="md:col-span-2 border px-2 py-1 rounded text-sm"
                />
                <input
                  value={migDir}
                  onChange={(e) => setMigDir(e.target.value)}
                  placeholder="Dir prefix (optional)"
                  className="border px-2 py-1 rounded text-sm"
                />
                <label className="text-xs flex items-center gap-1">
                  <input type="checkbox" checked={migRegex} onChange={() => setMigRegex((v) => !v)} /> Regex
                </label>
                <label className="text-xs flex items-center gap-1">
                  <input type="checkbox" checked={migCase} onChange={() => setMigCase((v) => !v)} /> Case-sensitive
                </label>
                <div className="flex gap-2">
                  <button
                    className="px-3 py-2 border rounded text-sm"
                    onClick={async () => {
                      setMigStatus("Previewing…");
                      try {
                        const j = await migratePreview({
                          find: migFind,
                          replace: migReplace,
                          regex: migRegex,
                          caseSensitive: migCase,
                          dirPrefix: migDir || undefined,
                          maxFiles: 500,
                        });
                        if (j.ok) {
                          setMigPrev(j);
                          setMigStatus(`Preview: ${j.changed}/${j.total} files will change`);
                        } else setMigStatus(j.error || "preview failed");
                      } catch {
                        setMigStatus("preview failed");
                      }
                    }}
                  >
                    Preview
                  </button>
                  <button
                    className="px-3 py-2 border rounded text-sm"
                    onClick={async () => {
                      setMigStatus("Contracts check…");
                      const proof = await runContractsCheck();
                      if (!proof.ok) {
                        setMigStatus(proof.reason || "Blocked by contracts");
                        return;
                      }
                      setMigStatus("Applying…");
                      try {
                        const j = await migrateApply({
                          find: migFind,
                          replace: migReplace,
                          regex: migRegex,
                          caseSensitive: migCase,
                          dirPrefix: migDir || undefined,
                          maxFiles: 500,
                        });
                        setMigStatus(j.ok ? `Applied to ${j.touched} file(s)` : j.error || "apply failed");
                      } catch {
                        setMigStatus("apply failed");
                      }
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>

              {migPrev && (
                <div className="mt-2 text-xs">
                  <div className="opacity-70 mb-1">Will change {migPrev.changed}/{migPrev.total} files (showing top 50)</div>
                  <div className="max-h-36 overflow-auto border rounded">
                    <ul className="divide-y">
                      {migPrev.items.slice(0, 50).map((it) => (
                        <li key={it.path} className="px-2 py-1 flex justify-between">
                          <span className="font-mono truncate">{it.path}</span>
                          <span className="opacity-70">hits: {it.hits}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* History panel */}
            <div className="p-2 border-t">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">History</div>
                <div className="flex items-center gap-3">
                  <label className="text-xs flex items-center gap-1">
                    <input type="checkbox" checked={historyFilterActive} onChange={() => setHistoryFilterActive((v) => !v)} />
                    This file only
                  </label>
                  <div className="text-xs opacity-70">{historyStatus}</div>
                </div>
              </div>
              {filteredHistory.length === 0 ? (
                <div className="text-xs opacity-60 mt-2">No snapshots yet. Commit a proposal to record.</div>
              ) : (
                <div className="mt-2 space-y-2 max-h-52 overflow-auto">
                  {filteredHistory.map((s) => (
                    <div key={s.id} className="border rounded p-2">
                      <div className="text-xs flex flex-wrap gap-2">
                        <span className="font-mono">{new Date(s.ts).toLocaleTimeString()}</span>
                        <span className="opacity-70">{s.path}</span>
                        <span className="opacity-70">Δ {Math.abs(s.after.length - s.before.length)} chars</span>
                        {s.intent && (
                          <span className="opacity-70">
                            Intent: CTA {s.intent.cta} • CLAIM {s.intent.claim}
                            {s.intent.riskyClaims ? ` ⚠︎${s.intent.riskyClaims}` : ""} • PRICE {s.intent.price} • FEAT {s.intent.feature}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] opacity-80 mt-1">
                        {s.summary.map((x, i) => (
                          <span key={i} className="mr-2">
                            • {x}
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button onClick={() => openDiff(s)} className="px-2 py-1 border rounded text-xs">
                          Diff
                        </button>
                        <button onClick={() => revertToBefore(s)} className="px-2 py-1 border rounded text-xs">
                          Revert to Before
                        </button>
                        <button onClick={() => reapplyAfter(s)} className="px-2 py-1 border rounded text-xs">
                          Apply After
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Diff & Cherry-pick */}
              {selectedSnap && diffHunksState && (
                <div className="mt-3 border rounded">
                  <div className="px-2 py-1 border-b text-xs flex items-center justify-between">
                    <div>
                      Diff: {selectedSnap.path} • {diffHunksState.length} hunk(s)
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="px-2 py-1 border rounded text-xs"
                        onClick={() => {
                          const all = diffHunksState.reduce((acc, h) => {
                            acc[h.idx] = true;
                            return acc;
                          }, {} as Record<number, boolean>);
                          setSelectedHunks(all);
                        }}
                      >
                        Select all
                      </button>
                      <button className="px-2 py-1 border rounded text-xs" onClick={() => setSelectedHunks({})}>
                        Deselect
                      </button>
                    </div>
                  </div>
                  <div className="max-h-56 overflow-auto text-[12px] font-mono">
                    {diffHunksState.map((h) => (
                      <div key={h.idx} className="border-b">
                        <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 sticky top-0">
                          <input
                            type="checkbox"
                            checked={!!selectedHunks[h.idx]}
                            onChange={(e) => setSelectedHunks((prev) => ({ ...prev, [h.idx]: e.target.checked }))}
                          />
                          <span className="opacity-70">
                            @@ -{h.aStart + 1},{h.aLen} +{h.bStart + 1},{h.bLen} @@
                          </span>
                        </div>
                        <pre className="px-2 py-1">{h.lines.map((ln) => `${ln.sign} ${ln.text}`).join("\n")}</pre>
                      </div>
                    ))}
                  </div>
                  <div className="px-2 py-2 border-t flex items-center gap-2">
                    <button className="px-3 py-2 border rounded text-xs" onClick={() => cherryPickSelected(selectedSnap)}>
                      Apply Selected Hunks
                    </button>
                    <button
                      className="px-3 py-2 border rounded text-xs"
                      onClick={() => {
                        setSelectedSnap(null);
                        setDiffHunksState(null);
                        setSelectedHunks({});
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Preview */}
      <div className="border-l flex flex-col">
        <div className="p-2 text-sm font-semibold border-b flex items-center gap-2">
          <span>Preview</span>
          <button onClick={togglePerf} className="px-2 py-1 border rounded text-xs">
            Perf {perfOn ? `• LCP ${lcpMs}ms • CLS ${clsFmt}` : ""}
          </button>
          <button onClick={toggleA11y} className="px-2 py-1 border rounded text-xs">
            A11y {a11yOn ? "• highlighting" : ""}
          </button>
        </div>
        <iframe ref={previewRef} src={previewUrl} className="w-full flex-1" />
      </div>

      {/* Quick Open modal */}
      {showQO && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center pt-24 z-50">
          <div className="w-[720px] bg-white rounded-xl shadow-xl border overflow-hidden">
            <div className="border-b">
              <input
                autoFocus
                value={qoQuery}
                onChange={(e) => {
                  setQoQuery(e.target.value);
                  setQoSel(0);
                }}
                onKeyDown={qoKey}
                placeholder="Type a file name… (Enter to open, Esc to close)"
                className="w-full px-4 py-3 outline-none"
              />
            </div>
            <div className="max-h-80 overflow-auto">
              {qoMatches.length === 0 ? (
                <div className="px-4 py-6 text-sm opacity-60">No matches</div>
              ) : (
                <ul>
                  {qoMatches.map((f, i) => (
                    <li
                      key={f.path}
                      onClick={() => qoOpenSelected(i)}
                      className={`px-4 py-2 cursor-pointer text-sm ${i === qoSel ? "bg-gray-100" : "hover:bg-gray-50"}`}
                      title={f.path}
                    >
                      <span className="font-medium">{f.name}</span>
                      <span className="opacity-60 ml-2">{f.path}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- helpers ----
function Tree({ node, onOpen }: { node: TreeNode; onOpen: (p: string) => void }) {
  if (!node) return null;
  return (
    <ul className="text-sm">
      {node.children?.map((c) => (
        <li key={c.path}>
          {c.type === "dir" ? (
            <details open>
              <summary className="cursor-pointer">{c.name}</summary>
              <Tree node={c} onOpen={onOpen} />
            </details>
          ) : (
            <button className="text-left hover:underline" onClick={() => onOpen(c.path)}>
              {c.name}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function scrollEditorToLine(el: HTMLTextAreaElement | null, fullText: string, line: number) {
  if (!el) return;
  const lines = fullText.split("\n");
  const clamped = Math.max(1, Math.min(line, lines.length));
  const charsBefore = lines.slice(0, clamped - 1).join("\n").length + (clamped - 1);
  el.selectionStart = el.selectionEnd = charsBefore;
  const perLine = 18;
  el.scrollTop = Math.max(0, (clamped - 5) * perLine);
}
