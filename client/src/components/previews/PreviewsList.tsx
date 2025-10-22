import { useEffect, useState } from "react";
import { exportZip, deployNetlify, deployVercel } from "@/lib/previewsActions";
import { useToast } from "@/hooks/use-toast";
import DeployDrawer from "./DeployDrawer";

type DeployInfo = { provider: "netlify" | "vercel"; url?: string; adminUrl?: string; createdAt: number };
type StoredPreview = {
  id: string;
  name: string;
  previewPath: string;
  createdAt: number;
  deploys?: DeployInfo[];
};

const STORE_KEY = "ybuilt.previews";
const load = (): StoredPreview[] => {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  } catch {
    return [];
  }
};
const save = (items: StoredPreview[]) => localStorage.setItem(STORE_KEY, JSON.stringify(items));
const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
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

  async function handleDeployNetlify(it: StoredPreview) {
    setDrawerProvider("netlify");
    setDrawerState("starting");
    setDrawerMsg("Uploading site to Netlify…");
    setDrawerUrl(undefined);
    setDrawerAdminUrl(undefined);
    setDrawerOpen(true);

    try {
      const suggested = `ybuilt-${slugify(it.name)}`;
      const siteName = window.prompt("Netlify site name (optional)", suggested)?.trim() || suggested;

      const r = await deployNetlify(it.previewPath, siteName);
      const url = r?.url || r?.deploy_url || undefined;
      const admin = r?.admin_url || r?.dashboard_url || undefined;

      if (url) {
        updatePreview(it.previewPath, (p) => {
          p.deploys!.unshift({ provider: "netlify", url, adminUrl: admin, createdAt: Date.now() });
        });
        setDrawerState("success");
        setDrawerMsg("Deployed on Netlify.");
        setDrawerUrl(url);
        setDrawerAdminUrl(admin);
        toast({ title: "Netlify", description: url });
      } else {
        setDrawerState("error");
        setDrawerMsg("Netlify didn’t return a URL. Check token / server logs.");
      }
    } catch (e: any) {
      setDrawerState("error");
      setDrawerMsg(e?.message || "Deploy failed.");
    }
  }

  async function handleDeployVercel(it: StoredPreview) {
    setDrawerProvider("vercel");
    setDrawerState("starting");
    setDrawerMsg("Creating deployment on Vercel…");
    setDrawerUrl(undefined);
    setDrawerAdminUrl(undefined);
    setDrawerOpen(true);

    try {
      const name = `ybuilt-${slugify(it.name)}`;
      const r = await deployVercel(it.previewPath, name);
      const url = r?.url || r?.inspectUrl || undefined;

      if (url) {
        updatePreview(it.previewPath, (p) => {
          p.deploys!.unshift({ provider: "vercel", url, adminUrl: undefined, createdAt: Date.now() });
        });
        setDrawerState("success");
        setDrawerMsg("Deployment created on Vercel.");
        setDrawerUrl(url);
        setDrawerAdminUrl(undefined);
        toast({ title: "Vercel", description: url });
      } else {
        setDrawerState("error");
        setDrawerMsg("Vercel didn’t return a URL. Check token / server logs.");
      }
    } catch (e: any) {
      setDrawerState("error");
      setDrawerMsg(e?.message || "Deploy failed.");
    }
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No previews yet. <a className="underline" href="/templates">Fork a template</a> first.
      </p>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-zinc-500">
          {items.length} preview{items.length === 1 ? "" : "s"}
        </div>
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

      <div className="space-y-4">
        {items.map((it, idx) => (
          <div key={idx} className="flex items-center justify-between border rounded p-3">
            <div className="min-w-0">
              <div className="font-medium truncate">{it.name}</div>
              <a className="text-xs text-blue-600 underline" href={it.previewPath} target="_blank" rel="noreferrer">
                {it.previewPath}
              </a>
              {!!it.deploys?.length && (
                <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                  Last deploy: {it.deploys[0].provider} → {it.deploys[0].url || "—"}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Open */}
              <button
                className="text-xs px-2 py-1 border rounded"
                onClick={() => window.open(it.previewPath, "_blank", "noopener,noreferrer")}
              >
                Open
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

      <DeployDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        provider={drawerProvider}
        state={drawerState}
        message={drawerMsg}
        url={drawerUrl}
        adminUrl={drawerAdminUrl}
      />
    </>
  );
}
