// client/src/components/library/PreviewsLibrary.tsx
import { useEffect, useState } from "react";
import { exportZip, enqueueDeploy, getDeployJob } from "@/lib/previewsActions";
import { aiScaffold, aiReview } from "@/lib/aiActions";
import { useToast } from "@/hooks/use-toast";
import DeployDrawer from "@/components/previews/DeployDrawer";
import QuickEditDialog from "@/components/previews/QuickEditDialog";
import QuickStyleDialog from "@/components/previews/QuickStyleDialog";
import { Button } from "@/components/ui/button";

type DeployInfo = { provider: "netlify" | "vercel"; url?: string; adminUrl?: string; createdAt: number };
type StoredPreview = {
  id: string;
  name: string;
  previewPath: string;
  createdAt: number;
  deploys?: DeployInfo[];
  issuesCount?: number;
};

type PatchOp = { file: string; find: string; replace: string; isRegex?: boolean };
type ReviewIssue = { type: string; msg: string; fix?: string; ops?: PatchOp[] };

const STORE_KEY = "ybuilt.previews";
const TIER_KEY = "ybuilt.aiTier";

const load = (): StoredPreview[] => {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  } catch {
    return [];
  }
};
const setSorted = (items: StoredPreview[]) => [...items].sort((a, b) => b.createdAt - a.createdAt);
const save = (items: StoredPreview[]) => localStorage.setItem(STORE_KEY, JSON.stringify(items));
const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
const openOrNavigate = (url: string) => {
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (!w) window.location.href = url;
};
function rename(items: StoredPreview[], previewPath: string, newName: string) {
  return items.map((p) => (p.previewPath === previewPath ? { ...p, name: newName } : p));
}

