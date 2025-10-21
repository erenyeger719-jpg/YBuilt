import { useEffect, useMemo, useState } from "react";
import TemplateCard from "./TemplateCard";
import { TEMPLATES, type Template } from "../../data/templates";
import { Input } from "../ui/input";
import { useToast } from "../../hooks/use-toast";
import { io } from "socket.io-client";
import { useSearch } from "wouter";

const STORE_KEY = "ybuilt.previews";

type StoredPreview = {
  id: string;
  name: string;
  previewPath: string;
  createdAt: number;
};

export default function TemplatesPanel() {
  const [query, setQuery] = useState("");
  const [forkingId, setForkingId] = useState<string | null>(null);
  const { toast } = useToast();

  // single socket for the panel (namespace: /builds)
  const sock = useMemo(() => io("/builds"), []);
  useEffect(() => {
    return () => {
      try {
        sock.close();
      } catch {
        /* noop */
      }
    };
  }, [sock]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TEMPLATES;
    return TEMPLATES.filter((t) =>
      [t.name, t.description, ...(t.tags || [])].join(" ").toLowerCase().includes(q)
    );
  }, [query]);

  function storePreview(item: StoredPreview) {
    const existing: StoredPreview[] = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
    localStorage.setItem(STORE_KEY, JSON.stringify([item, ...existing]));
  }

  async function fallbackFork(t: Template) {
    const res = await fetch("/api/previews/fork", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ sourceId: t.id }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const path = String(data.path || t.previewPath);
    const item: StoredPreview = {
      id: t.id,
      name: t.name,
      previewPath: path,
      createdAt: Date.now(),
    };
    storePreview(item);
    toast({ title: "Project forked", description: `Ready at ${item.previewPath}` });
    return path;
  }

  async function handleFork(t: Template) {
    setForkingId(t.id);
    try {
      // Preferred: build endpoint with socket progress
      const res = await fetch("/api/previews/build", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ templateId: t.id }),
      });

      if (!res.ok) {
        // Fallback to simple fork if /build isn't available
        await fallbackFork(t);
        return;
      }

      const data = await res.json();
      if (!data?.ok) {
        // Fallback path if server responded but build not supported
        await fallbackFork(t);
        return;
      }

      const { id, url } = data as { id: string; url: string };

      // Join a room for build progress (future-proof)
      const onProgress = (msg: any) => {
        if (!msg || msg.id !== id) return;

        if (msg.stage === "ready") {
          const href = new URL(url, window.location.origin).pathname.endsWith("/")
            ? new URL(url, window.location.origin).pathname
            : new URL(url, window.location.origin).toString();

          const item: StoredPreview = {
            id: t.id,
            name: t.name,
            previewPath: href,
            createdAt: Date.now(),
          };
          storePreview(item);

          toast({
            title: "Preview ready",
            description: `Open at ${item.previewPath}`,
          });

          sock.off("build:progress", onProgress);
        }

        if (msg.stage === "error") {
          toast({
            title: "Build failed",
            description: msg.error || "Please try again.",
            variant: "destructive",
          });
          sock.off("build:progress", onProgress);
        }
      };

      sock.emit("join-build", id);
      sock.on("build:progress", onProgress);

      // If server returns a ready url immediately, show toast now too.
      if (url) {
        const item: StoredPreview = {
          id: t.id,
          name: t.name,
          previewPath: new URL(url, window.location.origin).pathname,
          createdAt: Date.now(),
        };
        storePreview(item);
        toast({ title: "Preview ready", description: `Open at ${item.previewPath}` });
      }
    } catch (_e) {
      // Final fallback if any exception
      try {
        await fallbackFork(t);
      } catch {
        toast({
          title: "Fork failed",
          description: "Please try again in a bit.",
          variant: "destructive",
        });
      }
    } finally {
      setForkingId(null);
    }
  }

  // focus search on mount
  useEffect(() => {
    const el = document.getElementById("template-search") as HTMLInputElement | null;
    el?.focus();
  }, []);

  // one-click fork via URL ?fork=<id>
  const search = useSearch();
  useEffect(() => {
    const p = new URLSearchParams(search);
    const forkId = p.get("fork");
    if (!forkId) return;
    const t = TEMPLATES.find((x) => x.id === forkId);
    if (t) handleFork(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Templates</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Pick a starter. Preview live. Fork to begin.
          </p>
        </div>
        <a className="text-sm underline" href="/previews">
          Previews →
        </a>
      </div>

      <div>
        <Input
          id="template-search"
          placeholder="Search templates…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
        {filtered.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            onFork={() => handleFork(t)}
            // if TemplateCard supports disabled/loading props, wire them here:
            // loading={forkingId === t.id}
            // disabled={forkingId !== null}
          />
        ))}
      </div>
    </div>
  );
}
