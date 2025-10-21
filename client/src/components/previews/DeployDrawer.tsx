import { useEffect } from "react";

type DeployState = "idle" | "starting" | "success" | "error";

export default function DeployDrawer({
  open,
  onClose,
  provider,                 // "netlify" | "vercel"
  state,                    // DeployState
  message,                  // string (status/error)
  url,                      // string | undefined
  adminUrl,                 // string | undefined
}: {
  open: boolean;
  onClose: () => void;
  provider: "netlify" | "vercel";
  state: DeployState;
  message?: string;
  url?: string;
  adminUrl?: string;
}) {
  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-zinc-900 shadow-2xl">
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Deploy — {provider === "netlify" ? "Netlify" : "Vercel"}
          </h2>
          <button className="text-sm underline" onClick={onClose}>Close</button>
        </div>

        <div className="p-5 space-y-4">
          {/* state pill */}
          <div className="inline-flex items-center gap-2 text-sm">
            <span className={
              "inline-block w-2.5 h-2.5 rounded-full " +
              (state === "starting" ? "bg-amber-500 animate-pulse" :
               state === "success"  ? "bg-emerald-500" :
               state === "error"    ? "bg-rose-500" :
                                       "bg-zinc-400")
            } />
            <span className="font-medium capitalize">{state}</span>
          </div>

          {message && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
          )}

          {url && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Live URL</div>
              <a className="text-sm text-blue-600 underline break-all" href={url} target="_blank" rel="noreferrer">
                {url}
              </a>
              <button
                className="text-xs px-2 py-1 border rounded"
                onClick={() => navigator.clipboard.writeText(url)}
              >
                Copy URL
              </button>
            </div>
          )}

          {adminUrl && (
            <div className="space-y-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <div className="text-sm font-medium">Dashboard</div>
              <a className="text-sm text-blue-600 underline break-all" href={adminUrl} target="_blank" rel="noreferrer">
                {adminUrl}
              </a>
            </div>
          )}

          {!url && state === "error" && (
            <div className="text-xs text-zinc-500">
              Tip: set provider tokens in env later (NETLIFY_TOKEN / VERCEL_TOKEN).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
