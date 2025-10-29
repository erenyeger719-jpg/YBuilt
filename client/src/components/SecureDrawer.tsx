// client/src/components/SecureDrawer.tsx
import React, { useState } from "react";
import ReactDOM from "react-dom/client";

/**
 * securePrompt(options)
 * Opens a minimal, ephemeral modal that NEVER persists.
 * Returns the entered secret string or null if cancelled.
 */
export function securePrompt(opts?: {
  title?: string;
  label?: string;
  placeholder?: string;
  mask?: boolean;
}): Promise<string | null> {
  const title = opts?.title ?? "Secure input";
  const label = opts?.label ?? "Secret";
  const placeholder = opts?.placeholder ?? "paste here…";
  const mask = opts?.mask ?? true;

  // Create a one-off root
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = ReactDOM.createRoot(host);

  return new Promise<string | null>((resolve) => {
    function cleanup() {
      try {
        root.unmount();
        document.body.removeChild(host);
      } catch {}
    }

    function Modal() {
      const [val, setVal] = useState("");

      // Prevent focus escape + background scroll
      React.useEffect(() => {
        const orig = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
          document.body.style.overflow = orig;
        };
      }, []);

      const confirm = () => {
        const out = val.trim();
        cleanup();
        resolve(out ? out : null);
      };
      const cancel = () => {
        cleanup();
        resolve(null);
      };

      return (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          aria-modal="true"
          role="dialog"
        >
          <div className="absolute inset-0 bg-black/40" onClick={cancel} />
          <div className="relative w-[520px] max-w-[92vw] rounded-2xl bg-white shadow-2xl border p-4">
            <div className="text-sm font-semibold">{title}</div>
            <div className="mt-1 text-xs text-gray-600">
              Not stored. Not logged. Lives in memory until you close this tab.
            </div>

            <label className="block mt-4 text-xs text-gray-700">{label}</label>
            <input
              autoFocus
              type={mask ? "password" : "text"}
              className="mt-1 w-full px-3 py-2 rounded border outline-none"
              placeholder={placeholder}
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirm();
                if (e.key === "Escape") cancel();
              }}
            />

            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={cancel} className="px-3 py-2 text-sm rounded border">
                Cancel
              </button>
              <button
                onClick={confirm}
                className="px-3 py-2 text-sm rounded border bg-black text-white"
              >
                Use this (ephemeral)
              </button>
            </div>

            <div className="mt-3 text-[11px] text-gray-500">
              Tip: rotate this key later in your provider dashboard.
            </div>
          </div>
        </div>
      );
    }

    root.render(<Modal />);
  });
}
