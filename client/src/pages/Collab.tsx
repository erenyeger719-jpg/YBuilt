// client/src/pages/Collab.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import Header from "@/components/Header";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { usePresence, onCursor, emitCursor, onMention } from "@/lib/collab";
import CommentsDialog from "@/components/collab/CommentsDialog";
import AiQnaDialog from "@/components/collab/AiQnaDialog";

/* -------------------- base64url helpers (binary-safe) -------------------- */
function b64uEncode(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64uDecode(s: string) {
  const pad = (t: string) => t + "===".slice((t.length + 3) % 4);
  const b64 = pad(s).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export default function CollabPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [, setLoc] = useLocation();
  const { toast } = useToast();

  // decode the previewPath from param
  const previewPath = (() => {
    try {
      return b64uDecode(roomId);
    } catch {
      return "";
    }
  })();

  // guard: if bad param, bounce to library
  useEffect(() => {
    if (!previewPath.startsWith("/previews/")) {
      toast({
        title: "Invalid room",
        description: "Bad link or missing preview.",
        variant: "destructive",
      });
      setLoc("/library");
    }
  }, [previewPath, setLoc, toast]);

  // files + editor
  const [files, setFiles] = useState<string[]>([]);
  const [sel, setSel] = useState("index.html");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // collab modals
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [qnaOpen, setQnaOpen] = useState(false);
  const [selRange, setSelRange] = useState<{ from: number; to: number } | null>(
    null
  );

  // presence
  const me = {
    name: localStorage.getItem("ybuilt.name") || "You",
    color: localStorage.getItem("ybuilt.color") || "#8b5cf6",
    file: sel,
  };
  const { peers } = usePresence(previewPath, { ...me, file: sel });

  // load list
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(
          `/api/previews/list?path=${encodeURIComponent(previewPath)}`
        );
        const d = await r.json();
        const list: string[] = Array.isArray(d?.files) ? d.files : [];
        if (!alive) return;
        setFiles(list);
        const preferred = list.includes("index.html")
          ? "index.html"
          : list[0] || "index.html";
        setSel(preferred);
      } catch (e: any) {
        toast({
          title: "List failed",
          description: e?.message || "Error",
          variant: "destructive",
        });
        setFiles([]);
        setSel("index.html");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [previewPath, toast]);

  // load file content
  useEffect(() => {
    if (!sel) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(
          `/api/previews/read?path=${encodeURIComponent(
            previewPath
          )}&file=${encodeURIComponent(sel)}`
        );
        const d = await r.json();
        if (!r.ok || !d?.ok) throw new Error(d?.error || "read failed");
        if (alive) setText(String(d.content ?? ""));
      } catch (e: any) {
        if (alive) setText("");
        toast({
          title: "Read failed",
          description: e?.message || "Error",
          variant: "destructive",
        });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [previewPath, sel, toast]);

  const canSave = useMemo(() => !saving && !!sel, [saving, sel]);

  async function doSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const r = await fetch("/api/previews/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: previewPath, file: sel, content: text }),
      });
      const d = await r.json();
      if (!r.ok || !d?.ok) throw new Error(d?.error || "write failed");
      toast({ title: "Saved", description: sel });
    } catch (e: any) {
      toast({
        title: "Save failed",
        description: e?.message || "Error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  // --- live cursors + mentions ---
  // compute line range for selection
  function computeLineRange(
    selr: { from: number; to: number } | null,
    body: string
  ) {
    if (!selr) return {};
    const len = body.length;
  }
}