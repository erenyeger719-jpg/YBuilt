import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";

const STORE_KEY = "ybuilt.previews";

type Item = {
  id: string;
  name: string;
  previewPath: string;
  createdAt: number;
};

export default function PreviewsPage() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      setItems(raw ? JSON.parse(raw) : []);
    } catch {
      setItems([]);
    }
  }, []);

  function clearAll() {
    localStorage.removeItem(STORE_KEY);
    setItems([]);
  }

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Previews</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Forked templates you can open and share.
          </p>
        </div>
        <Button variant="secondary" onClick={clearAll}>
          Clear list
        </Button>
      </div>

      <ul className="space-y-3">
        {items.length === 0 && (
          <li className="text-sm text-zinc-500">
            No previews yet. Fork a template first.
          </li>
        )}

        {items.map((it) => (
          <li
            key={`${it.id}-${it.createdAt}`}
            className="flex items-center justify-between rounded-xl border p-4"
          >
            <div>
              <div className="font-medium">{it.name}</div>
              <div className="text-sm text-zinc-500">
                {new Date(it.createdAt).toLocaleString()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild>
                <a href={it.previewPath} target="_blank" rel="noreferrer">
                  Open
                </a>
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  const url = location.origin + it.previewPath;
                  try {
                    await navigator.clipboard.writeText(url);
                  } catch {}
                }}
              >
                Copy link
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
