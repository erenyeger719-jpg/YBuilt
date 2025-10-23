import { useEffect, useState } from "react";
import { exportZip, enqueueDeploy, getDeployJob } from "@/lib/previewsActions";
import { aiScaffold, aiReview } from "@/lib/aiActions";
import { useToast } from "@/hooks/use-toast";
import DeployDrawer from "./DeployDrawer";
import QuickEditDialog from "./QuickEditDialog";
import QuickStyleDialog from "./QuickStyleDialog";

type DeployInfo = { provider: "netlify" | "vercel"; url?: string; adminUrl?: string; createdAt: number };
type StoredPreview = {
  id: string;
  name: string;
  previewPath: string;
  createdAt: number;
  deploys?: DeployInfo[];
  issuesCount?: number; // NEW
};

const STORE_KEY = "ybuilt.previews";
const TIER_KEY = "ybuilt.aiTier"; // NEW
const load = (): StoredPreview[] => {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  } catch {
    return [];
  }
};
const save = (items: StoredPreview[]) => localStorage.setItem(STORE_KEY, JSON.stringify(items));
const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
const openOrNavigate = (url: string) => {
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (!w) window.location.href = url;
};
function rename(items: StoredPreview[], previewPath: string, newName: string) {
  return items.map((p) => (p.previewPath === previewPath ? { ...p, name: newName } : p));
}

