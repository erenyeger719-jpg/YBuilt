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
const load = (): StoredPreview[] => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); } catch { return []; } };
const save = (items: StoredPreview[]) => localStorage.setItem(STORE_KEY, JSON.stringify(items));
const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

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
    setItems(prev => {
      const next = prev.map(p => {
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
    setDrawerUrl(undefined); setDrawerAdminUrl(undefined);
    setDrawerOpen(true);

    try {
      const name = `ybuilt-${slugify(it.name)}`;
      const r = await deployNetlify(it.previewPath, name);
      const url = r?.url || r?.deploy_url || undefined;
      const admin = r?.admin_url || r?.dashboard_url || undefined;

      if (url) {
        updatePreview(it.previewPath, p => {
          p.deploys!.unshift({ provider: "netlify", url, adminUrl: admin, createdAt: Date.now() });
        });
        setDrawerState("success");
        setDrawerMsg("Deployed on Netlify.");
        setDrawerUrl(url); setDrawerAdminUrl(admin);
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
    setDrawerUrl(undefined); setDrawerAdminUrl(undefined);
    setDrawerOpen(true);

    try {
      const name = `ybuilt-${slugify(it.name)}`;
      const r = await deployVercel(it.previewPath, name);
      const url = r?.url || r?.inspectUrl || undefined;

      if (url) {
        updatePreview(it.previewPath, p => {
          p.deploys!.unshift({ provider: "vercel", url, adminUrl: undefined, createdAt: Date.now() });
        });
        setDrawerState("success");
        setDrawerMsg("Deployment created on Vercel.");
        setDrawerUrl(url); setDrawerAdminUrl(undefined);
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
    return <p className="text-sm text-zinc-500">No previews yet. Fork a template first.</p>;
  }

  return (
    <>
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
              <button
                className="text-xs px-2 py-1 border rounded"
                onClick={() => exportZip(it.previewPath).catch(e =>
                  toast({ title: "Export", description: String(e?.message || e), variant: "destructive" })
                )}
              >
                Export ZIP
              </button>

              <button
                className="text-xs px-2 py-1 border rounded"
                onClick={() => handleDeployNetlify(it)}
              >
                Deploy → Netlify
              </button>

              <button
                className="text-xs px-2 py-1 border rounded"
                onClick={() => handleDeployVercel(it)}
              >
                Deploy → Vercel
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