export default function PreviewsLibrary() {
  const { toast } = useToast();
  const [items, setItems] = useState<StoredPreview[]>(setSorted(load()));

  // drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerProvider, setDrawerProvider] = useState<"netlify" | "vercel">("netlify");
  const [drawerState, setDrawerState] = useState<"idle" | "starting" | "success" | "error">("idle");
  const [drawerMsg, setDrawerMsg] = useState<string | undefined>();
  const [drawerUrl, setDrawerUrl] = useState<string | undefined>();
  const [drawerAdminUrl, setDrawerAdminUrl] = useState<string | undefined>();

  // quick edit
  const [editOpen, setEditOpen] = useState(false);
  const [editPath, setEditPath] = useState<string | null>(null);
  const [editInitialFile, setEditInitialFile] = useState<string | undefined>(undefined);

  // quick style
  const [styleOpen, setStyleOpen] = useState(false);
  const [stylePath, setStylePath] = useState<string | null>(null);
  const [styleFile, setStyleFile] = useState<string | null>(null);

  // AI tier
  const [aiTier, setAiTier] = useState<"mock" | "fast" | "balanced" | "best">(
    (localStorage.getItem(TIER_KEY) as any) || "mock"
  );

  // AI review modal
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issues, setIssues] = useState<ReviewIssue[]>([]);
  const [issuesErr, setIssuesErr] = useState<string | undefined>();
  const [reviewPath, setReviewPath] = useState<string | null>(null);

  // Sections modal
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [sectionsPath, setSectionsPath] = useState<string | null>(null);
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [pickedSections, setPickedSections] = useState<Record<string, boolean>>({});

  // search
  const [q, setQ] = useState("");

  useEffect(() => {
    const onStorage = () => setItems(setSorted(load()));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function updatePreview(previewPath: string, mut: (p: StoredPreview) => void) {
    setItems((prev) => {
      const next = prev.map((p) => {
        if (p.previewPath === previewPath) {
          const clone = { ...p, deploys: p.deploys ? [...p.deploys] : [] };
          mut(clone);
          return clone;
        }
        return p;
      });
      const sorted = setSorted(next);
      save(sorted);
      return sorted;
    });
  }

  // ---- server file ops
  async function readFile(previewPath: string, file: string) {
    const r = await fetch(
      `/api/previews/read?path=${encodeURIComponent(previewPath)}&file=${encodeURIComponent(file)}`
    );
    const data = await r.json();
    if (!r.ok || !data?.ok) throw new Error(data?.error || "read failed");
    return String(data.content ?? "");
  }
  async function writeFile(previewPath: string, file: string, content: string) {
    const r = await fetch("/api/previews/write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: previewPath, file, content }),
    });
    const data = await r.json();
    if (!r.ok || !data?.ok) throw new Error(data?.error || "write failed");
  }
  async function listFiles(previewPath: string): Promise<string[]> {
    const r = await fetch(`/api/previews/list?path=${encodeURIComponent(previewPath)}`);
    const data = await r.json();
    if (!r.ok || !data?.ok) throw new Error(data?.error || "list failed");
    return data.files || [];
  }
  async function duplicatePreview(previewPath: string) {
    const r = await fetch("/api/previews/duplicate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: previewPath }),
    });
    const data = await r.json();
    if (!r.ok || !data?.ok || !data?.path) throw new Error(data?.error || "duplicate failed");
    return data.path as string;
  }

  async function ensureAsset(previewPath: string, kind: "css" | "js") {
    const files = await listFiles(previewPath);
    const candidates =
      kind === "css" ? ["styles.css", "css.css", "main.css"] : ["app.js", "main.js", "script.js"];
    let picked = files.find((f) => f.toLowerCase().endsWith(`.${kind}`)) || candidates[0];

    if (!files.includes(picked)) {
      const starter =
        kind === "css"
          ? `/* ${picked} */\n:root{color-scheme:light dark}\nbody{font-family:system-ui,sans-serif}\n`
          : `// ${picked}\nconsole.log("Hello from ${picked}")\n`;
      await writeFile(previewPath, picked, starter);
    }

    // ensure index.html has tag
    let html: string;
    try {
      html = await readFile(previewPath, "index.html");
    } catch {
      html = `<!doctype html><meta charset="utf-8"/><title>Preview</title><body><h1>Hello</h1></body>`;
    }
    const hasTag =
      kind === "css"
        ? new RegExp(`<link[^>]+href=["']${picked}["']`, "i").test(html)
        : new RegExp(`<script[^>]+src=["']${picked}["']`, "i").test(html);

    if (!hasTag) {
      if (kind === "css") {
        if (/<\/head>/i.test(html)) {
          html = html.replace(/<\/head>/i, ` <link rel="stylesheet" href="${picked}" />\n</head>`);
        } else {
          html = html
            .replace(/<head[^>]*>/i, (m) => `${m}\n <link rel="stylesheet" href="${picked}" />`)
            .replace(/<\/title>/i, (m) => `${m}\n<link rel="stylesheet" href="${picked}" />`);
          if (!/<head/i.test(html)) {
            html = `<!doctype html><head><meta charset="utf-8"/><link rel="stylesheet" href="${picked}" /></head>${html}`;
          }
        }
      } else {
        if (/<\/body>/i.test(html)) {
          html = html.replace(/<\/body>/i, ` <script src="${picked}"></script>\n</body>`);
        } else {
          html = html + `\n<script src="${picked}"></script>\n`;
        }
      }
      await writeFile(previewPath, "index.html", html);
    }

    return picked;
  }

  // --- apply AI patch operations to files ---
  async function applyOps(previewPath: string, ops: PatchOp[]) {
    let touched: Record<string, string> = {};
    let changedFiles: string[] = [];

    for (const op of ops) {
      // make sure target files exist when CSS/JS
      if (op.file.endsWith(".css")) await ensureAsset(previewPath, "css");
      if (op.file.endsWith(".js")) await ensureAsset(previewPath, "js");

      const before = touched[op.file] ?? (await readFile(previewPath, op.file).catch(() => ""));
      let after = before;

      // --- EOF append special-case ---
      if (op.find === "$$EOF$$" && !op.isRegex) {
        after = `${before.trimEnd()}\n${op.replace}`;
        if (after !== before) {
          touched[op.file] = after;
          if (!changedFiles.includes(op.file)) changedFiles.push(op.file);
        }
        continue;
      }

      if (op.isRegex) {
        const re = new RegExp(op.find, "g");
        if (!re.test(after)) throw new Error(`Pattern not found in ${op.file}: ${op.find}`);
        after = after.replace(re, op.replace);
      } else {
        if (!after.includes(op.find)) throw new Error(`Text not found in ${op.file}: ${op.find}`);
        after = after.split(op.find).join(op.replace);
      }

      if (after !== before) {
        touched[op.file] = after;
        if (!changedFiles.includes(op.file)) changedFiles.push(op.file);
      }
    }

    for (const f of changedFiles) {
      await writeFile(previewPath, f, touched[f]);
    }
    return changedFiles;
  }

  // deploy polling
  async function pollJobUntilDone(id: string, onUpdate: (j: any) => void) {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const j = await getDeployJob(id);
      onUpdate(j);
      if (j.status === "success" || j.status === "error") break;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  // deploy handlers
  async function handleDeployNetlify(it: StoredPreview) {
    setDrawerProvider("netlify");
    setDrawerState("starting");
    setDrawerMsg("Queuing…");
    setDrawerUrl(undefined);
    setDrawerAdminUrl(undefined);
    setDrawerOpen(true);

    try {
      const suggested = `ybuilt-${slugify(it.name)}`;
      const siteName = window.prompt("Netlify site name (optional)", suggested)?.trim() || suggested;
      const id = await enqueueDeploy("netlify", it.previewPath, siteName);

      await pollJobUntilDone(id, (j) => {
        if (j.status === "queued") {
          setDrawerState("starting"); setDrawerMsg("Queued…");
        } else if (j.status === "running") {
          setDrawerState("starting"); setDrawerMsg("Deploying…");
        } else if (j.status === "success") {
          const url = j?.result?.url;
          if (url) {
            updatePreview(it.previewPath, (p) => {
              p.deploys!.unshift({ provider: "netlify", url, adminUrl: undefined, createdAt: Date.now() });
            });
            setDrawerState("success"); setDrawerMsg("Deployed."); setDrawerUrl(url);
          } else {
            setDrawerState("error"); setDrawerMsg("No URL returned.");
          }
        } else if (j.status === "error") {
          setDrawerState("error"); setDrawerMsg(j?.error || "Deploy failed.");
        }
      });
    } catch (e: any) {
      setDrawerState("error"); setDrawerMsg(e?.message || "Deploy failed.");
    }
  }

  async function handleDeployVercel(it: StoredPreview) {
    setDrawerProvider("vercel");
    setDrawerState("starting");
    setDrawerMsg("Queuing…");
    setDrawerUrl(undefined);
    setDrawerAdminUrl(undefined);
    setDrawerOpen(true);

    try {
      const name = `ybuilt-${slugify(it.name)}`;
      const id = await enqueueDeploy("vercel", it.previewPath, name);

      await pollJobUntilDone(id, (j) => {
        if (j.status === "queued") {
          setDrawerState("starting"); setDrawerMsg("Queued…");
        } else if (j.status === "running") {
          setDrawerState("starting"); setDrawerMsg("Deploying…");
        } else if (j.status === "success") {
          const url = j?.result?.url;
          if (url) {
            updatePreview(it.previewPath, (p) => {
              p.deploys!.unshift({ provider: "vercel", url, adminUrl: undefined, createdAt: Date.now() });
            });
            setDrawerState("success"); setDrawerMsg("Deployed."); setDrawerUrl(url);
          } else {
            setDrawerState("error"); setDrawerMsg("No URL returned.");
          }
        } else if (j.status === "error") {
          setDrawerState("error"); setDrawerMsg(j?.error || "Deploy failed.");
        }
      });
    } catch (e: any) {
      setDrawerState("error"); setDrawerMsg(e?.message || "Deploy failed.");
    }
  }

  // AI review badge updater
  async function runReviewFor(previewPath: string, tier: string) {
    try {
      const html = await readFile(previewPath, "index.html").catch(() => "");
      const css = await readFile(previewPath, "styles.css").catch(() => "");
      const js = await readFile(previewPath, "app.js").catch(() => "");
      const bundle = `/* index.html */\n${html}\n\n/* styles.css */\n${css}\n\n/* app.js */\n${js}`;
      const { review } = await aiReview({ code: bundle, tier });
      const n = (review?.issues || []).length;
      updatePreview(previewPath, (p) => { p.issuesCount = n; });
    } catch {/* silent */}
  }

  // tokens helper
  async function applyTokens(previewPath: string) {
    const planRaw = await readFile(previewPath, "plan.json").catch(() => "{}");
    const plan = (() => { try { return JSON.parse(planRaw); } catch { return {}; } })();
    const tokens = (plan as any).tokens || {};
    const primary = window.prompt("Primary color (CSS value)", tokens.primary || "#4f46e5")?.trim();
    if (!primary) return;
    const radius = window.prompt("Corner radius (e.g., 10px)", tokens.radius || "10px")?.trim() || "10px";
    const fontSize = window.prompt("Base font size (e.g., 16px)", tokens.fontSize || "16px")?.trim() || "16px";
    (plan as any).tokens = { primary, radius, fontSize };
    await writeFile(previewPath, "plan.json", JSON.stringify(plan, null, 2));

    const cssFile = await ensureAsset(previewPath, "css");
    const cssRaw = await readFile(previewPath, cssFile).catch(() => "");
    const block = `/* @tokens:start */\n:root{--color-primary:${primary};--radius:${radius};--font-size:${fontSize}}\n/* @tokens:end */`;
    const stripped = cssRaw.replace(/\/\* @tokens:start \*\/[\s\S]*?\/\* @tokens:end \*\//, "").trim();
    const nextCss = `${block}\n\n${stripped}`;
    await writeFile(previewPath, cssFile, nextCss);
  }

  // sections modal opener
  async function openSectionsModal(previewPath: string) {
    const raw = await readFile(previewPath, "plan.json").catch(() => "");
    let plan: any = null;
    try { plan = raw ? JSON.parse(raw) : null; } catch { plan = null; }

    const known = ["hero", "features", "pricing", "faq", "testimonials", "cta"];
    const fromPlan = Array.isArray(plan?.sections)
      ? Array.from(
          new Set(
            plan.sections
              .map((s: any) => (s?.type || s?.id || "").toString().toLowerCase().trim())
              .filter((x: string) => known.includes(x))
          )
        )
      : [];

    const avail = fromPlan.length ? fromPlan : known;
    const defaults: Record<string, boolean> = {};
    for (const k of avail) defaults[k] = fromPlan.length ? fromPlan.includes(k) : true;

    setAvailableSections(avail);
    setPickedSections(defaults);
    setSectionsPath(previewPath);
    setSectionsOpen(true);
  }

  // rebuilds
  async function handleRebuild(it: StoredPreview) {
    try {
      let plan: any = null;
      try {
        const r = await fetch(`/api/previews/read?path=${encodeURIComponent(it.previewPath)}&file=plan.json`);
        const d = await r.json();
        if (r.ok && d?.ok && d?.content) plan = JSON.parse(String(d.content));
      } catch {}
      const payload = plan ? { plan } : { prompt: it.name || "AI page" };
      const { path } = await aiScaffold({ ...payload, tier: aiTier });

      const item: StoredPreview = {
        id: `ai-${Date.now()}`,
        name: (plan?.title || it.name || "AI page").slice(0, 40),
        previewPath: path,
        createdAt: Date.now(),
        deploys: [],
      };
      setItems((prev) => {
        const next = setSorted([item, ...prev]);
        localStorage.setItem(STORE_KEY, JSON.stringify(next));
        return next;
      });

      runReviewFor(path, aiTier);
      openOrNavigate(path);
    } catch (e: any) {
      toast({ title: "Rebuild failed", description: e?.message || "error", variant: "destructive" });
    }
  }

  async function handleCheckIssues(it: StoredPreview) {
    setIssuesOpen(true);
    setIssuesLoading(true);
    setIssuesErr(undefined);
    setIssues([]);
    setReviewPath(it.previewPath);

    try {
      const html = await readFile(it.previewPath, "index.html").catch(() => "");
      const css = await readFile(it.previewPath, "styles.css").catch(() => "");
      const js = await readFile(it.previewPath, "app.js").catch(() => "");
      const bundle = `/* index.html */\n${html}\n\n/* styles.css */\n${css}\n\n/* app.js */\n${js}`;
      const { review } = await aiReview({ code: bundle, tier: aiTier });
      setIssues(review?.issues || []);
    } catch (e: any) {
      setIssuesErr(e?.message || "review failed");
    } finally {
      setIssuesLoading(false);
    }
  }

  // Guess file to open from an issue
  function guessFileFromIssue(i: { type: string; msg: string }): "index.html" | "styles.css" | "app.js" {
    const m = (i.msg + " " + i.type).toLowerCase();
    if (m.includes("css")) return "styles.css";
    if (m.includes("js") || m.includes("script")) return "app.js";
    return "index.html";
  }

  // Background review on load for items without a count
  useEffect(() => {
    items.forEach((it) => {
      if (typeof it.issuesCount !== "number") {
        runReviewFor(it.previewPath, aiTier);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, aiTier]);

  // ----- UI -----
  if (items.length === 0) {
    return (
      <div className="bg-black/30 backdrop-blur-md rounded-lg border border-white/20 p-6 text-center text-white/80">
        <div className="text-lg font-semibold mb-2">No previews yet</div>
        <div className="text-sm mb-4">Fork a template or build an AI page to see it here.</div>
        <div className="flex flex-wrap gap-2 justify-center">
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              try {
                const r = await fetch("/api/previews/fork", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ sourceId: "hello-world" }),
                });
                const data = await r.json();
                if (!r.ok || !data?.path) throw new Error(data?.error || "fork failed");
                const item: StoredPreview = {
                  id: `fork-${Date.now()}`,
                  name: "Hello World",
                  previewPath: data.path,
                  createdAt: Date.now(),
                  deploys: [],
                };
                setItems((prev) => {
                  const next = setSorted([item, ...prev]);
                  localStorage.setItem(STORE_KEY, JSON.stringify(next));
                  return next;
                });
                openOrNavigate(data.path);
              } catch (e: any) {
                alert(e?.message || "Couldn’t fork Hello World");
              }
            }}
          >
            Quick start: Hello World
          </Button>
        </div>
      </div>
    );
  }

  const filtered = items.filter(
    (it) =>
      it.name.toLowerCase().includes(q.toLowerCase()) ||
      it.previewPath.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex items-center justify-between bg-black/30 backdrop-blur-md rounded-lg border border-white/20 p-3">
        <div className="text-sm text-white/80">
          {filtered.length} preview{filtered.length === 1 ? "" : "s"}
        </div>
        <div className="flex items-center gap-2">
          <input
            className="text-sm px-2 py-1 rounded bg-black/30 border border-white/20 text-white"
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <select
            className="text-sm px-2 py-1 rounded bg-black/30 border border-white/20 text-white"
            value={aiTier}
            onChange={(e) => {
              const v = e.target.value as any;
              setAiTier(v);
              localStorage.setItem(TIER_KEY, v);
            }}
            title="AI Tier"
          >
            <option value="mock">Mock</option>
            <option value="fast">Fast</option>
            <option value="balanced">Balanced</option>
            <option value="best">Best</option>
          </select>

          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              const prompt = window
                .prompt("What should we build? (e.g., SaaS landing with hero, features, pricing)")
                ?.trim();
              if (!prompt) return;

              const blocksStr =
                window
                  .prompt(
                    "Which sections? (comma-separated) hero, features, pricing, faq, testimonials, cta",
                    "hero, features, cta"
                  )
                  ?.toLowerCase() || "";
              const blocks = blocksStr.split(",").map((s) => s.trim()).filter(Boolean);

              try {
                const { path } = await aiScaffold({ prompt, tier: aiTier, blocks } as any);
                const item: StoredPreview = {
                  id: `ai-${Date.now()}`,
                  name: prompt.slice(0, 40),
                  previewPath: path,
                  createdAt: Date.now(),
                  deploys: [],
                };
                setItems((prev) => {
                  const next = setSorted([item, ...prev]);
                  localStorage.setItem(STORE_KEY, JSON.stringify(next));
                  return next;
                });
                runReviewFor(path, aiTier);
                openOrNavigate(path);
              } catch (e: any) {
                toast({ title: "AI scaffold failed", description: e?.message || "Error", variant: "destructive" });
              }
            }}
          >
            New → AI Page (Orch)
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              if (!confirm("Delete ALL previews from disk and clear the list?")) return;
              try {
                await Promise.all(
                  items.map((it) =>
                    fetch("/api/previews/delete", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ path: it.previewPath }),
                    })
                  )
                );
              } catch {}
              setItems([]);
              localStorage.setItem(STORE_KEY, JSON.stringify([]));
              toast({ title: "Cleared", description: "All previews removed." });
            }}
          >
            Clear all
          </Button>
        </div>
      </div>

      {/* grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((it, idx) => (
          <div
            key={idx}
            className="bg-black/30 backdrop-blur-md rounded-lg border border-white/20 p-4 flex flex-col gap-3"
          >
            <div className="min-w-0">
              <div className="font-semibold text-white truncate">{it.name}</div>
              <a
                className="text-[11px] text-blue-300 underline break-all"
                href={it.previewPath}
                target="_blank"
                rel="noreferrer"
              >
                {it.previewPath}
              </a>

              {!!(typeof it.issuesCount === "number") && (
                <Button
                  size="sm" variant="ghost"
                  className="mt-2 h-6 px-2 text-[10px] border border-white/20"
                  title="Open AI Review"
                  onClick={() => handleCheckIssues(it)}
                >
                  Issues ({it.issuesCount})
                </Button>
              )}

              {!!it.deploys?.length && (
                <div className="mt-2 text-[11px] text-white/70">
                  Last deploy: {it.deploys[0].provider} → {it.deploys[0].url || "—"}
                </div>
              )}
            </div>

            {/* actions */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => { setEditPath(it.previewPath); setEditInitialFile("index.html"); setEditOpen(true); }}>
                Edit HTML
              </Button>
              <Button size="sm" variant="secondary" onClick={() => { setEditPath(it.previewPath); setEditInitialFile("plan.json"); setEditOpen(true); }}>
                Edit Plan
              </Button>
              <Button size="sm" variant="secondary" onClick={() => applyTokens(it.previewPath)} title="Set primary color, radius, font-size">
                Tokens
              </Button>
              <Button size="sm" variant="secondary" onClick={async () => {
                try {
                  const f = await ensureAsset(it.previewPath, "css");
                  setEditPath(it.previewPath); setEditInitialFile(f); setEditOpen(true);
                  toast({ title: "CSS ready", description: f });
                } catch (e: any) {
                  toast({ title: "CSS setup failed", description: e?.message || "Error", variant: "destructive" });
                }
              }}>Edit CSS</Button>
              <Button size="sm" variant="secondary" onClick={async () => {
                try {
                  const f = await ensureAsset(it.previewPath, "css");
                  setStylePath(it.previewPath); setStyleFile(f); setStyleOpen(true);
                } catch (e: any) {
                  toast({ title: "Style panel failed", description: e?.message || "Error", variant: "destructive" });
                }
              }}>Style Tweaks</Button>
              <Button size="sm" variant="secondary" onClick={async () => {
                try {
                  const f = await ensureAsset(it.previewPath, "js");
                  setEditPath(it.previewPath); setEditInitialFile(f); setEditOpen(true);
                  toast({ title: "JS ready", description: f });
                } catch (e: any) {
                  toast({ title: "JS setup failed", description: e?.message || "Error", variant: "destructive" });
                }
              }}>Edit JS</Button>
              <Button size="sm" variant="secondary" onClick={() => openOrNavigate(it.previewPath)}>
                Open
              </Button>
              <Button size="sm" variant="secondary" onClick={async () => {
                try {
                  await navigator.clipboard.writeText(it.previewPath);
                  toast({ title: "Link copied", description: it.previewPath });
                } catch {
                  prompt("Copy link:", it.previewPath);
                }
              }}>
                Share
              </Button>
              <Button size="sm" variant="secondary" onClick={async () => {
                try {
                  const newPath = await duplicatePreview(it.previewPath);
                  const nextItem: StoredPreview = {
                    id: `dup-${Date.now()}`, name: `${it.name} (Copy)`, previewPath: newPath, createdAt: Date.now(), deploys: [],
                  };
                  setItems((prev) => {
                    const next = setSorted([nextItem, ...prev]);
                    localStorage.setItem(STORE_KEY, JSON.stringify(next));
                    return next;
                  });
                  toast({ title: "Duplicated", description: newPath });
                  try { await navigator.clipboard.writeText(newPath); } catch { prompt("Copy link:", newPath); }
                  openOrNavigate(newPath);
                } catch (e: any) {
                  toast({ title: "Duplicate failed", description: e?.message || "Error", variant: "destructive" });
                }
              }}>
                Duplicate
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handleRebuild(it)}>
                Rebuild (AI)
              </Button>
              <Button size="sm" variant="secondary" onClick={() => openSectionsModal(it.previewPath)} title="Pick sections, then rebuild">
                Rebuild (Sections)
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handleCheckIssues(it)}>
                Check issues (AI)
              </Button>
              <Button size="sm" variant="secondary" onClick={() =>
                exportZip(it.previewPath).catch((e) =>
                  toast({ title: "Export", description: String(e?.message || e), variant: "destructive" })
                )
              }>
                Export ZIP
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handleDeployNetlify(it)}>
                Deploy → Netlify
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handleDeployVercel(it)}>
                Deploy → Vercel
              </Button>
              <Button size="sm" variant="secondary" onClick={() => {
                const newName = window.prompt("New name", it.name || "Untitled")?.trim();
                if (!newName) return;
                setItems((prev) => {
                  const next = setSorted(rename(prev, it.previewPath, newName));
                  save(next);
                  return next;
                });
                toast({ title: "Renamed", description: newName });
              }}>
                Rename
              </Button>
              <Button size="sm" variant="ghost" onClick={async () => {
                try {
                  const r = await fetch("/api/previews/delete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ path: it.previewPath }),
                  });
                  if (!r.ok) throw new Error(await r.text());
                  setItems((prev) => {
                    const next = setSorted(prev.filter((x) => x.previewPath !== it.previewPath));
                    localStorage.setItem(STORE_KEY, JSON.stringify(next));
                    return next;
                  });
                  toast({ title: "Deleted", description: it.name });
                } catch (e: any) {
                  toast({ title: "Delete failed", description: e?.message || "Error", variant: "destructive" });
                }
              }}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Sections modal (styled for library) */}
      {sectionsOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4">
          <div className="w-full max-w-lg rounded-lg bg-black/80 text-white border border-white/20 p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Rebuild with Sections</h3>
              <Button size="sm" variant="ghost" onClick={() => setSectionsOpen(false)}>Close</Button>
            </div>

            <div className="space-y-2 mb-3">
              {availableSections.map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!pickedSections[s]}
                    onChange={(e) => setPickedSections((prev) => ({ ...prev, [s]: e.target.checked }))}
                  />
                  <span className="capitalize">{s}</span>
                </label>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSectionsOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  if (!sectionsPath) return;
                  try {
                    const raw = await readFile(sectionsPath, "plan.json").catch(() => "");
                    let plan: any = null;
                    try { plan = raw ? JSON.parse(raw) : null; } catch { plan = null; }

                    const blocks = Object.keys(pickedSections).filter((k) => pickedSections[k]);
                    if (!blocks.length) { alert("Pick at least one section."); return; }

                    const payload = plan ? { plan } : { prompt: "AI page" };
                    const { path } = await aiScaffold({ ...(payload as any), blocks, tier: aiTier } as any);

                    const item: StoredPreview = {
                      id: `ai-${Date.now()}`,
                      name: (plan?.title || "AI page").slice(0, 40),
                      previewPath: path,
                      createdAt: Date.now(),
                      deploys: [],
                    };
                    setItems((prev) => {
                      const next = setSorted([item, ...prev]);
                      localStorage.setItem(STORE_KEY, JSON.stringify(next));
                      return next;
                    });

                    runReviewFor(path, aiTier);
                    openOrNavigate(path);
                    setSectionsOpen(false);
                  } catch (e: any) {
                    toast({ title: "Rebuild failed", description: e?.message || "error", variant: "destructive" });
                  }
                }}
              >
                Rebuild
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* AI Review modal (styled for library) */}
      {issuesOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4">
          <div className="w-full max-w-lg rounded-lg bg-black/80 text-white border border-white/20 p-4 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">AI Review</h3>
              <div className="flex items-center gap-2">
                {issues.some((it) => it.ops?.length) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      try {
                        if (!reviewPath) throw new Error("No preview selected");

                        // Build a safe-op set: only ops whose 'find' actually matches (or EOF)
                        const filesCache: Record<string, string> = {};
                        const allOps = issues.flatMap((it) => it.ops || []);
                        const safeOps: PatchOp[] = [];

                        for (const op of allOps) {
                          // ensure file exists if needed
                          if (op.file.endsWith(".css")) await ensureAsset(reviewPath, "css");
                          if (op.file.endsWith(".js"))  await ensureAsset(reviewPath, "js");

                          const before =
                            filesCache[op.file] ??
                            (await readFile(reviewPath, op.file).catch(() => ""));
                          filesCache[op.file] = before;

                          if (op.find === "$$EOF$$" && !op.isRegex) {
                            safeOps.push(op);
                            continue;
                          }
                          if (op.isRegex) {
                            const re = new RegExp(op.find, "g");
                            if (re.test(before)) safeOps.push(op);
                          } else {
                            if (before.includes(op.find)) safeOps.push(op);
                          }
                        }

                        if (!safeOps.length) {
                          toast({ title: "No safe fixes found", description: "Nothing matched." });
                          return;
                        }

                        const updatedFiles = await applyOps(reviewPath, safeOps);
                        toast({ title: "Applied", description: `Updated ${updatedFiles.join(", ")}` });

                        // Refresh counts + modal contents
                        await runReviewFor(reviewPath, aiTier);
                        await handleCheckIssues({ previewPath: reviewPath } as any);
                      } catch (e: any) {
                        toast({
                          title: "Fix all failed",
                          description: e?.message || "Error",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    Fix all (AI)
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setIssuesOpen(false)}>Close</Button>
              </div>
            </div>

            {issuesLoading && <div className="text-sm text-white/70">Analyzing…</div>}
            {issuesErr && <div className="text-sm text-red-400">Error: {issuesErr}</div>}

            {!issuesLoading && !issuesErr && (issues.length ? (
              <ul className="space-y-3">
                {issues.map((issue, i) => (
                  <li key={i} className="rounded border border-white/20 p-3 bg-black/60">
                    <div className="text-[11px] uppercase tracking-wide text-white/60">{issue.type}</div>
                    <div className="text-sm text-white">{issue.msg}</div>

                    {issue.fix && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="text-xs text-white/70 select-text break-words">{issue.fix}</div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            try { await navigator.clipboard.writeText(issue.fix!); toast({ title: "Copied fix" }); }
                            catch { /* noop */ }
                          }}
                        >
                          Copy fix
                        </Button>
                      </div>
                    )}

                    <div className="mt-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          const f = guessFileFromIssue(issue);
                          const path = reviewPath || editPath || items[0]?.previewPath || "/previews/";
                          if (f.endsWith(".css")) await ensureAsset(path, "css");
                          if (f.endsWith(".js")) await ensureAsset(path, "js");
                          setEditPath(path);
                          setEditInitialFile(f);
                          setEditOpen(true);
                        }}
                      >
                        Open in editor
                      </Button>
                    </div>

                    {/* Apply fix (when ops are provided) */}
                    {issue.ops?.length ? (
                      <div className="mt-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            try {
                              if (!reviewPath) throw new Error("No preview selected");
                              const files = await applyOps(reviewPath, issue.ops!);
                              toast({ title: "Applied", description: `Updated ${files.join(", ")}` });
                              // refresh badge + re-run focused review
                              await runReviewFor(reviewPath, aiTier);
                              await handleCheckIssues({ previewPath: reviewPath } as any);
                            } catch (e: any) {
                              toast({
                                title: "Couldn’t apply fix",
                                description: e?.message || "Patch failed",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          Apply fix
                        </Button>
                      </div>
                    ) : null}

                    {/* Heuristic fallback: append CSS when no ops are provided */}
                    {!issue.ops?.length && issue.fix?.includes("{") && (
                      <div className="mt-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            try {
                              if (!reviewPath) throw new Error("No preview selected");
                              const cssFile = await ensureAsset(reviewPath, "css");
                              const before = await readFile(reviewPath, cssFile).catch(() => "");
                              await writeFile(
                                reviewPath,
                                cssFile,
                                `${before.trim()}\n\n/* @ai-fix */\n${issue.fix!.trim()}\n`
                              );
                              toast({ title: "Fix appended to CSS" });
                              await runReviewFor(reviewPath, aiTier);
                            } catch (e: any) {
                              toast({ title: "Couldn’t append", description: e?.message || "Error", variant: "destructive" });
                            }
                          }}
                        >
                          Append to CSS
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-white/70">No issues found.</div>
            ))}
          </div>
        </div>
      )}

      <DeployDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        provider={drawerProvider}
        state={drawerState}
        message={drawerMsg}
        url={drawerUrl}
        adminUrl={drawerAdminUrl}
      />

      <QuickEditDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        previewPath={editPath || "/previews/"}
        initialFile={editInitialFile}
        onSaved={async () => { if (editPath) { runReviewFor(editPath, aiTier); } }}
      />

      <QuickStyleDialog
        open={styleOpen}
        onClose={() => setStyleOpen(false)}
        previewPath={stylePath || "/previews/"}
        file={styleFile || "styles.css"}
      />
    </div>
  );
}