export default function PreviewsList() {
  const { toast } = useToast();
  const [items, setItems] = useState<StoredPreview[]>(load());

  // drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerProvider, setDrawerProvider] = useState<"netlify" | "vercel">("netlify");
  const [drawerState, setDrawerState] = useState<"idle" | "starting" | "success" | "error">("idle");
  const [drawerMsg, setDrawerMsg] = useState<string | undefined>();
  const [drawerUrl, setDrawerUrl] = useState<string | undefined>();
  const [drawerAdminUrl, setDrawerAdminUrl] = useState<string | undefined>();

  // quick edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editPath, setEditPath] = useState<string | null>(null);
  const [editInitialFile, setEditInitialFile] = useState<string | undefined>(undefined);

  // quick style state
  const [styleOpen, setStyleOpen] = useState(false);
  const [stylePath, setStylePath] = useState<string | null>(null);
  const [styleFile, setStyleFile] = useState<string | null>(null);

  // AI tier
  const [aiTier, setAiTier] = useState<"mock" | "fast" | "balanced" | "best">(
    (localStorage.getItem(TIER_KEY) as any) || "mock"
  );

  // AI review state
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issues, setIssues] = useState<{ type: string; msg: string; fix?: string }[]>([]);
  const [issuesErr, setIssuesErr] = useState<string | undefined>();

  // Sections-rebuild UI state
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [sectionsPath, setSectionsPath] = useState<string | null>(null);
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [pickedSections, setPickedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const onStorage = () => setItems(load());
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
      save(next);
      return next;
    });
  }

  // ---- server file ops + asset ensure helpers ----
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

  // NEW: duplicate helper
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

    // choose filename (prefer existing)
    const candidates =
      kind === "css" ? ["styles.css", "css.css", "main.css"] : ["app.js", "main.js", "script.js"];
    let picked = files.find((f) => f.toLowerCase().endsWith(`.${kind}`)) || candidates[0];

    // create starter if missing
    if (!files.includes(picked)) {
      const starter =
        kind === "css"
          ? `/* ${picked} */\n:root{color-scheme:light dark}\nbody{font-family:system-ui,sans-serif}\n`
          : `// ${picked}\nconsole.log("Hello from ${picked}")\n`;
      await writeFile(previewPath, picked, starter);
    }

    // make sure index.html exists
    let html: string;
    try {
      html = await readFile(previewPath, "index.html");
    } catch {
      html = `<!doctype html><meta charset="utf-8"/><title>Preview</title><body><h1>Hello</h1></body>`;
    }

    // inject tag if missing
    const hasTag =
      kind === "css"
        ? new RegExp(`<link[^>]+href=["']${picked}["']`, "i").test(html)
        : new RegExp(`<script[^>]+src=["']${picked}["']`, "i").test(html);

    if (!hasTag) {
      if (kind === "css") {
        // insert before </head> or at top
        if (/<\/head>/i.test(html)) {
          html = html.replace(/<\/head>/i, ` <link rel="stylesheet" href="${picked}" />\n</head>`);
        } else {
          html = html
            .replace(/<head[^>]*>/i, (match) => `${match}\n <link rel="stylesheet" href="${picked}" />`)
            .replace(/<\/title>/i, (m) => `${m}\n<link rel="stylesheet" href="${picked}" />`);
          if (!/<head/i.test(html)) {
            html = `<!doctype html><head><meta charset="utf-8"/><link rel="stylesheet" href="${picked}" /></head>${html}`;
          }
        }
      } else {
        // JS: insert before </body> or at bottom
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

  // ------- Deploy queue polling helper -------
  async function pollJobUntilDone(id: string, onUpdate: (j: any) => void) {
    // simple loop; breaks on success/error (MVP: no timeout)
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const j = await getDeployJob(id);
      onUpdate(j);
      if (j.status === "success" || j.status === "error") break;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  // ------- Deploy handlers (queued flow) -------
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

      // enqueue
      const id = await enqueueDeploy("netlify", it.previewPath, siteName);

      // poll status
      await pollJobUntilDone(id, (j) => {
        if (j.status === "queued") {
          setDrawerState("starting");
          setDrawerMsg("Queued…");
        } else if (j.status === "running") {
          setDrawerState("starting");
          setDrawerMsg("Deploying…");
        } else if (j.status === "success") {
          const url = j?.result?.url;
          if (url) {
            updatePreview(it.previewPath, (p) => {
              p.deploys!.unshift({ provider: "netlify", url, adminUrl: undefined, createdAt: Date.now() });
            });
            setDrawerState("success");
            setDrawerMsg("Deployed.");
            setDrawerUrl(url);
          } else {
            setDrawerState("error");
            setDrawerMsg("No URL returned.");
          }
        } else if (j.status === "error") {
          setDrawerState("error");
          setDrawerMsg(j?.error || "Deploy failed.");
        }
      });
    } catch (e: any) {
      setDrawerState("error");
      setDrawerMsg(e?.message || "Deploy failed.");
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
          setDrawerState("starting");
          setDrawerMsg("Queued…");
        } else if (j.status === "running") {
          setDrawerState("starting");
          setDrawerMsg("Deploying…");
        } else if (j.status === "success") {
          const url = j?.result?.url;
          if (url) {
            updatePreview(it.previewPath, (p) => {
              p.deploys!.unshift({ provider: "vercel", url, adminUrl: undefined, createdAt: Date.now() });
            });
            setDrawerState("success");
            setDrawerMsg("Deployed.");
            setDrawerUrl(url);
          } else {
            setDrawerState("error");
            setDrawerMsg("No URL returned.");
          }
        } else if (j.status === "error") {
          setDrawerState("error");
          setDrawerMsg(j?.error || "Deploy failed.");
        }
      });
    } catch (e: any) {
      setDrawerState("error");
      setDrawerMsg(e?.message || "Deploy failed.");
    }
  }

  // Helper: background AI review for a preview (stores count on the card)
  async function runReviewFor(previewPath: string, tier: string) {
    try {
      const html = await readFile(previewPath, "index.html").catch(() => "");
      const css = await readFile(previewPath, "styles.css").catch(() => "");
      const js = await readFile(previewPath, "app.js").catch(() => "");
      const bundle = `/* index.html */\n${html}\n\n/* styles.css */\n${css}\n\n/* app.js */\n${js}`;
      const { review } = await aiReview({ code: bundle, tier });
      const n = (review?.issues || []).length;
      updatePreview(previewPath, (p) => {
        p.issuesCount = n;
      });
    } catch {
      // keep quiet on background errors
    }
  }

  // Quick Tokens helper: edit plan tokens + stamp CSS vars
  async function applyTokens(previewPath: string) {
    // read plan
    const planRaw = await readFile(previewPath, "plan.json").catch(() => "{}");
    const plan = (() => {
      try {
        return JSON.parse(planRaw);
      } catch {
        return {};
      }
    })();
    const tokens = (plan as any).tokens || {};

    // prompt user
    const primary = window.prompt("Primary color (CSS value)", tokens.primary || "#4f46e5")?.trim();
    if (!primary) return;
    const radius = window.prompt("Corner radius (e.g., 10px)", tokens.radius || "10px")?.trim() || "10px";
    const fontSize =
      window.prompt("Base font size (e.g., 16px)", tokens.fontSize || "16px")?.trim() || "16px";

    // update plan.json
    (plan as any).tokens = { primary, radius, fontSize };
    await writeFile(previewPath, "plan.json", JSON.stringify(plan, null, 2));

    // stamp/update CSS vars at the top of styles file (idempotent with markers)
    const cssFile = await ensureAsset(previewPath, "css");
    const cssRaw = await readFile(previewPath, cssFile).catch(() => "");
    const block =
      `/* @tokens:start */\n:root{--color-primary:${primary};--radius:${radius};--font-size:${fontSize}}\n/* @tokens:end */`;
    const stripped = cssRaw.replace(/\/\* @tokens:start \*\/[\s\S]*?\/\* @tokens:end \*\//, "").trim();
    const nextCss = `${block}\n\n${stripped}`;
    await writeFile(previewPath, cssFile, nextCss);
  }

  // Sections modal opener
  async function openSectionsModal(previewPath: string) {
    // try to read plan.json → derive available section types
    const raw = await readFile(previewPath, "plan.json").catch(() => "");
    let plan: any = null;
    try {
      plan = raw ? JSON.parse(raw) : null;
    } catch {
      plan = null;
    }

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
    for (const k of avail) defaults[k] = true;

    setAvailableSections(avail);
    setPickedSections(defaults);
    setSectionsPath(previewPath);
    setSectionsOpen(true);
  }

  // ------- Rebuild (AI) helper -------
  async function handleRebuild(it: StoredPreview) {
    try {
      // Try to read plan.json; if missing, fall back to prompt
      let plan: any = null;
      try {
        const r = await fetch(
          `/api/previews/read?path=${encodeURIComponent(it.previewPath)}&file=plan.json`
        );
        const d = await r.json();
        if (r.ok && d?.ok && d?.content) plan = JSON.parse(String(d.content));
      } catch (_) {
        // ignore and fall back to prompt
      }

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
        const next = [item, ...prev];
        localStorage.setItem(STORE_KEY, JSON.stringify(next));
        return next;
      });

      // background review + open
      runReviewFor(path, aiTier);
      openOrNavigate(path);
    } catch (e: any) {
      toast({ title: "Rebuild failed", description: e?.message || "error", variant: "destructive" });
    }
  }

  // ------- Check issues (AI) helper -------
  async function handleCheckIssues(it: StoredPreview) {
    setIssuesOpen(true);
    setIssuesLoading(true);
    setIssuesErr(undefined);
    setIssues([]);

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

  // Updated empty state
  if (items.length === 0) {
    return (
      <div className="grid place-items-center py-16 text-center">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">No previews yet</h2>
          <p className="text-sm text-zinc-500">Fork a template to see it here.</p>
          <div className="flex items-center justify-center gap-2">
            <a className="text-xs px-3 py-1.5 border rounded" href="/templates">
              Browse templates
            </a>
            <button
              className="text-xs px-3 py-1.5 border rounded"
              onClick={async () => {
                try {
                  const r = await fetch("/api/previews/fork", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sourceId: "hello-world" }),
                  });
                  const data = await r.json();
                  if (!r.ok || !data?.path) throw new Error(data?.error || "fork failed");

                  // store so /previews lists it
                  const existing = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
                  const item = {
                    id: `fork-${Date.now()}`,
                    name: "Hello World",
                    previewPath: data.path,
                    createdAt: Date.now(),
                  };
                  localStorage.setItem(STORE_KEY, JSON.stringify([item, ...existing]));

                  // open it with fallback
                  openOrNavigate(data.path);
                } catch (e: any) {
                  alert(e?.message || "Couldn’t fork Hello World");
                }
              }}
            >
              Quick start: Hello World
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-zinc-500">
          {items.length} preview{items.length === 1 ? "" : "s"}
        </div>
        <div className="flex items-center gap-2">
          {/* AI tier select */}
          <select
            className="text-xs px-2 py-1 border rounded"
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

          {/* New → AI Page (Orchestrator) */}
          <button
            className="text-xs px-2 py-1 border rounded"
            onClick={async () => {
              const prompt = window
                .prompt("What should we build? (e.g., SaaS landing with hero, features, pricing)")
                ?.trim();
              if (!prompt) return;

              // Ask for blocks (comma list)
              const blocksStr =
                window
                  .prompt(
                    "Which sections? (comma-separated) hero, features, pricing, faq, testimonials, cta",
                    "hero, features, cta"
                  )
                  ?.toLowerCase() || "";
              const blocks = blocksStr
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);

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
                  const next = [item, ...prev];
                  localStorage.setItem(STORE_KEY, JSON.stringify(next));
                  return next;
                });

                // background review + open
                runReviewFor(path, aiTier);
                openOrNavigate(path);
              } catch (e: any) {
                toast({
                  title: "AI scaffold failed",
                  description: e?.message || "Error",
                  variant: "destructive",
                });
              }
            }}
          >
            New → AI Page (Orch)
          </button>

          {/* Clear all */}
          <button
            className="text-xs px-2 py-1 border rounded"
            onClick={async () => {
              if (!confirm("Delete ALL previews from disk and clear the list?")) return;
              try {
                // delete on server
                await Promise.all(
                  items.map((it) =>
                    fetch("/api/previews/delete", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ path: it.previewPath }),
                    })
                  )
                );
              } catch (_) {}
              // clear locally
              setItems([]);
              localStorage.setItem(STORE_KEY, JSON.stringify([]));
              toast({ title: "Cleared", description: "All previews removed." });
            }}
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {items.map((it, idx) => (
          <div key={idx} className="flex items-center justify-between border rounded p-3">
            <div className="min-w-0">
              <div className="font-medium truncate">{it.name}</div>
              <a
                className="text-xs text-blue-600 underline"
                href={it.previewPath}
                target="_blank"
                rel="noreferrer"
              >
                {it.previewPath}
              </a>

              {!!(typeof it.issuesCount === "number") && (
                <button
                  className="ml-2 mt-1 inline-flex items-center text-[10px] px-2 py-0.5 rounded-full border"
                  title="Open AI Review"
                  onClick={() => handleCheckIssues(it)}
                >
                  Issues ({it.issuesCount})
                </button>
              )}

              {!!it.deploys?.length && (
                <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                  Last deploy: {it.deploys[0].provider} → {it.deploys[0].url || "—"}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Edit HTML */}
              <button
                className="text-xs px-2 py-1 border rounded"
                onClick={() => {
                  setEditPath(it.previewPath);
                  setEditInitialFile("index.html");
                  setEditOpen(true);
                }}
              >
                Edit HTML
              </button>

              {/* Edit Plan (plan.json) */}
              <button
                className="text-xs px-2 py-1 border rounded"
                onClick={() => {
                  setEditPath(it.previewPath);
                  setEditInitialFile("plan.json");
                  setEditOpen(true);
                }}
              >
                Edit Plan
              </button>

              {/* Tokens quick set */}
              <button
                className="text-xs px-2 py-1 border rounded"
                onClick={() => applyTokens(it.previewPath)}
                title="Set primary color, radius, font-size"
              >
                Tokens
              </button>

              {/* Edit CSS */}
              <button
                className="text-xs px-2 py-1 border rounded"
                onClick={async () => {
                  try {
                    const f = await ensureAsset(it.previewPath, "css");
                    setEditPath(it.previewPath);
                    setEditInitialFile(f);
                    setEditOpen(true);
                    toast({ title: "CSS ready", description: f });
                  } catch (e: any) {
                    toast({
                      title: "CSS setup failed",
                      description: e?.message || "Error",
                      variant: "destructive",
                    });
                  }
                }}
              >
                Edit CSS
              </button>

              {/* Style Tweaks (no-code CSS) */}
              <button
                className="text-xs px-2 py-1 border rounded"
                onClick={async () => {
                  try {
                    const f = await ensureAsset(it.previewPath, "css");
                    setStylePath(it.previewPath);
                    setStyleFile(f);
                    setStyleOpen(true);
                  } catch (e: any) {
                    toast({
                      title: "Style panel failed",
                      description: e?.message || "Error",
                      variant: "destructive",
                    });
                  }
                }}
              >
                Style Tweaks
              </button>

              {/* Edit JS */}
              <button
                className="text-xs px-2 py-1 border rounded"
                onClick={async () => {
                  try {
                    const f = await ensureAsset(it.previewPath, "js");
                    setEditPath(it.previewPath);
                    setEditInitialFile(f);
                    setEditOpen(true);
                    toast({ title: "JS ready", description: f });
                  } catch (e: any) {
                    toast({
                      title: "JS setup failed",
                      description: e?.message || "Error",
                      variant: "destructive",
                    });
                  }
                }}
              >
                Edit JS
              </button>

              {/* Open */}
              <button
                className="text-xs px-2 py-1 border rounded"
                onClick={() => openOrNavigate(it.previewPath)}
              >
                Open
              </button>

              {/* Share (copy link) */}
              <button
                className="text-xs px-2 py-1 border rounded"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(it.previewPath);
                    toast({ title: "Link copied", description: it.previewPath });
                  } catch {
                    // eslint-disable-next-line no-alert
                    prompt("Copy link:", it.previewPath);
                  }
                }}
              >
                Share
              </button>

              {/* Duplicate */}
              <button
                className="text-xs px-2 py-1 border rounded"
                onClick={async () => {
                  try {
                    const newPath = await duplicatePreview(it.previewPath);
                    // store locally so it appears in the list
                    const nextItem: StoredPreview = {
                      id: `dup-${Date.now()}`,
                      name: `${it.name} (Copy)`,
                      previewPath: newPath,
                      createdAt: Date.now(),
                      deploys: [],
                    };
                    setItems((prev) => {
                      const next = [nextItem, ...prev];
                      localStorage.setItem(STORE_KEY, JSON.stringify(next));
                      return next;
                    });
                    toast({ title: "Duplicated", description: newPath });

                    // copy new link before opening
                    try {
                      await navigator.clipboard.writeText(newPath);
                    } catch {
                      // eslint-disable-next-line no-alert
                      prompt("Copy link:", newPath);
                    }

                    openOrNavigate(newPath);
                  } catch (e: any) {
                    toast({
                      title: "Duplicate failed",
                      description: e?.message || "Error",
                      variant: "destructive",
                    });
                  }
                }}
              >
                Duplicate
              </button>

              {/* Rebuild (AI) */}
              <button className="text-xs px-2 py-1 border rounded" onClick={() => handleRebuild(it)}>
                Rebuild (AI)
              </button>

              {/* Rebuild (Sections) */}
              <button
                className="text-xs px-2 py-1 border rounded"
                onClick={() => openSectionsModal(it.previewPath)}
                title="Pick which sections to include, then rebuild"
              >
                Rebuild (Sections)
              </button>

              {/* Check issues (AI) */}
              <button className="text-xs px-2 py-1 border rounded" onClick={() => handleCheckIssues(it)}>
                Check issues (AI)
              </button>

              {/* Export ZIP */}
              <button
                className="text-xs px-2 py-1 border rounded"
                onClick={() =>
                  exportZip(it.previewPath).catch((e) =>
                    toast({ title: "Export", description: String(e?.message || e), variant: "destructive" })
                  )
                }
              >
                Export ZIP
              </button>

              {/* Deploy → Netlify */}
              <button className="text-xs px-2 py-1 border rounded" onClick={() => handleDeployNetlify(it)}>
                Deploy → Netlify
              </button>

              {/* Deploy → Vercel */}
              <button className="text-xs px-2 py-1 border rounded" onClick={() => handleDeployVercel(it)}>
                Deploy → Vercel
              </button>

              {/* Rename */}
              <button
                className="text-xs px-2 py-1 border rounded"
                onClick={() => {
                  const newName = window.prompt("New name", it.name || "Untitled")?.trim();
                  if (!newName) return;
                  setItems((prev) => {
                    const next = rename(prev, it.previewPath, newName);
                    save(next);
                    return next;
                  });
                  toast({ title: "Renamed", description: newName });
                }}
              >
                Rename
              </button>

              {/* Delete */}
              <button
                className="text-xs px-2 py-1 border rounded"
                onClick={async () => {
                  try {
                    const r = await fetch("/api/previews/delete", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ path: it.previewPath }),
                    });
                    if (!r.ok) throw new Error(await r.text());
                    // remove locally
                    setItems((prev) => {
                      const next = prev.filter((x) => x.previewPath !== it.previewPath);
                      localStorage.setItem(STORE_KEY, JSON.stringify(next));
                      return next;
                    });
                    toast({ title: "Deleted", description: it.name });
                  } catch (e: any) {
                    toast({
                      title: "Delete failed",
                      description: e?.message || "Error",
                      variant: "destructive",
                    });
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Rebuild with Sections modal */}
      {sectionsOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4">
          <div className="w-full max-w-lg rounded-lg bg-white dark:bg-zinc-900 p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Rebuild with Sections</h3>
              <button className="text-xs px-2 py-1 border rounded" onClick={() => setSectionsOpen(false)}>
                Close
              </button>
            </div>

            <div className="space-y-2 mb-3">
              {availableSections.map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!pickedSections[s]}
                    onChange={(e) =>
                      setPickedSections((prev) => ({ ...prev, [s]: e.target.checked }))
                    }
                  />
                  <span className="capitalize">{s}</span>
                </label>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button className="text-xs px-2 py-1 border rounded" onClick={() => setSectionsOpen(false)}>
                Cancel
              </button>
              <button
                className="text-xs px-2 py-1 border rounded"
                onClick={async () => {
                  if (!sectionsPath) return;
                  try {
                    // read plan again so we pass the full plan object
                    const raw = await readFile(sectionsPath, "plan.json").catch(() => "");
                    let plan: any = null;
                    try {
                      plan = raw ? JSON.parse(raw) : null;
                    } catch {
                      plan = null;
                    }

                    const blocks = Object.keys(pickedSections).filter((k) => pickedSections[k]);
                    if (!blocks.length) {
                      alert("Pick at least one section.");
                      return;
                    }

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
                      const next = [item, ...prev];
                      localStorage.setItem(STORE_KEY, JSON.stringify(next));
                      return next;
                    });

                    // background review + open
                    runReviewFor(path, aiTier);
                    openOrNavigate(path);

                    setSectionsOpen(false);
                  } catch (e: any) {
                    toast({ title: "Rebuild failed", description: e?.message || "error", variant: "destructive" });
                  }
                }}
              >
                Rebuild
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightweight AI Review modal */}
      {issuesOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4">
          <div className="w-full max-w-lg rounded-lg bg-white dark:bg-zinc-900 p-4 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">AI Review</h3>
              <button className="text-xs px-2 py-1 border rounded" onClick={() => setIssuesOpen(false)}>
                Close
              </button>
            </div>

            {issuesLoading && <div className="text-sm text-zinc-500">Analyzing…</div>}
            {issuesErr && <div className="text-sm text-red-600">Error: {issuesErr}</div>}

            {!issuesLoading && !issuesErr && (issues.length ? (
              <ul className="space-y-3">
                {issues.map((it, i) => (
                  <li key={i} className="border rounded p-3">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">{it.type}</div>
                    <div className="text-sm">{it.msg}</div>
                    {it.fix && <div className="text-xs text-zinc-600 mt-1">Fix: {it.fix}</div>}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-zinc-500">No issues found.</div>
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
        onSaved={async () => {
          if (editPath) {
            runReviewFor(editPath, aiTier); // keep Issues badge up-to-date
          }
        }}
      />

      <QuickStyleDialog
        open={styleOpen}
        onClose={() => setStyleOpen(false)}
        previewPath={stylePath || "/previews/"}
        file={styleFile || "styles.css"}
      />
    </>
  );
}
