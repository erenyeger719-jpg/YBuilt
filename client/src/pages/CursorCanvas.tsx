// client/src/pages/CursorCanvas.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
// @ts-ignore
import * as Y from "yjs";
// @ts-ignore
import { WebrtcProvider } from "y-webrtc";
import { Autopilot } from "@/lib/autopilot";
import { securePrompt } from "@/components/SecureDrawer";

/** -------------------- tiny helpers -------------------- **/
const json = (body: any) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
function rid(n = 10) {
  const a = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: n }, () => a[(Math.random() * a.length) | 0]).join("");
}
type Spec = any;

type HoverMsg = {
  type: "yb_hover";
  rect: { x: number; y: number; w: number; h: number };
  meta: {
    tag: string;
    sel?: string; // CSS-ish selector path for semantic anchoring
    role?: string;
    aria?: string;
    text?: string;
    style?: {
      color?: string;
      backgroundColor?: string;
      fontSize?: string;
      fontWeight?: string;
      lineHeight?: string;
      width?: string;
      height?: string;
      margin?: string;
      padding?: string;
    };
  };
};
type DataSkin = "normal" | "empty" | "long" | "skeleton" | "error";
type Role = "Edit" | "Review" | "Proof";

// EXTENDED: comment threads + resolve
type CanvasComment = {
  id: string;
  path: string;
  x: number;
  y: number;
  text: string;
  ts: number;
  replies?: Array<{ id: string; text: string; ts: number }>;
  resolved?: boolean;
};

function loadComments(pid: string): CanvasComment[] {
  try {
    const db = JSON.parse(localStorage.getItem("yb_comments_v1") || "{}");
    return Array.isArray(db?.[pid]) ? db[pid] : [];
  } catch {
    return [];
  }
}
function saveComments(pid: string, items: CanvasComment[]) {
  try {
    const db = JSON.parse(localStorage.getItem("yb_comments_v1") || "{}");
    db[pid] = items;
    localStorage.setItem("yb_comments_v1", JSON.stringify(db));
  } catch {}
}

/** -------------------- local constants -------------------- **/
// Mirror of server-side hints used in recompose()
const VARIANT_HINTS: Record<string, string[]> = {
  "hero-basic": ["hero-basic", "hero-basic@b"],
  "features-3col": ["features-3col", "features-3col@alt"],
  "pricing-simple": ["pricing-simple", "pricing-simple@a"],
  "faq-accordion": ["faq-accordion", "faq-accordion@dense"],
};

// tiny helpers for variants
const baseOf = (s: string) => String(s).split("@")[0];
// FIXED: typo in helper name
const variantsFor = (s: string) => VARIANT_HINTS_FALLBACK(s);
function VARIANT_HINTS_FALLBACK(s: string) {
  return VARIANT_HINTS[baseOf(s)] || [s];
}

/** -------------------- macros (types + storage) -------------------- **/
type Macro = { name: string; steps: string[] };
function loadMacros(): Macro[] {
  try {
    return JSON.parse(localStorage.getItem("yb_macros_v1") || "[]");
  } catch {
    return [];
  }
}
function saveMacros(ms: Macro[]) {
  try {
    localStorage.setItem("yb_macros_v1", JSON.stringify(ms));
  } catch {}
}
// export/import helpers
function exportMacros(macros: Macro[]) {
  try {
    const data = JSON.stringify(macros, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "yb_macros.json";
    a.click();
    URL.revokeObjectURL(url);
  } catch {}
}
function importMacrosFromFile(file: File, existing: Macro[], onDone: (next: Macro[]) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const raw = JSON.parse(String(reader.result) || "[]");
      const arr: Macro[] = Array.isArray(raw) ? raw : [];
      const next = [...existing, ...arr].filter(Boolean);
      onDone(next);
      saveMacros(next);
    } catch {}
  };
  reader.readAsText(file);
}

/** -------------------- main -------------------- **/
export default function CursorCanvas() {
  // session + prompt
  const [sessionId] = useState(() => `cursor_${rid(8)}`);
  const [pagePrompt, setPagePrompt] = useState("dark saas waitlist for founders");

  // compose state
  const [spec, setSpec] = useState<Spec | null>(null);
  const [, setChips] = useState<string[]>([]);
  const [url, setUrl] = useState<string | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);
  const [breadth, setBreadth] = useState<"" | "wide" | "max">("");
  const [forceNoJS, setForceNoJS] = useState(false);

  // overlays
  const [showProof, setShowProof] = useState(true);
  const [showPerf, setShowPerf] = useState(true);
  const [proof, setProof] = useState<any>(null);

  // measurement + freeze
  const [measureOn, setMeasureOn] = useState(false);
  const [modMeasure, setModMeasure] = useState(false); // hold Shift to peek
  const [freezeHover, setFreezeHover] = useState(false);

  // army
  const [armyBusy, setArmyBusy] = useState(false);
  const [armyTop, setArmyTop] = useState<any[]>([]);
  const [showUnsafe, setShowUnsafe] = useState(false);

  // canvas transforms (workspace feel)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number } | null>(null);

  // NEW: surface ref for 1280x800, and pin drag state
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const dragOffRef = useRef<{ dx: number; dy: number } | null>(null);

  // magic cursor overlay state
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [hoverBox, setHoverBox] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null
  );
  const [hoverMeta, setHoverMeta] = useState<{
    tag: string;
    sel?: string;
    role?: string;
    aria?: string;
    text?: string;
    style?: {
      color?: string;
      backgroundColor?: string;
      fontSize?: string;
      fontWeight?: string;
      lineHeight?: string;
      width?: string;
      height?: string;
      margin?: string;
      padding?: string;
    };
  } | null>(null);
  const [cursorPt, setCursorPt] = useState<{ x: number; y: number } | null>(null);
  // sections order UI
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const dragFromRef = useRef<number | null>(null);
  // a11y quick check
  const [contrastInfo, setContrastInfo] = useState<{ ratio: number; passAA: boolean } | null>(null);

  // Intent layer
  const [layer, setLayer] =
    useState<"Layout" | "Copy" | "Brand" | "Proof" | "Perf" | "Variants">("Layout");

  // --- lineage + A/B state ---
  const [history, setHistory] = useState<
    Array<{ ts: number; url: string | null; pageId: string | null; prompt: string; spec?: Spec }>
  >([]);
  const [ab, setAb] = useState<{
    on: boolean;
    exp: string;
    arm: "A" | "B";
    A?: { url: string | null; pageId: string | null };
    B?: { url: string | null; pageId: string | null };
  }>({ on: false, exp: "", arm: "A" });
  const [abKpi, setAbKpi] = useState<
    null | { A: { views: number; conv: number }; B: { views: number; conv: number } }
  >(null);
  const [showHistory, setShowHistory] = useState(false);
  const [dataSkin, setDataSkin] = useState<DataSkin>("normal");

  // --- Add: Auto-Stop state for A/B ---
  const [abAuto, setAbAuto] = useState({
    enabled: true,
    confidence: 0.95,
    minViews: 100,
    minConv: 5,
  });
  const [abWinner, setAbWinner] = useState<"A" | "B" | null>(null);

  // --- presence state ---
  const [role, setRole] = useState<Role>("Edit");
  const bcRef = useRef<BroadcastChannel | null>(null);
  const [peers, setPeers] = useState<
    Record<string, { x: number; y: number; layer: string; role: Role; ts: number }>
  >({});

  // CRDT (yjs) — multiplayer light
  const yDocRef = useRef<Y.Doc | null>(null);
  const yProvRef = useRef<any>(null);
  const ySectionsRef = useRef<Y.Array<string> | null>(null);
  const yMuteRef = useRef(false); // prevents echo loops

  // --- macros state ---
  const [macros, setMacros] = useState<Macro[]>(() => loadMacros());
  const [showMacros, setShowMacros] = useState(false);
  const [recording, setRecording] = useState(false);
  const recordingRef = useRef<string[]>([]);
  const [macroName, setMacroName] = useState("");

  // comments
  const [comments, setComments] = useState<CanvasComment[]>([]);
  const [showComments, setShowComments] = useState(true);
  // comment arming (legacy Figma-style)
  const [noteArm, setNoteArm] = useState(false);
  // NEW: Comment mode (iframe-aware)
  const [commentMode, setCommentMode] = useState(false);

  // --- Autopilot hook (state + ref) ---
  const [autopilotOn, setAutopilotOn] = useState(false);

  // (A) Persona state + persistence
  type PersonaKey = "builder" | "mentor" | "analyst" | "playful";
  const [persona, setPersona] = useState<PersonaKey>(() => {
    const v = localStorage.getItem("yb_persona_v1") as PersonaKey | null;
    return v || "builder";
  });
  useEffect(() => {
    try {
      localStorage.setItem("yb_persona_v1", persona);
    } catch {}
  }, [persona]);

  // Micro-fix: ensure say() always uses latest persona (even though Autopilot is constructed once)
  const personaRef = useRef<PersonaKey>(persona);
  useEffect(() => {
    personaRef.current = persona;
  }, [persona]);

  const [listening, setListening] = useState(false);
  const [autoLog, setAutoLog] = useState<Array<{ role: "you" | "pilot"; text: string }>>([]);
  const autopilotRef = useRef<Autopilot | null>(null);

  // --- NEW: keep latest state for Autopilot via refs ---
  const specRef = useRef<Spec | null>(null);
  useEffect(() => {
    specRef.current = spec;
  }, [spec]);

  const armyTopRef = useRef<any[]>([]);
  useEffect(() => {
    armyTopRef.current = armyTop;
  }, [armyTop]);

  const historyRef = useRef(history);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const proofRef = useRef<any>(null);
  useEffect(() => {
    proofRef.current = proof;
  }, [proof]);

  // Mirror latest comments for reliable save on mouse-up (fast drags)
  const commentsRef = useRef<CanvasComment[]>([]);
  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

  useEffect(() => {
    setComments(pageId ? loadComments(pageId) : []);
  }, [pageId]);

  // Open a pinned thread via hash on page change
  useEffect(() => {
    const id = location.hash.startsWith("#c-") ? location.hash.slice(3) : "";
    if (id) setShowComments(true);
  }, [pageId]);

  useEffect(() => {
    const id = location.hash.startsWith("#c-") ? location.hash.slice(3) : "";
    if (!id) return;
    // try to gently scroll into view when panel is visible
    const t = setTimeout(() => {
      const el = document.getElementById(`c-${id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
    return () => {
      clearTimeout(t);
    };
  }, [showComments, comments.length]);

  function addCommentAtCursor() {
    if (!pageId || !cursorPt) return;
    const txt = window.prompt("Add note");
    if (!txt || !txt.trim()) return;
    const item: CanvasComment = {
      id: rid(6),
      path: hoverMeta?.sel || "",
      x: cursorPt.x,
      y: cursorPt.y,
      text: txt.trim(),
      ts: Date.now(),
      replies: [],
      resolved: false,
    };
    const next = [item, ...comments];
    setComments(next);
    saveComments(pageId, next);
  }
  function addCommentAtPoint(sel: string, x: number, y: number) {
    if (!pageId) return;
    const txt = window.prompt("Add note");
    if (!txt || !txt.trim()) return;
    const item: CanvasComment = {
      id: rid(6),
      path: sel || "",
      x,
      y,
      text: txt.trim(),
      ts: Date.now(),
      replies: [],
      resolved: false,
    };
    const next = [item, ...comments];
    setComments(next);
    saveComments(pageId, next);
  }
  // NEW helper: add at explicit point with optional prefilled hint
  function addCommentAt(x: number, y: number, sel: string | undefined, hint?: string) {
    if (!pageId) return;
    const txt = window.prompt("Add note", hint || "");
    if (!txt || !txt.trim()) return;
    const item: CanvasComment = {
      id: rid(6),
      path: sel || "",
      x,
      y,
      text: txt.trim(),
      ts: Date.now(),
      replies: [],
      resolved: false,
    };
    const next = [item, ...comments];
    setComments(next);
    saveComments(pageId, next);
  }

  function deleteComment(id: string) {
    if (!pageId) return;
    const next = comments.filter((c) => c.id !== id);
    setComments(next);
    saveComments(pageId, next);
  }

  // NEW: replies & resolve toggles
  function addReply(id: string, text: string) {
    if (!pageId || !text.trim()) return;
    setComments((prev) => {
      const next = prev.map((c) =>
        c.id === id
          ? {
              ...c,
              replies: [...(c.replies || []), { id: rid(5), text: text.trim(), ts: Date.now() }],
            }
          : c
      );
      saveComments(pageId, next);
      return next;
    });
  }
  function toggleResolve(id: string) {
    if (!pageId) return;
    setComments((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, resolved: !c.resolved } : c));
      saveComments(pageId, next);
      return next;
    });
  }

  // --- Autopilot helpers ---
  function pushAutoLog(role: "you" | "pilot", text: string) {
    setAutoLog((l) => [...l, { role, text }].slice(-5));
  }

  // (B) Persona-aware say() — anchored to personaRef to avoid drift after Autopilot construction
  function say(text: string) {
    try {
      const current = personaRef.current;
      const u = new SpeechSynthesisUtterance(`[${current}] ${text}`);
      const voices = (window.speechSynthesis?.getVoices?.() || []) as SpeechSynthesisVoice[];
      const pick =
        (current === "mentor" &&
          voices.find((v) => v.lang?.toLowerCase().startsWith("en-in"))) ||
        voices.find((v) => v.lang?.toLowerCase().startsWith("en-")) ||
        voices[0];
      if (pick) u.voice = pick;
      window.speechSynthesis?.speak(u);
    } catch {}
  }

  async function askConfirm(plan: string) {
    return window.confirm(plan + "\n\nProceed?");
  }
  function undoLast() {
    if (history.length >= 2) {
      const node = history[1];
      setPreview(node.url, node.pageId);
      setHistory((h) => h.slice(1));
    }
  }

  // --- Guarded Executor (contracts-first) ---
  async function fetchProofNow(pid: string | null) {
    if (!pid) return null;
    try {
      const r = await fetch(`/api/ai/proof/${pid}`);
      const j = await r.json();
      return j?.proof || null;
    } catch {
      return null;
    }
  }

  async function guardedExec(plan: string, doWork: () => Promise<void> | void) {
    const ok = await askConfirm(plan);
    if (!ok) return false;

    await Promise.resolve(doWork());

    // give the preview a beat to settle, then pull proof
    await new Promise((r) => setTimeout(r, 150));
    const p = await fetchProofNow(pageId);

    const pass =
      p &&
      p.proof_ok === true &&
      p.a11y === true &&
      (typeof p.cls_est !== "number" || p.cls_est <= 0.1) &&
      (typeof p.lcp_est_ms !== "number" || p.lcp_est_ms <= 2500);

    if (!pass) {
      undoLast();
      pushAutoLog("pilot", "Change reverted — guardrails failed (CLS/A11y/Proof/LCP).");
      try {
        say("Blocked. Rolled back to last good state.");
      } catch {}
      return false;
    }

    const cls = p?.cls_est != null ? p.cls_est.toFixed(3) : "—";
    const lcp = p?.lcp_est_ms != null ? `${Math.round(p.lcp_est_ms)} ms` : "—";
    pushAutoLog(
      "pilot",
      `Done. CLS ${cls} · LCP ${lcp} · A11y ${p?.a11y ? "PASS" : "FAIL"} · Proof ${
        p?.proof_ok ? "OK" : "BLOCKED"
      }`
    );
    try {
      say(`Done. CLS ${cls}, LCP ${lcp}.`);
    } catch {}
    return true;
  }

  // tiny clamp for goal slider
  function clamp01(n: number) {
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  // Build Autopilot instance once (after first render)
  useEffect(() => {
    if (autopilotRef.current) return;
    autopilotRef.current = new Autopilot({
      say,
      askConfirm,
      log: (role: any, text: string) => pushAutoLog(role, text),
      actions: {
        setPrompt: (s: string) => setPagePrompt(s),

        // Guarded compose
        composeInstant: async () => {
          await guardedExec(`Plan: compose "${pagePrompt}"`, () => composeInstant());
        },

        // Guarded chip
        applyChip: async (chip: string) => {
          await guardedExec(`Plan: apply chip "${chip}"`, () => applyChip(chip));
        },

        setZeroJs: async (on: boolean) => {
          setForceNoJS(on);
          const cur = specRef.current;
          if (cur) await recompose(cur);
        },

        runArmyTop: () => runArmyTop(),

        // Guarded blend
        blendTopWinner: async () => {
          const top = (armyTopRef.current && armyTopRef.current[0]) || null;
          if (!top) {
            pushAutoLog("pilot", 'No Army winners yet. Say “run army” first.');
            return;
          }
          await guardedExec("Plan: blend sections from top winner", () => blendWinner(top));
        },

        // AB toggle (start basic)
        startBasicAB: () => {
          setAb((a) => (a.on ? a : { ...a, on: true, exp: a.exp || `exp_${rid(6)}`, arm: "A" }));
        },

        // NEW — AB voice controls
        toggleAB: (on?: boolean) => {
          setAb((a) => (on == null ? { ...a, on: !a.on } : { ...a, on: !!on }));
        },
        setABAuto: (cfg: Partial<typeof abAuto>) => {
          setAbAuto((x) => ({ ...x, ...cfg }));
        },
        viewArm: (arm: "A" | "B") => {
          setAb((a) => {
            const target = arm === "A" ? a.A : a.B;
            if (target?.url) setPreview(target.url, target.pageId || null);
            return { ...a, arm };
          });
        },

        // Pause / Resume Autopilot
        setAutopilot: (on: boolean) => setAutopilotOn(!!on),

        undo: () => {
          const h = historyRef.current || [];
          if (h.length >= 2) {
            const node = h[1];
            setPreview(node.url, node.pageId);
            setHistory((old) => old.slice(1));
          }
        },

        reportStatus: async () => {
          const p = proofRef.current;
          if (!p) return null;
          const cls = typeof p.cls_est === "number" ? p.cls_est.toFixed(3) : "—";
          const lcp = typeof p.lcp_est_ms === "number" ? `${Math.round(p.lcp_est_ms)} ms` : "—";
          const a11y = p.a11y ? "PASS" : "FAIL";
          const proofOk = p.proof_ok ? "OK" : "BLOCKED";
          return `CLS ${cls} · LCP ${lcp} · A11y ${a11y} · Proof ${proofOk}`;
        },

        setGoalAndApply: async (n: number) => {
          const g = clamp01(n);
          setGoal(g);
          await applyGoal(g);
        },

        setDataSkin: async (skin: DataSkin) => {
          setDataSkin(skin);
        },

        toggleComments: (on?: boolean) => {
          if (on === true) {
            setShowComments(true);
            setCommentMode(true);
            pushAutoLog("pilot", "Comment mode armed — click to drop.");
          } else if (on === false) {
            setCommentMode(false);
            setShowComments(false);
          } else {
            setShowComments((v) => !v);
          }
        },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, armyTop, history, persona]);

  // --- re-anchor comment pins to their DOM nodes via CSS path ---
  function reanchorComments() {
    const doc =
      frameRef.current?.contentDocument || frameRef.current?.contentWindow?.document || null;
    if (!doc || comments.length === 0) return;
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const next = comments.map((c) => {
      if (!c.path) return c;
      const el = doc.querySelector<HTMLElement>(c.path);
      if (!el) return c;
      const r = el.getBoundingClientRect();
      const nx = clamp(r.left + r.width / 2, 0, 1280);
      const ny = clamp(r.top + r.height / 2, 0, 800);
      if (Math.abs(nx - c.x) < 0.5 && Math.abs(ny - c.y) < 0.5) return c; // no churn
      return { ...c, x: nx, y: ny };
    });
    const moved =
      next.length === comments.length &&
      next.some((n, i) => n.x !== comments[i].x || n.y !== comments[i].y);
    if (moved) {
      setComments(next);
      if (pageId) saveComments(pageId, next);
    }
  }
  useEffect(() => {
    const t = setTimeout(() => reanchorComments(), 50);
    const w = frameRef.current?.contentWindow;
    const handler = () => reanchorComments();
    try {
      w?.addEventListener("resize", handler);
    } catch {}
    return () => {
      clearTimeout(t);
      try {
        w?.removeEventListener("resize", handler);
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, pageId, showComments, comments.length]);

  function startRecording() {
    recordingRef.current = [];
    setRecording(true);
    setShowMacros(true);
  }
  function stopAndSave() {
    const steps = Array.from(new Set(recordingRef.current));
    setRecording(false);
    if (!macroName.trim() || steps.length === 0) return;
    const next = [...macros, { name: macroName.trim(), steps }];
    setMacros(next);
    saveMacros(next);
    setMacroName("");
  }
  async function playMacro(m: Macro) {
    await applyChipBatch(m.steps);
  }
  function deleteMacro(idx: number) {
    const next = macros.filter((_, i) => i !== idx);
    setMacros(next);
    saveMacros(next);
  }

  // unified preview setter (adds ?__exp & ?__arm when A/B is on)
  function setPreview(u: string | null, pid: string | null) {
    if (!u) {
      setUrl(null);
      setPageId(null);
      return;
    }
    let final = u;
    if (ab.on && ab.exp) {
      const qp = `__exp=${encodeURIComponent(ab.exp)}&__arm=${ab.arm}`;
      final = u.includes("?") ? `${u}&${qp}` : `${u}?${qp}`;
    }
    if (dataSkin && dataSkin !== "normal") {
      const qp = `__data=${encodeURIComponent(dataSkin)}`;
      final = final.includes("?") ? `${final}&${qp}` : `${final}?${qp}`;
    }
    setUrl(final);
    setPageId(pid);
  }
  function pushHistory(entry: { url: string | null; pageId: string | null; spec?: Spec }) {
    setHistory((h) =>
      [
        { ts: Date.now(), url: entry.url, pageId: entry.pageId, prompt: pagePrompt, spec: entry.spec },
        ...h,
      ].slice(0, 50)
    );
  }

  const abs = (p: string) => {
    if (/^https?:\/\//i.test(p)) return p;
    const host = location.host.replace(":5173", ":3000");
    const base = (window as any).__APP_ORIGIN__ || `${location.protocol}//${host}`;
    return `${base}${p}`;
  };

  /** keep a local, editable copy of section order */
  useEffect(() => {
    const arr = (spec?.layout?.sections || []) as string[];
    setSectionOrder(Array.isArray(arr) ? [...arr] : []);
  }, [spec?.layout?.sections]);

  // CRDT sync helper — push local order into Yjs array
  function setSectionsCrdt(order: string[]) {
    const yArr = ySectionsRef.current;
    if (!yArr) return;
    yMuteRef.current = true;
    try {
      yArr.delete(0, yArr.length);
      yArr.insert(0, order);
    } finally {
      yMuteRef.current = false;
    }
  }

  function moveSection(idx: number, dir: -1 | 1) {
    setSectionOrder((prev) => {
      const next = prev.slice();
      const ni = idx + dir;
      if (ni < 0 || ni >= next.length) return prev;
      const [it] = next.splice(idx, 1);
      next.splice(ni, 0, it);
      setSectionsCrdt(next);
      return next;
    });
  }

  async function applySectionOrder() {
    if (!spec) return;
    const order = sectionOrder.slice();
    setSectionsCrdt(order);
    const next: Spec = {
      ...spec,
      layout: { ...(spec.layout || {}), sections: order },
    };
    setSpec(next);
    await recompose(next);
  }
  async function applySectionOrderNow(order: string[]) {
    if (!spec) return;
    setSectionsCrdt(order);
    const next: Spec = { ...spec, layout: { ...(spec.layout || {}), sections: order } };
    setSectionOrder(order.slice());
    setSpec(next);
    await recompose(next);
  }

  /** -------------------- compose paths -------------------- **/
  async function composeInstant() {
    const r = await fetch("/api/ai/instant", json({ prompt: pagePrompt, sessionId, breadth }));
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "instant_failed");
    setSpec(j.spec || null);
    setChips((j.chips || []) as string[]);
    const u = j.url || (j.result && (j.result.url || j.result.path)) || null;
    const pid = j?.result?.pageId || null;
    setPreview(u, pid);
    pushHistory({ url: u, pageId: pid, spec: j?.spec });
  }

  async function recompose(s: Spec) {
    if (!s?.layout?.sections) return;
    const brandPrimary = s?.brandColor || s?.brand?.primary || "#6d28d9";
    const composeAction = {
      kind: "compose",
      cost_est: 0,
      gain_est: 20,
      args: {
        sections: s.layout.sections,
        copy: s.copy || {},
        brand: { primary: brandPrimary },
        variantHints: VARIANT_HINTS,
        breadth,
        forceStripJS: forceNoJS,
      },
    };
    const r = await fetch("/api/ai/act", json({ sessionId, spec: s, action: composeAction }));
    const j = await r.json();
    const u = j?.result?.url || j?.result?.path || null;
    const pid = j?.result?.pageId || null;
    setPreview(u, pid);
    pushHistory({ url: u, pageId: pid, spec: j?.spec || s });
  }

  async function applyChip(chip: string) {
    if (!spec) return;
    if (recording) recordingRef.current.push(`chip:${chip}`);
    const r = await fetch("/api/ai/chips/apply", json({ sessionId, spec, chip }));
    const j = await r.json();
    if (!j.ok) return;
    setSpec(j.spec);
    await recompose(j.spec);
  }

  async function applyChipBatch(batch: string[]) {
    if (!spec || batch.length === 0) return;
    let next = spec;
    for (const raw of batch) {
      const chip = raw.startsWith("chip:") ? raw.slice(5) : raw;
      if (recording) recordingRef.current.push(`chip:${chip}`);
      const r = await fetch("/api/ai/chips/apply", json({ sessionId, spec: next, chip }));
      const j = await r.json();
      if (!j.ok) continue;
      next = j.spec;
    }
    setSpec(next);
    await recompose(next);
  }

  async function swapVector(q = "") {
    if (!spec) return;
    const clean = (q || hoverMeta?.aria || hoverMeta?.text || hoverMeta?.tag || "illustration")
      .toLowerCase()
      .slice(0, 48);
    const r = await fetch(`/api/ai/vectors/search?q=${encodeURIComponent(clean)}&limit=1`);
    const j = await r.json();
    const vurl = j?.items?.[0]?.url || j?.items?.[0]?.file || null;
    if (!vurl) return;
    const next = { ...spec, copy: { ...(spec.copy || {}), ILLUSTRATION_URL: vurl } };
    setSpec(next);
    await recompose(next);
  }

  async function runArmyTop() {
    setArmyBusy(true);
    try {
      const r = await fetch(
        "/api/ai/army",
        json({
          prompt: pagePrompt,
          sessionId,
          concurrency: 5,
          count: 20,
          strict: true,
        })
      );
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "army_failed");

      const items = Array.isArray(j.winners) ? j.winners : [];
      const clean = items
        .filter((w: any) => w && (w.url || w.path) && Array.isArray(w.sections))
        .map((w: any) => ({
          ...w,
          url: w.url || w.path || null,
          pageId: w.pageId || null,
          score: Number(w.score || 0),
          proof_ok: !!w.proof_ok,
        }));

      clean.sort((a: any, b: any) => Number(b.proof_ok) - Number(a.proof_ok) || b.score - a.score);

      setArmyTop(clean.slice(0, 20));
    } finally {
      setArmyBusy(false);
    }
  }
  function openWinner(w: any) {
    setPreview(w?.url || null, w?.pageId || null);
    pushHistory({ url: w?.url || null, pageId: w?.pageId || null });
  }

  /** -------------------- Army Delta Blender (sections only, deterministic) -------------------- **/
  function blendSections(current: string[] = [], winner: string[] = []) {
    const winByBase = new Map<string, string>();
    for (const sec of winner) winByBase.set(baseOf(sec), sec);
    const out = current.map((sec) => winByBase.get(baseOf(sec)) || sec);
    return out;
  }
  async function blendWinner(w: any) {
    if (!spec) return;
    const wSections = Array.isArray(w?.sections) ? (w.sections as string[]) : [];
    if (wSections.length === 0) {
      return openWinner(w);
    }
    const next: Spec = {
      ...spec,
      layout: {
        ...(spec.layout || {}),
        sections: blendSections(spec.layout?.sections || [], wSections),
      },
    };
    setSpec(next);
    await recompose(next);
  }

  /** -------------------- proof/perf fetch -------------------- **/
  useEffect(() => {
    (async () => {
      if (!pageId) return setProof(null);
      try {
        const r = await fetch(`/api/ai/proof/${pageId}`);
        const j = await r.json();
        setProof(j?.proof || null);
      } catch {
        setProof(null);
      }
    })();
  }, [pageId]);

  /** -------------------- A/B KPI poller + Auto-Stop -------------------- **/
  useEffect(() => {
    if (!ab.on || !ab.exp) {
      setAbKpi(null);
      return;
    }

    let stop = false;

    // ---- helpers: stats ----
    function erf(x: number) {
      // Numerical approximation
      const sign = x < 0 ? -1 : 1;
      x = Math.abs(x);
      const a1 = 0.254829592,
        a2 = -0.284496736,
        a3 = 1.421413741,
        a4 = -1.453152027,
        a5 = 1.061405429,
        p = 0.3275911;
      const t = 1 / (1 + p * x);
      const y =
        1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x);
      return sign * y;
    }
    function cdfStdNorm(z: number) {
      return 0.5 * (1 + erf(z / Math.SQRT2));
    }
    function evalConfidence(
      A: { views: number; conv: number },
      B: { views: number; conv: number }
    ) {
      const vA = Math.max(1, A.views || 0);
      const vB = Math.max(1, B.views || 0);
      const cA = Math.max(0, A.conv || 0);
      const cB = Math.max(0, B.conv || 0);
      const pA = cA / vA;
      const pB = cB / vB;
      const pooled = (cA + cB) / (vA + vB);
      const se = Math.sqrt(pooled * (1 - pooled) * (1 / vA + 1 / vB)) || 1e-9;
      const z = (pB - pA) / se;
      // one-sided confidence that the higher CTR is truly higher
      const higherIsB = pB >= pA;
      const conf = higherIsB ? cdfStdNorm(z) : cdfStdNorm(-z);
      const lift = pA > 0 ? ((pB - pA) / pA) * 100 : pB > 0 ? 100 : 0;
      return { conf, pA, pB, lift, winner: higherIsB ? ("B" as const) : ("A" as const) };
    }

    async function tick() {
      try {
        const r = await fetch(`/api/metrics?experiment=${encodeURIComponent(ab.exp)}`);
        const j = await r.json().catch(() => ({} as any));
        const s =
          (j?.experiments && j.experiments[ab.exp]) ||
          (j?.exp && j.exp[ab.exp]) ||
          j?.data ||
          j ||
          {};
        const A = s.A || s.armA || s.a || {};
        const B = s.B || s.armB || s.b || {};

        const out = {
          A: {
            views: Number(A.views || A.seen || A.impressions || 0),
            conv: Number(A.conversions || A.conv || 0),
          },
          B: {
            views: Number(B.views || B.seen || B.impressions || 0),
            conv: Number(B.conversions || B.conv || 0),
          },
        };
        if (!stop) setAbKpi(out);

        // ---- Auto-stop rule ----
        if (!stop && abAuto.enabled && ab.on) {
          const viewsOK = out.A.views >= abAuto.minViews && out.B.views >= abAuto.minViews;
          const convOK = out.A.conv >= abAuto.minConv || out.B.conv >= abAuto.minConv;
          if (viewsOK && convOK) {
            const { conf, pA, pB, lift, winner } = evalConfidence(out.A, out.B);
            if (conf >= abAuto.confidence) {
              // stop experiment, set winner, announce
              setAb((a) => ({ ...a, on: false, arm: winner }));
              setAbWinner(winner);
              const confPct = Math.round(conf * 100);
              const ctrA = (pA * 100).toFixed(2) + "%";
              const ctrB = (pB * 100).toFixed(2) + "%";
              const msg = `A/B auto-stop → ${winner} wins. conf≈${confPct}% · CTR A ${ctrA} vs B ${ctrB} · lift ${lift.toFixed(
                1
              )}%`;
              pushAutoLog("pilot", msg);
              try {
                say(msg);
              } catch {}
            }
          }
        }
      } catch {
        if (!stop) setAbKpi(null);
      }
    }

    tick();
    const id = setInterval(tick, 5000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [ab.on, ab.exp, abAuto.enabled, abAuto.confidence, abAuto.minViews, abAuto.minConv]);

  /** -------------------- first load -------------------- **/
  useEffect(() => {
    composeInstant().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** -------------------- color/contrast utils (for HUD) -------------------- **/
  function parseCssColor(c?: string): [number, number, number, number] | null {
    if (!c) return null;
    c = c.trim().toLowerCase();

    // rgba()/rgb()
    let m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([01]?\.?\d*))?\s*\)$/);
    if (m) {
      const a = m[4] != null ? Math.max(0, Math.min(1, parseFloat(m[4]))) : 1;
      return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10), a];
    }

    // #rrggbb
    let h = c.match(/^#([0-9a-f]{6})$/i);
    if (h) {
      const r = parseInt(h[1].slice(0, 2), 16);
      const g = parseInt(h[1].slice(2, 4), 16);
      const b = parseInt(h[1].slice(4, 6), 16);
      return [r, g, b, 1];
    }

    // #rgb
    h = c.match(/^#([0-9a-f]{3})$/i);
    if (h) {
      const rr = h[1][0],
        gg = h[1][1],
        bb = h[1][2];
      const r = parseInt(rr + rr, 16);
      const g = parseInt(gg + gg, 16);
      const b = parseInt(bb + bb, 16);
      return [r, g, b, 1];
    }

    return null;
  }
  function flattenOnWhite([r, g, b, a]: [number, number, number, number]): [number, number, number] {
    if (a >= 0.999) return [r, g, b];
    return [
      Math.round(255 * (1 - a) + r * a),
      Math.round(255 * (1 - a) + g * a),
      Math.round(255 * (1 - a) + b * a),
    ];
  }
  function relLum([r, g, b]: [number, number, number]) {
    const srgb = [r, g, b]
      .map((v) => v / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  }
  function contrastRatio(fg: [number, number, number], bg: [number, number, number]) {
    const L1 = relLum(fg),
      L2 = relLum(bg);
    const [max, min] = L1 > L2 ? [L1, L2] : [L2, L1];
    return (max + 0.05) / (min + 0.05);
  }

  /** -------------------- inject “probe” into iframe -------------------- **/
  useEffect(() => {
    const iframe = frameRef.current;
    if (!iframe) return;

    let cleanupFn: (() => void) | null = null;

    function inject() {
      try {
        // A. Null-guard the iframe before use (micro-fix)
        if (!iframe) return;
        const win = iframe.contentWindow!;
        const doc = iframe.contentDocument || win.document;
        if (!win || !doc) return;
        if ((win as any).__yb_injected) return; // guard against double-inject
        (win as any).__yb_injected = true;

        const style = doc.createElement("style");
        style.textContent = `
          html, body { overflow: hidden !important; }
          * { cursor: default !important; }
          @keyframes yb-skel { 0% { background-position: -200px 0 } 100% { background-position: calc(200px + 100%) 0 } }
          .yb-skel {
            color: transparent !important;
            position: relative !important;
            background: linear-gradient(90deg, #eee 25%, #f5f5f5 37%, #eee 63%);
            background-size: 200px 100%;
            animation: yb-skel 1.2s infinite linear;
            border-radius: 4px;
          }
          .yb-error-banner {
            position: absolute; inset: 0 auto auto 0; right: 0; height: 40px;
            background: #fee; color:#a00; border-bottom:1px solid #f99;
            display:flex; align-items:center; padding:0 12px; font: 12px/1 sans-serif; z-index: 9999;
          }
        `;
        doc.head && doc.head.appendChild(style);

        function cssPath(el: Element | null) {
          if (!el || !(el as HTMLElement).tagName) return "";
          const parts: string[] = [];
          let cur: Element | null = el;
          let guard = 0;
          while (cur && guard++ < 8 && cur !== doc.body) {
            const tag = (cur as HTMLElement).tagName.toLowerCase();
            let idx = 1,
              sib = cur.previousElementSibling;
            while (sib) {
              if ((sib as HTMLElement).tagName === (cur as HTMLElement).tagName) idx++;
              sib = sib.previousElementSibling;
            }
            parts.unshift(`${tag}:nth-of-type(${idx})`);
            cur = cur.parentElement;
          }
          return parts.join(" > ");
        }
        const sendHover = (el: Element | null, _e: MouseEvent) => {
          if (!el) return;
          const r = (el as HTMLElement).getBoundingClientRect();
          const cs = win.getComputedStyle(el as Element);
          const meta = {
            tag: (el as HTMLElement).tagName?.toLowerCase() || "",
            sel: cssPath(el),
            role: (el as HTMLElement).getAttribute?.("role") || "",
            aria: (el as HTMLElement).getAttribute?.("aria-label") || "",
            text: ((el as HTMLElement).textContent || "").trim().slice(0, 120),
            style: {
              color: cs?.color || "",
              backgroundColor: cs?.backgroundColor || "",
              fontSize: cs?.fontSize || "",
              fontWeight: cs?.fontWeight || "",
              lineHeight: cs?.lineHeight || "",
              width: `${Math.round(r.width)}px`,
              height: `${Math.round(r.height)}px`,
              margin: `${cs?.marginTop || "0px"} ${cs?.marginRight || "0px"} ${cs?.marginBottom || "0px"} ${cs?.marginLeft || "0px"}`,
              padding: `${cs?.paddingTop || "0px"} ${cs?.paddingRight || "0px"} ${cs?.paddingBottom || "0px"} ${cs?.paddingLeft || "0px"}`,
            },
          };
          const msg: HoverMsg = {
            type: "yb_hover",
            rect: { x: r.left, y: r.top, w: r.width, h: r.height },
            meta,
          };
          win.parent.postMessage(msg, "*");
        };

        const mm = (e: MouseEvent) => {
          const el = doc.elementFromPoint(e.clientX, e.clientY);
          sendHover(el, e);
        };

        const click = (e: MouseEvent) => {
          const el = doc.elementFromPoint(e.clientX, e.clientY);
          sendHover(el, e);

          // emit a generic click for parent tools (comments, etc.)
          try {
            const pathSel = el ? cssPath(el) : "";
            const r = el ? (el as HTMLElement).getBoundingClientRect() : null;
            win.parent.postMessage(
              {
                type: "yb_click",
                x: e.clientX,
                y: e.clientY,
                sel: pathSel,
                rect: r
                  ? { x: r.left, y: r.top, w: r.width, h: r.height }
                  : { x: e.clientX, y: e.clientY, w: 0, h: 0 },
                text:
                  ((el as HTMLElement).innerText ||
                    (el as HTMLElement).textContent ||
                    "").trim().slice(0, 200),
              },
              "*"
            );
          } catch {}

          // CTA capture + conditional interception (robust: ancestor clickable)
          const clickableEl = (el as HTMLElement)?.closest?.(
            "a,button,[role=\"button\"]"
          ) as HTMLElement | null;
          const clickable = !!clickableEl;

          const params = new URLSearchParams(win.location.search || "");
          const armParam = params.get("__arm") || "";
          const expParam = params.get("__exp") || "";

          // only block default if we're in comment mode or an AB experiment
          const shouldIntercept = commentArmed || !!expParam;

          if (clickable && shouldIntercept) {
            e.preventDefault();
            e.stopPropagation();

            const href =
              (clickableEl as HTMLAnchorElement).href ||
              clickableEl.getAttribute?.("href") ||
              "";

            const text =
              (clickableEl.innerText || clickableEl.textContent || "")
                .trim()
                .slice(0, 120);

            win.parent.postMessage({ type: "yb_cta", arm: armParam, href, text }, "*");
          }
        };

        doc.addEventListener("mousemove", mm, { passive: true });
        doc.addEventListener("click", click, { capture: true });

        // ---- Live Data Skins (apply via postMessage) ----
        const textSelectors = "h1,h2,h3,h4,h5,h6,p,li,span,a,button,th,td,small,label";
        function selectAll(sel: string): HTMLElement[] {
          return Array.from(doc.querySelectorAll(sel)) as HTMLElement[];
        }
        function clearErrorBanner() {
          const b = doc.querySelector(".yb-error-banner");
          if (b && b.parentElement) b.parentElement.removeChild(b);
        }
        function clearSkeleton() {
          selectAll(".yb-skel").forEach((el) => el.classList.remove("yb-skel"));
        }
        function ensureOrig(el: HTMLElement) {
          if (!(el as any).dataset) return;
          const ds = (el as any).dataset as DOMStringMap & {
            ybOrig?: string;
            ybVal?: string;
            ybPh?: string;
          };
          if (ds.ybOrig == null) ds.ybOrig = el.textContent || "";
        }
        function applyEmpty() {
          selectAll(textSelectors).forEach((el) => {
            ensureOrig(el);
            el.textContent = "";
          });
          Array.from(doc.images || []).forEach((img) => ((img as HTMLImageElement).style.opacity = "0.25"));
          selectAll("input,textarea").forEach((el) => {
            const i = el as HTMLInputElement | HTMLTextAreaElement;
            const ds = (i as any).dataset as DOMStringMap & { ybVal?: string; ybPh?: string };
            // FIXED build bug: ensure empty string fallback
            if (ds.ybVal == null) ds.ybVal = i.value || "";
            if (ds.ybPh == null) ds.ybPh = i.placeholder || "";
            i.value = "";
            i.placeholder = "";
          });
        }
        function applyLong() {
          const long = (s: string) => {
            const base = s && s.trim().length ? s : "Lorem ipsum dolor sit amet";
            return (base + " ").repeat(6).trim();
          };
          selectAll(textSelectors).forEach((el) => {
            ensureOrig(el);
            el.textContent = long(el.textContent || "");
          });
        }
        function applySkeleton() {
          clearSkeleton();
          selectAll(textSelectors).forEach((el) => el.classList.add("yb-skel"));
        }
        function applyError() {
          clearErrorBanner();
          const b = doc.createElement("div");
          b.className = "yb-error-banner";
          b.textContent = "Simulated error: data failed to load.";
          doc.body.appendChild(b);
        }
        function restoreNormal() {
          selectAll(textSelectors).forEach((el) => {
            const ds = (el as any).dataset as DOMStringMap & { ybOrig?: string };
            if (ds && ds.ybOrig != null) {
              el.textContent = ds.ybOrig;
              delete ds.ybOrig;
            }
            el.classList.remove("yb-skel");
          });
          Array.from(doc.images || []).forEach((img) => ((img as HTMLImageElement).style.opacity = ""));
          selectAll("input,textarea").forEach((el) => {
            const i = el as HTMLInputElement | HTMLTextAreaElement;
            const ds = (i as any).dataset as DOMStringMap & { ybVal?: string; ybPh?: string };
            if (ds && (ds.ybVal != null || ds.ybPh != null)) {
              if (ds.ybVal != null) {
                i.value = ds.ybVal;
                delete ds.ybVal;
              }
              if (ds.ybPh != null) {
                i.placeholder = ds.ybPh;
                delete ds.ybPh;
              }
            }
          });
          clearErrorBanner();
          clearSkeleton();
        }
        function applySkin(skin: DataSkin) {
          if (skin === "normal") return restoreNormal();
          if (skin === "empty") return applyEmpty();
          if (skin === "long") return applyLong();
          if (skin === "skeleton") return applySkeleton();
          if (skin === "error") return applyError();
        }

        // NEW: listen for comment mode control
        let commentArmed = false;
        const onCtl = (ev: MessageEvent) => {
          const d = ev.data as any;
          if (d && d.type === "yb_comment_mode") commentArmed = !!d.on;
        };
        win.addEventListener("message", onCtl);

        const onSkin = (ev: MessageEvent) => {
          const d = ev.data as any;
          if (d && d.type === "yb_skin") applySkin(d.skin as DataSkin);
        };
        win.addEventListener("message", onSkin);

        // ---- Impressions beacon (views) ----
        function sendSeenBeacon() {
          try {
            const params = new URLSearchParams(win.location.search || "");
            const exp = params.get("__exp");
            const arm = params.get("__arm");
            if (!exp || !arm || !navigator.sendBeacon) return;
            const payload = JSON.stringify({
              experiment: exp,
              variant: arm === "B" ? "B" : "A",
              path: win.location.pathname || "/",
              ts: Date.now(),
            });
            navigator.sendBeacon("/api/kpi/seen", new Blob([payload], { type: "application/json" }));
          } catch {}
        }
        // fire on load + SPA nav
        sendSeenBeacon();

        // SPA-safe: patch pushState + listen popstate
        const _ps = win.history.pushState?.bind(win.history);
        if (_ps) {
          win.history.pushState = function (...args: any[]) {
            const ret = _ps(...args);
            try {
              sendSeenBeacon();
            } catch {}
            return ret;
          } as typeof win.history.pushState;
        }
        const onPop = () => sendSeenBeacon();
        win.addEventListener("popstate", onPop);

        return () => {
          try {
            // remove listeners (note capture=true for click)
            doc.removeEventListener("mousemove", mm as any);
            doc.removeEventListener("click", click as any, true);
            win.removeEventListener("message", onSkin as any);
            win.removeEventListener("message", onCtl as any);
            win.removeEventListener("popstate", onPop as any);
            (win as any).__yb_injected = false;
          } catch {}
        };
      } catch {}
    }

    const onLoad = () => {
      if (typeof cleanupFn === "function") cleanupFn();
      cleanupFn = inject() || null;
    };

    iframe.addEventListener("load", onLoad);
    onLoad(); // run once for current content

    return () => {
      iframe.removeEventListener("load", onLoad);
      if (typeof cleanupFn === "function") cleanupFn();
    };
  }, [url]);

  /** push current Data Skin to iframe (including "normal" → restore) */
  useEffect(() => {
    const win = frameRef.current?.contentWindow;
    try {
      win?.postMessage({ type: "yb_skin", skin: dataSkin }, "*");
    } catch {}
  }, [dataSkin, url]);

  /** NEW: sync comment mode to iframe */
  useEffect(() => {
    const win = frameRef.current?.contentWindow;
    try {
      win?.postMessage({ type: "yb_comment_mode", on: commentMode }, "*");
    } catch {}
  }, [commentMode, url]);

  /** -------------------- receive hover / clicks / conversions from iframe -------------------- **/
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.source !== frameRef.current?.contentWindow) return;
      const d: any = ev.data;
      if (!d) return;

      // conversions
      if (d.type === "yb_cta") {
        if (ab.on && ab.exp) {
          const variant = (d.arm === "B" ? "B" : "A") as "A" | "B";
          const pid = variant === "A" ? ab.A?.pageId || pageId : ab.B?.pageId || pageId;
          fetch(
            "/api/kpi/convert",
            json({
              experiment: ab.exp,
              variant,
              pageId: pid || null,
              meta: { href: d.href || null, text: d.text || null },
            })
          ).catch(() => {});
        }
        return;
      }

      // handle click → comment drop (iframe-aware)
      if (d.type === "yb_click") {
        if (commentMode) {
          const x = Math.max(0, Math.min(1280, Number(d.x || 0)));
          const y = Math.max(0, Math.min(800, Number(d.y || 0)));
          addCommentAt(x, y, d.sel as string, d.text as string);
          setCommentMode(false); // auto-disarm
        }
        return;
      }

      // hovers
      if (d.type !== "yb_hover") return;
      if (freezeHover) return; // don't update while frozen
      const h = d as HoverMsg;
      setHoverBox({ x: h.rect.x, y: h.rect.y, w: h.rect.w, h: h.rect.h });
      setHoverMeta(h.meta || null);
      const cx = h.rect.x + h.rect.w / 2;
      const cy = h.rect.y + h.rect.h / 2;
      setCursorPt({ x: cx, y: cy });
      pingPresence({ x: cx, y: cy });
      const fgR = parseCssColor(h.meta?.style?.color || "");
      const bgR = parseCssColor(h.meta?.style?.backgroundColor || "");
      const fg = fgR ? flattenOnWhite(fgR) : ([0, 0, 0] as [number, number, number]);
      const bg = bgR ? flattenOnWhite(bgR) : ([255, 255, 255] as [number, number, number]);
      const ratio = parseFloat(contrastRatio(fg, bg).toFixed(2));
      setContrastInfo({ ratio, passAA: ratio >= 4.5 });
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [ab, pageId, commentMode, freezeHover]);

  /** -------------------- CRDT room wiring (pageId-scoped) -------------------- **/
  useEffect(() => {
    if (yProvRef.current) {
      try {
        yProvRef.current.destroy();
      } catch {}
      yProvRef.current = null;
    }
    if (yDocRef.current) {
      try {
        yDocRef.current.destroy();
      } catch {}
      yDocRef.current = null;
    }
    if (!pageId) return;

    const doc = new Y.Doc();
    yDocRef.current = doc;

    const provider = new WebrtcProvider(`ybuilt_cursor_${pageId}`, doc, {
      signaling: ["wss://signaling.yjs.dev"],
    });
    yProvRef.current = provider;

    const aw = provider.awareness;
    aw.setLocalState({ id: sessionId, role, layer, x: cursorPt?.x ?? 0, y: cursorPt?.y ?? 0 });

    const onAwChange = () => {
      const states = Array.from(aw.getStates().values()) as any[];
      const m: Record<string, { x: number; y: number; layer: string; role: Role; ts: number }> = {};
      for (const s of states) {
        if (!s?.id || s.id === sessionId) continue;
        m[s.id] = {
          x: Number(s.x ?? 0),
          y: Number(s.y ?? 0),
          layer: String(s.layer ?? "Layout"),
          role: (s.role as Role) || "Edit",
          ts: Date.now(),
        };
      }
      setPeers(m);
    };
    aw.on("change", onAwChange);

    const ySections = doc.getArray<string>("sections");
    ySectionsRef.current = ySections;

    const seed = (spec?.layout?.sections || []) as string[];
    if (ySections.length === 0 && seed.length) {
      yMuteRef.current = true;
      ySections.insert(0, seed);
      yMuteRef.current = false;
    } else if (ySections.length > 0) {
      setSectionOrder(ySections.toArray());
    }

    const obs = () => {
      if (yMuteRef.current) return;
      const order = ySections.toArray();
      setSectionOrder(order);

      const base = specRef.current;
      if (base) {
        const next: Spec = { ...base, layout: { ...(base.layout || {}), sections: order } };
        setSpec(next);
        recompose(next);
      }
    };
    ySections.observe(obs);

    return () => {
      try {
        ySections.unobserve(obs);
      } catch {}
      try {
        aw.off("change", onAwChange);
      } catch {}
      try {
        provider.destroy();
      } catch {}
      try {
        doc.destroy();
      } catch {}
      yProvRef.current = null;
      yDocRef.current = null;
      ySectionsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  /** -------------------- Goal Simulator (slider → chip plan) -------------------- **/
  const [goal, setGoal] = useState(60);
  const goalRef = useRef<HTMLInputElement>(null);
  function chipsForGoal(g: number) {
    if (g < 34) return ["More minimal"];
    if (g < 67) return ["Use email signup CTA"];
    return ["Use email signup CTA", "More minimal"];
  }
  // (F) applyGoal with optional override
  async function applyGoal(gOverride?: number) {
    const g = typeof gOverride === "number" ? gOverride : goal;
    const plan = chipsForGoal(g);
    await applyChipBatch(plan);
    if (g >= 67) {
      if (!forceNoJS) setForceNoJS(true);
      if (spec) await recompose(spec);
    } else {
      if (forceNoJS) {
        setForceNoJS(false);
        if (spec) await recompose(spec);
      }
    }
  }

  /** -------------------- Narrative Mode (explain deltas) -------------------- **/
  const [showNarrative, setShowNarrative] = useState(false);
  const [narrative, setNarrative] = useState<string[]>([]);
  const prevProofRef = useRef<any>(null);

  useEffect(() => {
    if (!proof) return;
    const prev = prevProofRef.current;
    const lines: string[] = [];
    if (prev) {
      if (typeof prev.lcp_est_ms === "number" && typeof proof.lcp_est_ms === "number") {
        const d = Math.round(proof.lcp_est_ms - prev.lcp_est_ms);
        if (d !== 0) lines.push(`LCP ${d > 0 ? "↑" : "↓"} ${Math.abs(d)} ms`);
      }
      if (typeof prev.cls_est === "number" && typeof proof.cls_est === "number") {
        const d = Number((proof.cls_est - prev.cls_est).toFixed(3));
        if (d !== 0) lines.push(`CLS ${d > 0 ? "↑" : "↓"} ${Math.abs(d)}`);
      }
      if (!!prev.proof_ok !== !!proof.proof_ok) {
        lines.push(`Proof ${proof.proof_ok ? "unblocked" : "blocked"} by evidence gate`);
      }
      if (!!prev.a11y !== !!proof.a11y) {
        lines.push(`A11y ${proof.a11y ? "pass" : "fail"}`);
      }
    } else {
      lines.push("Baseline established.");
    }

    if (history.length >= 2) {
      const cur = history[0]?.spec;
      const last = history[1]?.spec;
      const lenA = (cur?.layout?.sections || []).length;
      const lenB = (last?.layout?.sections || []).length;
      if (lenA !== lenB) lines.push(`Sections ${lenB} → ${lenA}`);
      const bpA = cur?.brand?.primary || cur?.brandColor;
      const bpB = last?.brand?.primary || last?.brandColor;
      if (bpA && bpB && bpA !== bpB) lines.push("Brand primary updated");
    }

    setNarrative(lines);
    prevProofRef.current = proof;
  }, [proof, history]);

  /** -------------------- pan / zoom controls -------------------- **/
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  function onWheel(e: React.WheelEvent) {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const next = Math.min(2, Math.max(0.5, zoom + (e.deltaY < 0 ? 0.1 : -0.1)));
    setZoom(Number(next.toFixed(2)));
  }
  function onMouseDown(e: React.MouseEvent) {
    if (!(e.buttons & 1)) return;
    // B. Stop using getModifierState("Space") (micro-fix)
    if (e.code !== "Space" && e.key !== " ") return;
    setPanning(true);
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  }
  function onMouseMove(e: React.MouseEvent) {
    // PIN DRAG: when a pin is being dragged, update its position in surface coords (zoom-aware)
    if (dragId && surfaceRef.current) {
      const r = surfaceRef.current.getBoundingClientRect();
      const cx = (e.clientX - r.left) / Math.max(zoom, 1e-6);
      const cy = (e.clientY - r.top) / Math.max(zoom, 1e-6);
      const { dx, dy } = dragOffRef.current || { dx: 0, dy: 0 };
      const nx = Math.max(0, Math.min(1280, cx - dx));
      const ny = Math.max(0, Math.min(800, cy - dy));
      setComments((prev) => prev.map((x) => (x.id === dragId ? { ...x, x: nx, y: ny } : x)));
    }

    // existing pan logic…
    if (!panning || !panStart.current) return;
    setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
  }
  function onMouseUp() {
    // existing pan cleanup...
    setPanning(false);
    panStart.current = null;

    // finalize pin drag (save the latest snapshot)
    if (dragId && pageId) saveComments(pageId, commentsRef.current);
    setDragId(null);
    dragOffRef.current = null;
  }

  /** -------------------- Hold-to-peek overlays (keyboard) -------------------- **/
  const [modProof, setModProof] = useState(false);
  const [modPerf, setModPerf] = useState(false);
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.altKey) setModProof(true);
      if (e.ctrlKey || e.metaKey) setModPerf(true);
      if (e.shiftKey) setModMeasure(true); // NEW
      if (e.key === "Escape") setNoteArm(false);
    };
    const ku = (e: KeyboardEvent) => {
      if (!e.altKey) setModProof(false);
      if (!(e.ctrlKey || e.metaKey)) setModPerf(false);
      if (!e.shiftKey) setModMeasure(false); // NEW
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, []);

  // Global hotkeys (ignore when typing)
  useEffect(() => {
    const isTyping = (el: Element | null) => {
      if (!el) return false;
      const t = (el as HTMLElement).tagName;
      return t === "INPUT" || t === "TEXTAREA" || (el as HTMLElement).isContentEditable;
    };
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(document.activeElement)) return;
      const k = e.key;
      if (k === "r" || k === "R") {
        e.preventDefault();
        spec && recompose(spec);
      } else if (k === "[") {
        setZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))));
      } else if (k === "]") {
        setZoom((z) => Math.min(2, Number((z + 0.1).toFixed(2)))) ;
      } else if (k === "0") {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      } else if (k === "p" || k === "P") {
        setShowProof((v) => !v);
      } else if (k === "o" || k === "O") {
        setShowPerf((v) => !v);
      } else if (k === "m" || k === "M") {
        setShowMacros((v) => !v);
      } else if (k === "h" || k === "H") {
        setShowHistory((v) => !v);
      } else if (k === "n" || k === "N") {
        setShowNarrative((v) => !v);
      } else if (k === "g" || k === "G") {
        goalRef.current?.focus();
      } else if (k === "a" || k === "A") {
        setAb((a) =>
          a.on ? { ...a, on: false } : { ...a, on: true, exp: a.exp || `exp_${rid(6)}`, arm: "A" }
        );
      } else if (k === "c" || k === "C") {
        // NEW: toggle comment mode
        e.preventDefault();
        setCommentMode((v) => !v);
      } else if (k === "Escape") {
        // NEW: cancel comment mode
        setCommentMode(false);
      } else if (k === "u" || k === "U") {
        // quick undo
        undoLast();
      } else if (k === "d" || k === "D") {
        // toggle Measurements overlay
        setMeasureOn((v) => !v);
      } else if (k === "f" || k === "F") {
        // freeze/unfreeze hover box
        setFreezeHover((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [spec, history]);

  /** -------------------- Time-Travel scrubber -------------------- **/
  const [scrubIdx, setScrubIdx] = useState<number>(0);
  useEffect(() => {
    if (!history.length) return;
    const node = history[scrubIdx];
    if (node) setPreview(node.url, node.pageId);
  }, [scrubIdx, history]);

  /** -------------------- Push-to-talk (Autopilot) -------------------- **/
  async function promptOnce(): Promise<string | null> {
    // Voice first (Chrome), fallback to text prompt
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (SR) {
      try {
        const rec = new SR();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = "en-US";
        setListening(true);
        const text: string = await new Promise((resolve, reject) => {
          rec.onresult = (e: any) => resolve(String(e.results[0][0].transcript || ""));
          rec.onerror = (err: any) => reject(err);
          rec.onend = () => {};
          rec.start();
        });
        setListening(false);
        return text || null;
      } catch {
        setListening(false);
      }
    }
    // Fallback
    const t = window.prompt(
      'Type a command (e.g., “make a dark waitlist”, “run army”, “undo”):'
    );
    return (t && t.trim()) || null;
  }

  // ephemeral secrets holder (in-tab only)
  const secretsRef = useRef<{ emailApiKey?: string }>({});

  // Local fallback: parse simple voice/text commands without external Autopilot
  async function localHandle(raw: string): Promise<boolean> {
    const t = (raw || "").trim().toLowerCase();

    const onoff = () => (t.includes("off") ? false : t.includes("on") ? true : null);

    // compose / recompose
    if (/^(make|compose)\b/.test(t)) {
      await composeInstant();
      return true;
    }
    if (/\brecompose\b/.test(t)) {
      const cur = specRef.current;
      if (cur) await recompose(cur);
      return true;
    }

    // army
    if (/\brun army\b/.test(t)) {
      await runArmyTop();
      return true;
    }
    if (/\bblend( winner)?\b/.test(t)) {
      const top = (armyTopRef.current && armyTopRef.current[0]) || null;
      if (top) {
        await blendWinner(top);
      } else {
        pushAutoLog("pilot", "No Army winners yet. Try “run army”.");
      }
      return true;
    }

    // A/B controls
    if (/start( an)? (a\/?b|ab)/.test(t)) {
      setAb((a) => (a.on ? a : { ...a, on: true, exp: a.exp || `exp_${rid(6)}`, arm: "A" }));
      return true;
    }
    if (/stop( the)? (a\/?b|ab)/.test(t)) {
      setAb((a) => ({ ...a, on: false }));
      return true;
    }
    const mView = t.match(/\bview (a|b)\b/);
    if (mView) {
      const arm = mView[1].toUpperCase() as "A" | "B";
      setAb((a) => {
        const target = arm === "A" ? a.A : a.B;
        if (target?.url) setPreview(target.url, target.pageId || null);
        return { ...a, arm };
      });
      return true;
    }
    const mExp = t.match(/\bexperiment (?:is|=)\s*([a-z0-9_\-]+)/);
    if (mExp) {
      setAb((a) => ({ ...a, exp: mExp[1] }));
      return true;
    }

    // goal + chips
    const mGoal = t.match(/\bgoal\s+(\d{1,3})\b/);
    if (mGoal) {
      const n = Math.max(0, Math.min(100, parseInt(mGoal[1], 10)));
      setGoal(n);
      await applyGoal(n);
      return true;
    }

    // zero-js
    if (/\bzero[-\s]?js\b/.test(t) || /\bno js\b/.test(t)) {
      const val = onoff();
      setForceNoJS(val == null ? true : val);
      const cur = specRef.current;
      if (cur) await recompose(cur);
      return true;
    }

    // data skins
    const mData = t.match(/\bdata (normal|empty|long|skeleton|error)\b/);
    if (mData) {
      setDataSkin(mData[1] as DataSkin);
      return true;
    }

    // quick chips
    if (/\bfix contrast\b|\bread(ability|able)\b/.test(t)) {
      await applyChip("More minimal");
      return true;
    }
    if (/\b(email|signup) cta\b|\bsignups?\b/.test(t)) {
      await applyChip("Use email signup CTA");
      return true;
    }

    // wire welcome email (opens secure drawer; ephemeral only)
    if (/\b(wire|connect|enable)\b.*\b(email)\b/.test(t) || /\bwelcome email\b/.test(t)) {
      pushAutoLog("pilot", "I need a provider key to wire email. Opening secure input…");
      try {
        say("I need your email API key. I opened a secure drawer.");
      } catch {}
      const key = await securePrompt({
        title: "Secure input — Email provider key",
        label: "API key",
        placeholder: "e.g., postmark/ resend/ mailgun key",
      });
      if (!key) {
        pushAutoLog("pilot", "Secure input cancelled. Nothing stored.");
        try {
          say("Cancelled. I didn’t store anything.");
        } catch {}
        return true;
      }
      // Ephemeral — memory only, not persisted, not logged.
      secretsRef.current.emailApiKey = key;
      pushAutoLog("pilot", "Key received (ephemeral). I will never store or speak it.");
      try {
        say("Got it. Key held in memory for this tab only.");
      } catch {}
      return true;
    }

    // comments
    if (/\b(comment|note)\b/.test(t)) {
      setCommentMode(true);
      pushAutoLog("pilot", "Comment mode armed — click to drop.");
      return true;
    }
    if (/\btoggle comments?\b/.test(t)) {
      setShowComments((v) => !v);
      return true;
    }

    // overlays + tools
    if (/\b(proof|perf|measure|freeze)\b/.test(t)) {
      if (t.includes("proof")) {
        const v = onoff();
        setShowProof(v == null ? ((x) => !x) as any : v);
      }
      if (t.includes("perf")) {
        const v = onoff();
        setShowPerf(v == null ? ((x) => !x) as any : v);
      }
      if (t.includes("measure")) {
        const v = onoff();
        setMeasureOn(v == null ? ((x) => !x) as any : v);
      }
      if (t.includes("freeze")) {
        const v = onoff();
        setFreezeHover(v == null ? ((x) => !x) as any : v);
      }
      return true;
    }

    // persona
    const mPersona = t.match(/\bpersona (builder|mentor|analyst|playful)\b/);
    if (mPersona) {
      setPersona(mPersona[1] as any);
      return true;
    }

    // zoom
    if (/\bzoom in\b/.test(t)) {
      setZoom((z) => Math.min(2, Number((z + 0.1).toFixed(2))));
      return true;
    }
    if (/\bzoom out\b/.test(t)) {
      setZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))));
      return true;
    }
    const mZoomPct = t.match(/\bzoom (\d{2,3})%\b/);
    if (mZoomPct) {
      const pct = Math.max(50, Math.min(200, parseInt(mZoomPct[1], 10)));
      setZoom(Number((pct / 100).toFixed(2)));
      return true;
    }
    if (/\breset zoom\b/.test(t)) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return true;
    }

    // undo + status
    if (/\bundo\b/.test(t)) {
      undoLast();
      return true;
    }
    if (/\b(status|report)\b/.test(t)) {
      const p = proofRef.current;
      if (p) {
        const cls = typeof p.cls_est === "number" ? p.cls_est.toFixed(3) : "—";
        const lcp = typeof p.lcp_est_ms === "number" ? `${Math.round(p.lcp_est_ms)} ms` : "—";
        const a11y = p.a11y ? "PASS" : "FAIL";
        const proofOk = p.proof_ok ? "OK" : "BLOCKED";
        const msg = `CLS ${cls} · LCP ${lcp} · A11y ${a11y} · Proof ${proofOk}`;
        pushAutoLog("pilot", msg);
        try {
          say(msg);
        } catch {}
      }
      return true;
    }

    return false;
  }

  async function handlePTT() {
    if (!autopilotOn) return;
    const text = await promptOnce();
    if (!text) return;
    pushAutoLog("you", text);

    // Fast local parse first; then fall back to external Autopilot if present
    const didLocal = await localHandle(text);
    if (!didLocal && autopilotRef.current && typeof (autopilotRef.current as any).handle === "function") {
      try {
        await (autopilotRef.current as any).handle(text);
      } catch {}
    }
  }

  /** -------------------- overlay content -------------------- **/
  const proofCounts = useMemo(() => {
    const c = (proof && proof.fact_counts) || {};
    return [
      ["evidenced", c.evidenced || 0],
      ["redacted", c.redacted || 0],
      ["neutral", c.neutral || 0],
    ];
  }, [proof]);

  const cursorPalette = useMemo(() => {
    const base = [
      {
        label: "Copy selector",
        act: () => {
          const sel = hoverMeta?.sel || "";
          if (!sel) return;
          try {
            navigator.clipboard?.writeText(sel);
          } catch {}
        },
      },
      { label: "More minimal", act: () => applyChip("More minimal") },
      { label: "Use dark", act: () => applyChip("Use dark mode") },
      { label: "Email CTA", act: () => applyChip("Use email signup CTA") },
    ];
    base.unshift({ label: "Note", act: () => addCommentAtCursor() });
    const tag = (hoverMeta?.tag || "").toLowerCase();
    if (tag === "img" || tag === "svg") {
      base.unshift({ label: "Swap vector", act: () => swapVector() });
    }
    if (tag === "button" || tag === "a") {
      base.unshift({ label: "Primary CTA", act: () => applyChip("Use email signup CTA") });
    }
    if (tag === "h1" || tag === "h2") {
      base.unshift({ label: "Soften claim", act: () => applyChip("More minimal") });
    }
    return base.slice(0, 5);
  }, [hoverMeta, spec]);

  /** -------------------- Presence (BroadcastChannel + Yjs awareness) -------------------- **/
  function colorFor(id: string) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    const hue = (h >>> 0) % 360;
    return `hsl(${hue}, 85%, 55%)`;
  }
  function pingPresence(pt?: { x: number; y: number }) {
    const x = pt?.x ?? cursorPt?.x;
    const y = pt?.y ?? cursorPt?.y;
    if (typeof x !== "number" || typeof y !== "number") return;

    const bc = bcRef.current;
    bc?.postMessage({ type: "presence", id: sessionId, x, y, layer, role, ts: Date.now() });

    const aw = yProvRef.current?.awareness;
    if (aw) {
      const cur = aw.getLocalState() || {};
      aw.setLocalState({ ...cur, id: sessionId, x, y, layer, role });
    }
  }
  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).BroadcastChannel) return;
    const bc = new BroadcastChannel("yb_cursor_presence");
    bcRef.current = bc;
    const onMessage = (ev: MessageEvent) => {
      const d = ev.data as any;
      if (!d || d.type !== "presence" || d.id === sessionId) return;
      setPeers((p) => ({
        ...p,
        [d.id]: { x: d.x, y: d.y, layer: String(d.layer), role: d.role, ts: d.ts },
      }));
    };
    bc.addEventListener("message", onMessage);
    const prune = setInterval(() => {
      const now = Date.now();
      setPeers((p) => {
        const next: typeof p = {};
        for (const [id, v] of Object.entries(p)) if (now - (v as any).ts < 10000) next[id] = v as any;
        return next;
      });
    }, 4000);
    pingPresence();
    return () => {
      bc.removeEventListener("message", onMessage);
      bc.close();
      bcRef.current = null;
      clearInterval(prune);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);
  useEffect(() => {
    pingPresence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, layer]);

  /** -------------------- UI -------------------- **/
  return (
    <div className="w-full h-screen grid grid-rows-[auto,1fr] bg-gray-50">
      {/* Top bar */}
      <div className="flex items-center gap-2 p-3 border-b bg-white">
        <input
          value={pagePrompt}
          onChange={(e) => setPagePrompt(e.target.value)}
          className="flex-1 px-3 py-2 rounded border outline-none"
          placeholder="Describe the page… e.g., dark saas waitlist for founders"
        />
        <select
          value={breadth}
          onChange={(e) => setBreadth(e.target.value as any)}
          className="px-2 py-2 rounded border"
          title="Breadth"
        >
          <option value="">normal</option>
          <option value="wide">wide</option>
          <option value="max">max</option>
        </select>
        <select
          value={dataSkin}
          onChange={(e) => setDataSkin(e.target.value as DataSkin)}
          className="px-2 py-2 rounded border"
          title="Data state (mock)"
        >
          <option value="normal">data: normal</option>
          <option value="empty">data: empty</option>
          <option value="long">data: long text</option>
          <option value="skeleton">data: skeleton</option>
          <option value="error">data: error</option>
        </select>
        <label className="flex items-center gap-2 px-3 py-2 rounded border cursor-pointer">
          <input
            type="checkbox"
            checked={forceNoJS}
            onChange={(e) => setForceNoJS(e.target.checked)}
          />
          Zero-JS
        </label>

        {/* Intent Layers */}
        <div className="hidden md:flex items-center gap-1 ml-2 border rounded-lg overflow-hidden">
          {(["Layout", "Copy", "Brand", "Proof", "Perf", "Variants"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setLayer(k)}
              className={`px-2 py-2 text-sm ${
                layer === k ? "bg-black text-white" : "bg-white"
              } border-r last:border-r-0`}
              title={`Intent layer: ${k}`}
            >
              {k}
            </button>
          ))}
        </div>

        {/* Role lanes */}
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="px-2 py-2 rounded border"
          title="Role lane"
        >
          <option value="Edit">Role: Edit</option>
          <option value="Review">Role: Review</option>
          <option value="Proof">Role: Proof</option>
        </select>

        {/* (C) Persona/Character control */}
        <select
          value={persona}
          onChange={(e) => setPersona(e.target.value as any)}
          className="px-2 py-2 rounded border"
          title="Autopilot character/persona"
        >
          <option value="builder">Character: Builder</option>
          <option value="mentor">Character: Mentor</option>
          <option value="analyst">Character: Analyst</option>
          <option value="playful">Character: Playful</option>
        </select>

        {/* Goal simulator */}
        <div className="ml-2 flex items-center gap-2 px-2 py-2 rounded border">
          <span className="text-xs opacity-70">Goal</span>
          <input
            type="range"
            min={0}
            max={100}
            value={goal}
            ref={goalRef}
            onChange={(e) => setGoal(parseInt(e.target.value, 10))}
          />
          <span className="text-xs opacity-70 w-28 text-right">
            {goal < 34 ? "Readability" : goal < 67 ? "Balanced" : "Signups"}
          </span>
          <button onClick={() => applyGoal()} className="px-2 py-1 text-sm rounded border">
            Apply
          </button>
        </div>

        <button onClick={() => composeInstant()} className="px-3 py-2 rounded bg-black text-white">
          Compose
        </button>
        <button
          onClick={() => spec && recompose(spec)}
          className="px-3 py-2 rounded bg-gray-900 text-white"
        >
          Recompose
        </button>

        {/* Autopilot controls */}
        <button
          onClick={() => setAutopilotOn((v) => !v)}
          className={`px-3 py-2 rounded border ${autopilotOn ? "bg-black text-white" : ""}`}
          title="Toggle Autopilot"
        >
          Autopilot {autopilotOn ? "ON" : "OFF"}
        </button>
        <button
          onClick={handlePTT}
          disabled={!autopilotOn}
          className="px-3 py-2 rounded border disabled:opacity-50"
          title="Push-to-talk (uses voice if available, else text)"
        >
          {listening ? "Listening…" : "Push to talk"}
        </button>

        <button
          onClick={runArmyTop}
          className="px-3 py-2 rounded bg-indigo-600 text-white disabled:opacity-50"
          disabled={armyBusy}
          title="Pull top variants from the Army"
        >
          {armyBusy ? "Army…" : "Army Top"}
        </button>

        {/* A/B controls + Lineage + Narrative */}
        <button
          onClick={() =>
            setAb((a) =>
              a.on
                ? { ...a, on: false }
                : { ...a, on: true, exp: a.exp || `exp_${rid(6)}`, arm: "A" }
            )
          }
          className="px-3 py-2 rounded border"
          title="Toggle A/B mode"
        >
          {ab.on ? `A/B: ${ab.arm}` : "A/B mode"}
        </button>
        {ab.on && (
          <input
            value={ab.exp}
            onChange={(e) => setAb((a) => ({ ...a, exp: e.target.value.trim() }))}
            placeholder="experiment name"
            className="px-2 py-2 rounded border w-40"
            title="Experiment name (used in KPI events)"
          />
        )}
        {ab.on && (
          <>
            <button
              onClick={() => setAb((a) => ({ ...a, A: { url, pageId }, arm: "A" }))}
              className="px-2 py-2 rounded border"
              title="Set current as A"
            >
              Set A
            </button>
            <button
              onClick={() => {
                const pick = armyTop?.[0]
                  ? { url: armyTop[0].url || null, pageId: armyTop[0].pageId || null }
                  : { url, pageId };
                setAb((a) => ({ ...a, B: pick, arm: "B" }));
                if (pick.url) setPreview(pick.url, pick.pageId || null);
              }}
              className="px-2 py-2 rounded border"
              title="Set B (uses top Army if available)"
            >
              Set B
            </button>
            {/* NEW: Auto-stop toggle */}
            <button
              onClick={() => setAbAuto((x) => ({ ...x, enabled: !x.enabled }))}
              className={`px-2 py-1 text-xs rounded border ${
                abAuto.enabled ? "bg-black text-white" : ""
              }`}
              title="Auto-stop when confident (one-sided z-test)"
            >
              AutoStop {abAuto.enabled ? "ON" : "OFF"}
            </button>
            <button
              onClick={() => {
                setAb((a) => {
                  const arm = a.arm === "A" ? "B" : "A";
                  const target = arm === "A" ? a.A : a.B;
                  if (target?.url) setPreview(target.url, target.pageId || null);
                  return { ...a, arm };
                });
              }}
              className="px-2 py-2 rounded border"
              title="Swap view A⇄B"
            >
              View {ab.arm === "A" ? "B" : "A"}
            </button>
          </>
        )}
        <button
          onClick={() => setShowHistory((s) => !s)}
          className="px-3 py-2 rounded border"
          title="Show variant lineage"
        >
          Lineage
        </button>
        <button
          onClick={() => setShowMacros((s) => !s)}
          className={`px-3 py-2 rounded border ${recording ? "border-rose-500" : ""}`}
          title="Record / run macros"
        >
          Macros{recording ? " • REC" : ""}
        </button>
        <button
          onClick={() => setShowNarrative((s) => !s)}
          className="px-3 py-2 rounded border"
          title="Explain what changed"
        >
          Narrative
        </button>
        <button
          onClick={() => setShowComments((s) => !s)}
          className="px-3 py-2 rounded border"
          title="Toggle comments"
        >
          {showComments ? "Comments ON" : "Comments OFF"}
        </button>

        {/* zoom controls */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))))}
            className="px-2 py-2 rounded border"
            title="Zoom out (Ctrl/⌘ + wheel)"
          >
            −
          </button>
          <div className="w-12 text-center">{Math.round(zoom * 100)}%</div>
          <button
            onClick={() => setZoom((z) => Math.min(2, Number((z + 0.1).toFixed(2))))}
            className="px-2 py-2 rounded border"
            title="Zoom in (Ctrl/⌘ + wheel)"
          >
            +
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="px-2 py-2 rounded border"
            title="Reset view"
          >
            Reset
          </button>
          <button
            onClick={() => setShowProof((v) => !v)}
            className="px-3 py-2 rounded border"
            title="Toggle Proof overlay"
          >
            Proof {showProof ? "ON" : "OFF"}
          </button>
          <button
            onClick={() => setShowPerf((v) => !v)}
            className="px-3 py-2 rounded border"
            title="Toggle Perf overlay"
          >
            Perf {showPerf ? "ON" : "OFF"}
          </button>
          <button
            onClick={() => setMeasureOn((v) => !v)}
            className="px-3 py-2 rounded border"
            title="Toggle Measurements overlay"
          >
            Measure {measureOn ? "ON" : "OFF"}
          </button>
          <button
            onClick={() => setFreezeHover((v) => !v)}
            className={`px-3 py-2 rounded border ${freezeHover ? "bg-black text-white" : ""}`}
            title="Freeze / unfreeze hover target"
          >
            Freeze {freezeHover ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* Workspace area */}
      <div
        className="relative overflow-hidden"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        ref={canvasWrapRef}
      >
        {/* Canvas transform wrapper */}
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) translate(-50%, -50%) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {/* Fixed-size preview surface */}
          <div className="relative" style={{ width: 1280, height: 800 }} ref={surfaceRef}>
            {/* Preview iframe */}
            {url ? (
              <iframe
                ref={frameRef}
                src={abs(url)}
                className="absolute inset-0 w-full h-full border rounded-lg shadow-sm bg-white"
                title="Preview"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-gray-500">
                Waiting for a URL…
              </div>
            )}

            {/* Magic cursor highlight */}
            {(() => {
              const layerColor =
                layer === "Perf"
                  ? "rgba(16,185,129,0.85)"
                  : layer === "Proof"
                  ? "rgba(239,68,68,0.85)"
                  : layer === "Brand"
                  ? "rgba(234,179,8,0.85)"
                  : layer === "Variants"
                  ? "rgba(59,130,246,0.85)"
                  : layer === "Copy"
                  ? "rgba(147,51,234,0.85)"
                  : "rgba(99,102,241,0.85)";
              return hoverBox ? (
                <div
                  className="absolute pointer-events-none rounded"
                  style={{
                    left: hoverBox.x,
                    top: hoverBox.y,
                    width: hoverBox.w,
                    height: hoverBox.h,
                    outline: `2px solid ${layerColor}`,
                    boxShadow: `0 0 0 4px ${layerColor.replace("0.85", "0.18")} inset`,
                  }}
                />
              ) : null;
            })()}
            {hoverBox ? (
              <div
                className="absolute pointer-events-none text-[11px] px-1.5 py-0.5 rounded bg-black/80 text-white"
                style={{
                  left: Math.max(0, hoverBox.x),
                  top: Math.max(0, hoverBox.y - 18),
                }}
              >
                {Math.round(hoverBox.w)}×{Math.round(hoverBox.h)} px
              </div>
            ) : null}

            {/* Measurements overlay (to canvas edges) */}
            {(measureOn || modMeasure) && hoverBox
              ? (() => {
                  const x = Math.max(0, hoverBox.x);
                  const y = Math.max(0, hoverBox.y);
                  const w = Math.max(0, hoverBox.w);
                  const h = Math.max(0, hoverBox.h);
                  const cw = 1280,
                    ch = 800;
                  const left = Math.round(x);
                  const right = Math.round(cw - (x + w));
                  const top = Math.round(y);
                  const bottom = Math.round(ch - (y + h));
                  const midY = y + h / 2;
                  const midX = x + w / 2;
                  const line = "absolute bg-emerald-500/70 pointer-events-none";
                  const tag =
                    "absolute text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 pointer-events-none";
                  return (
                    <>
                      {/* horizontal to left */}
                      <div className={`${line}`} style={{ left: 0, top: midY, width: left, height: 1 }} />
                      <div className={`${tag}`} style={{ left: Math.max(2, left / 2 - 12), top: midY - 14 }}>
                        {left}px
                      </div>
                      {/* horizontal to right */}
                      <div className={`${line}`} style={{ left: x + w, top: midY, width: right, height: 1 }} />
                      <div className={`${tag}`} style={{ left: x + w + Math.max(2, right / 2 - 12), top: midY - 14 }}>
                        {right}px
                      </div>
                      {/* vertical to top */}
                      <div className={`${line}`} style={{ left: midX, top: 0, width: 1, height: top }} />
                      <div className={`${tag}`} style={{ left: midX + 4, top: Math.max(2, top / 2 - 8) }}>
                        {top}px
                      </div>
                      {/* vertical to bottom */}
                      <div className={`${line}`} style={{ left: midX, top: y + h, width: 1, height: bottom }} />
                      <div className={`${tag}`} style={{ left: midX + 4, top: y + h + Math.max(2, bottom / 2 - 8) }}>
                        {bottom}px
                      </div>
                      {/* center crosshair */}
                      <div className={`${line}`} style={{ left: 0, top: midY, width: cw, height: 1, opacity: 0.35 }} />
                      <div className={`${line}`} style={{ left: midX, top: 0, width: 1, height: ch, opacity: 0.35 }} />
                    </>
                  );
                })()
              : null}

            {/* Cursor Do-Palette */}
            {cursorPt && (
              <div
                className="absolute z-10 bg-white/96 backdrop-blur border rounded-xl shadow px-2 py-1"
                style={{
                  left: Math.max(8, Math.min(1280 - 220, cursorPt.x + 8)),
                  top: Math.max(8, Math.min(800 - 120, cursorPt.y + 8)),
                }}
              >
                <div className="text-[10px] uppercase tracking-wide opacity-60">
                  {hoverMeta?.tag || "node"}
                  {hoverMeta?.role ? ` • ${hoverMeta.role}` : ""}
                </div>

                {(layer === "Copy" || layer === "Brand") && hoverMeta?.style ? (
                  <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                    <div className="opacity-70">size</div>
                    <div>
                      {hoverMeta.style.width || `${Math.round(hoverBox?.w || 0)}px`} ×{" "}
                      {hoverMeta.style.height || `${Math.round(hoverBox?.h || 0)}px`}
                    </div>
                    <div className="opacity-70">font</div>
                    <div>
                      {hoverMeta.style.fontSize || "—"} / {hoverMeta.style.fontWeight || "—"}
                    </div>
                    <div className="opacity-70">line</div>
                    <div>{hoverMeta.style.lineHeight || "—"}</div>
                    <div className="opacity-70">color</div>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-3 h-3 rounded border"
                        style={{ background: hoverMeta.style.color || "transparent" }}
                      />
                      <span className="truncate">{hoverMeta.style.color || "—"}</span>
                    </div>
                    <div className="opacity-70">bg</div>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-3 h-3 rounded border"
                        style={{ background: hoverMeta.style.backgroundColor || "transparent" }}
                      />
                      <span className="truncate">{hoverMeta.style.backgroundColor || "—"}</span>
                    </div>
                    <div className="opacity-70">margin</div>
                    <div className="truncate">{hoverMeta.style.margin || "—"}</div>
                    <div className="opacity-70">padding</div>
                    <div className="truncate">{hoverMeta.style.padding || "—"}</div>
                    <div className="opacity-70">contrast</div>
                    <div>
                      {contrastInfo ? (
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            contrastInfo.passAA
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                          title="WCAG AA (normal text) threshold 4.5"
                        >
                          {contrastInfo.ratio} {contrastInfo.passAA ? "AA pass" : "AA fail"}
                        </span>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="mt-1 flex flex-wrap gap-1">
                  {cursorPalette.map((b, i) => (
                    <button
                      key={i}
                      onClick={b.act}
                      className="px-2 py-1 text-xs rounded-lg border hover:bg-gray-50"
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Presence cursors */}
            {Object.entries(peers).map(([id, p]) => (
              <div
                key={id}
                className="absolute pointer-events-none"
                style={{
                  left: Math.max(0, Math.min(1280 - 1, p.x)),
                  top: Math.max(0, Math.min(800 - 1, p.y)),
                }}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shadow"
                  style={{ background: colorFor(id), transform: "translate(-50%, -50%)" }}
                />
                <div
                  className="mt-1 px-1.5 py-0.5 text-[10px] rounded border bg-white/90 backdrop-blur"
                  style={{ transform: "translate(-50%, 0%)", borderColor: colorFor(id) }}
                >
                  {p.role} • {p.layer}
                </div>
              </div>
            ))}

            {/* Comment pins (DRAGGABLE + PERMALINK) */}
            {showComments &&
              comments.map((c) => (
                <div
                  key={c.id}
                  className="absolute pointer-events-auto group"
                  style={{
                    left: c.x,
                    top: c.y,
                    opacity: c.resolved ? 0.45 : 1,
                  }}
                  title={c.text}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation(); // prevent space-pan from activating during pin drag
                    const r = surfaceRef.current!.getBoundingClientRect();
                    // convert to surface coords (zoom-aware)
                    const cx = (e.clientX - r.left) / Math.max(zoom, 1e-6);
                    const cy = (e.clientY - r.top) / Math.max(zoom, 1e-6);
                    dragOffRef.current = { dx: cx - c.x, dy: cy - c.y };
                    setDragId(c.id);
                  }}
                  onClick={() => {
                    setShowComments(true);
                    location.hash = `#c-${c.id}`;
                  }}
                >
                  <div className="w-3 h-3 rounded-full border shadow -translate-x-1/2 -translate-y-1/2 bg-amber-400" />
                </div>
              ))}

            {/* Army winners picker */}
            {armyTop?.length ? (
              <div className="absolute right-3 bottom-3 bg-white/95 backdrop-blur rounded-xl shadow p-2 border w-[420px] max-h-[46vh] overflow-auto">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wide opacity-60 px-1">
                    Army: Top • {Math.min(armyTop.length, 20)} plans
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs opacity-70 flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={showUnsafe}
                        onChange={(e) => setShowUnsafe(e.target.checked)}
                      />
                      show all
                    </label>
                    <button
                      className="text-xs opacity-60 hover:opacity-90 px-1"
                      onClick={() => setArmyTop([])}
                    >
                      clear
                    </button>
                  </div>
                </div>

                <div className="mt-2 grid gap-2">
                  {(showUnsafe ? armyTop : armyTop.filter((w: any) => w.proof_ok))
                    .slice(0, 20)
                    .map((w: any, i: number) => (
                      <div
                        key={(w.pageId || w.url || "") + i}
                        className="px-2 py-2 rounded border hover:bg-gray-50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              #{i + 1} • {w.tone || "—"}/{w.scheme || "—"} • {Math.round(w.score)} pts
                            </div>
                            <div className="text-xs opacity-70 truncate">
                              {(w.sections || []).join(" , ")}
                            </div>
                            <div className="mt-1 text-[10px]">
                              <span
                                className={`px-1.5 py-0.5 rounded border ${
                                  w.proof_ok
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                    : "bg-amber-50 border-amber-200 text-amber-700"
                                }`}
                              >
                                {w.proof_ok ? "proof_ok" : "no-proof"}
                              </span>
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            <button
                              onClick={() => openWinner(w)}
                              className="px-2 py-1 text-xs rounded border"
                            >
                              Open
                            </button>
                            <button
                              onClick={() => blendWinner(w)}
                              className="px-2 py-1 text-xs rounded border bg-black text-white"
                            >
                              Blend
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}

            {/* Constraint Ledger */}
            {proof ? (
              <div className="absolute left-3 top-24 bg-white/92 backdrop-blur rounded-xl shadow p-3 border w-[280px]">
                <div className="text-xs font-semibold uppercase tracking-wide opacity-60">
                  Constraint Ledger
                </div>
                <div className="mt-2 text-sm space-y-1">
                  <Row label="Proof OK" val={proof.proof_ok === true} />
                  <Row label="A11y pass" val={proof.a11y === true} />
                  <Row
                    label="CLS ≤ 0.10"
                    val={typeof proof.cls_est === "number" ? proof.cls_est <= 0.1 : null}
                    hint={typeof proof.cls_est === "number" ? proof.cls_est.toFixed(3) : "—"}
                  />
                  <Row
                    label="LCP ≤ 2500 ms"
                    val={typeof proof.lcp_est_ms === "number" ? proof.lcp_est_ms <= 2500 : null}
                    hint={
                      typeof proof.lcp_est_ms === "number" ? `${Math.round(proof.lcp_est_ms)} ms` : "—"
                    }
                  />
                </div>
                <div className="mt-3 border-t pt-2">
                  <div className="text-xs uppercase tracking-wide opacity-60 mb-1">Quick fixes</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={async () => {
                        setForceNoJS(true);
                        if (spec) await recompose(spec);
                      }}
                      className="px-2 py-1 text-xs rounded-lg border hover:bg-gray-50"
                      title="Strip non-essential JS to reduce LCP/CLS risk"
                    >
                      Force Zero-JS
                    </button>
                    <button
                      onClick={() => applyChip("More minimal")}
                      className="px-2 py-1 text-xs rounded-lg border hover:bg-gray-50"
                      title="Tighten layout rhythm; usually improves readability"
                    >
                      Simplify layout
                    </button>
                    <button
                      onClick={() => swapVector()}
                      className="px-2 py-1 text-xs rounded-lg border hover:bg-gray-50"
                      title="Swap heavy/irrelevant visual"
                    >
                      Swap visual
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Lineage panel */}
            {showHistory && (
              <div className="absolute left-3 bottom-24 bg-white/95 backdrop-blur rounded-xl shadow p-3 border w-[340px] max-h-[40vh] overflow-auto">
                <div className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-2">
                  Variant Lineage
                </div>
                <div className="grid gap-2">
                  {history.length === 0 ? (
                    <div className="text-xs opacity-60">No entries yet.</div>
                  ) : (
                    history.map((h, i) => (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-medium truncate">
                            {new Date(h.ts).toLocaleTimeString()}
                          </div>
                          <div className="text-[11px] opacity-60 truncate">{h.url || "—"}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setPreview(h.url, h.pageId)}
                            className="px-2 py-1 text-xs rounded border"
                          >
                            Open
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Time-Travel scrubber */}
            {history.length > 1 && (
              <div className="absolute left-1/2 bottom-16 -translate-x-1/2 bg-white/95 backdrop-blur rounded-xl shadow p-2 border w-[420px]">
                <div className="flex items-center gap-3">
                  <span className="text-xs opacity-70">History</span>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, history.length - 1)}
                    value={Math.min(scrubIdx, Math.max(0, history.length - 1))}
                    onChange={(e) => setScrubIdx(parseInt(e.target.value, 10))}
                    className="flex-1"
                  />
                  <span className="text-xs opacity-70 w-16 text-right">
                    {Math.min(scrubIdx + 1, history.length)} / {history.length}
                  </span>
                </div>
              </div>
            )}

            {/* Narrative Mode panel */}
            {showNarrative && (
              <div className="absolute right-3 bottom-24 bg-white/95 backdrop-blur rounded-xl shadow p-3 border w-[360px] max-h-[40vh] overflow-auto">
                <div className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-2">
                  Narrative
                </div>
                <ul className="text-sm space-y-1">
                  {narrative.length ? (
                    narrative.map((line, i) => <li key={i}>• {line}</li>)
                  ) : (
                    <li className="text-xs opacity-60">No changes detected yet.</li>
                  )}
                </ul>
              </div>
            )}

            {/* Comments panel (THREADS + RESOLVE) */}
            {showComments && comments.length > 0 && (
              <div className="absolute right-3 top-24 bg-white/95 backdrop-blur rounded-xl shadow p-3 border w-[360px] max-h-[44vh] overflow-auto">
                <div className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-2">
                  Comments
                </div>
                <div className="grid gap-2">
                  {comments.map((c) => (
                    <div key={c.id} id={`c-${c.id}`} className="border rounded-lg p-2">
                      <div className="text-[11px] opacity-60 mb-1">
                        {new Date(c.ts).toLocaleTimeString()} • {c.path || "node"}
                        {c.resolved ? " • resolved" : ""}
                      </div>
                      <div className="text-sm whitespace-pre-wrap break-words">{c.text}</div>

                      {c.replies?.length ? (
                        <div className="mt-2 space-y-1 text-[13px]">
                          {c.replies.map((r) => (
                            <div key={r.id} className="px-2 py-1 rounded bg-gray-50">
                              {r.text}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-2 flex gap-2">
                        <input
                          placeholder="Reply…"
                          className="flex-1 px-2 py-1 text-xs rounded border"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const val = (e.target as HTMLInputElement).value;
                              addReply(c.id, val);
                              (e.target as HTMLInputElement).value = "";
                            }
                          }}
                        />
                        <button
                          onClick={() => toggleResolve(c.id)}
                          className="px-2 py-1 text-xs rounded border"
                        >
                          {c.resolved ? "Reopen" : "Resolve"}
                        </button>
                        <button
                          onClick={() => deleteComment(c.id)}
                          className="px-2 py-1 text-xs rounded border"
                          title="Delete"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Macros panel */}
            {showMacros && (
              <div className="absolute right-3 bottom-3 bg-white/95 backdrop-blur rounded-xl shadow p-3 border w-[360px] max-h-[44vh] overflow-auto">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wide opacity-60">
                    Macros
                  </div>
                  <div className="flex items-center gap-2">
                    {recording ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-rose-100 text-rose-700">
                        REC
                      </span>
                    ) : null}
                    <button
                      onClick={() => exportMacros(macros)}
                      className="px-2 py-1 text-[11px] rounded border"
                      title="Export macros to JSON"
                    >
                      Export
                    </button>
                    <label
                      className="px-2 py-1 text-[11px] rounded border cursor-pointer"
                      title="Import macros from JSON"
                    >
                      Import
                      <input
                        type="file"
                        accept="application/json"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) importMacrosFromFile(f, macros, (next) => setMacros(next));
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {!recording ? (
                    <button onClick={startRecording} className="px-2 py-1 text-xs rounded border">
                      Start
                    </button>
                  ) : (
                    <>
                      <input
                        value={macroName}
                        onChange={(e) => setMacroName(e.target.value)}
                        placeholder="Name this macro…"
                        className="flex-1 px-2 py-1 text-xs rounded border"
                      />
                      <button
                        onClick={stopAndSave}
                        className="px-2 py-1 text-xs rounded border bg-black text-white"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setRecording(false)}
                        className="px-2 py-1 text-xs rounded border"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
                <div className="mt-3 border-t pt-2">
                  {macros.length === 0 ? (
                    <div className="text-xs opacity-60">
                      No macros yet. Record chip actions, then save.
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {macros.map((m, i) => (
                        <div key={i} className="border rounded-lg p-2">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium truncate">{m.name}</div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => playMacro(m)}
                                className="px-2 py-1 text-xs rounded border"
                              >
                                Play
                              </button>
                              <button
                                onClick={() => deleteMacro(i)}
                                className="px-2 py-1 text-xs rounded border"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          <div className="mt-1 text-[11px] opacity-70 truncate">
                            {m.steps.join(" , ")}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Proof overlay */}
            {(showProof || modProof) && proof ? (
              <div className="absolute top-3 left-3 bg-white/90 backdrop-blur rounded-xl shadow p-3 border">
                <div className="text-xs font-semibold uppercase tracking-wide opacity-60">
                  Proof
                </div>
                <div className="mt-1 text-sm">
                  <div>
                    Proof OK: <b>{String(!!proof.proof_ok)}</b>
                  </div>
                  <div className="mt-1 flex gap-2">
                    {proofCounts.map(([k, v]) => (
                      <div key={String(k)} className="px-2 py-1 rounded bg-gray-100 text-xs">
                        {k}: {v as number}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Perf overlay */}
            {(showPerf || modPerf) && proof ? (
              <div className="absolute top-3 right-3 bg-white/90 backdrop-blur rounded-xl shadow p-3 border">
                <div className="text-xs font-semibold uppercase tracking-wide opacity-60">
                  Perf (est.)
                </div>
                <div className="mt-1 text-sm">
                  <div>
                    CLS: <b>{proof.cls_est != null ? proof.cls_est.toFixed(3) : "—"}</b>
                  </div>
                  <div>
                    LCP: <b>{proof.lcp_est_ms != null ? `${Math.round(proof.lcp_est_ms)} ms` : "—"}</b>
                  </div>
                  <div>
                    A11y pass: <b>{String(!!proof.a11y)}</b>
                  </div>
                  <div>
                    Visual: <b>{proof.visual ?? "—"}</b>
                  </div>
                </div>
              </div>
            ) : null}

            {/* A/B Mini HUD */}
            {ab.on && ab.exp ? (
              <div className="absolute top-16 right-3 bg-white/90 backdrop-blur rounded-xl shadow p-3 border">
                <div className="text-xs font-semibold uppercase tracking-wide opacity-60">
                  A/B — {ab.exp || "—"}
                </div>
                <div className="mt-1 text-sm space-y-1">
                  {(() => {
                    const A = abKpi?.A || { views: 0, conv: 0 };
                    const B = abKpi?.B || { views: 0, conv: 0 };
                    const ctr = (v: number, c: number) =>
                      v > 0 ? ((100 * c) / v).toFixed(1) + "%" : "—";
                    const ctrA = ctr(A.views, A.conv);
                    const ctrB = ctr(B.views, B.conv);
                    const lift =
                      A.views > 0 && B.views > 0 && A.conv > 0
                        ? (
                            (((B.conv / Math.max(1, B.views)) -
                              (A.conv / Math.max(1, A.views))) /
                              Math.max(1e-6, A.conv / Math.max(1, A.views))) *
                            100
                          ).toFixed(1) + "%"
                        : "—";
                    return (
                      <>
                        <div>
                          Arm A: <b>{A.conv}</b> / {A.views} • CTR <b>{ctrA}</b>
                        </div>
                        <div>
                          Arm B: <b>{B.conv}</b> / {B.views} • CTR <b>{ctrB}</b>
                        </div>
                        <div className="text-xs opacity-70">
                          Lift (B vs A): <b>{lift}</b>
                        </div>
                      </>
                    );
                  })()}
                </div>
                {/* NEW: Auto-stop status */}
                <div className="mt-1 text-[10px] opacity-70">
                  Auto-stop:{" "}
                  {abAuto.enabled
                    ? `${Math.round(abAuto.confidence * 100)}%+, ≥${abAuto.minViews}/arm, ≥${abAuto.minConv} conv`
                    : "OFF"}
                  {abWinner ? ` • Winner: ${abWinner}` : ""}
                </div>
              </div>
            ) : null}

            {/* Sections panel */}
            <div
              className="absolute right-3 top-24 bg-white/92 backdrop-blur rounded-xl shadow p-3 border w-[280px] max-h-[40vh] overflow-auto"
              title="Reorder sections and apply"
            >
              <div className="text-xs font-semibold uppercase tracking-wide opacity-60">Sections</div>
              <div className="mt-2 grid gap-1">
                {sectionOrder.length === 0 ? (
                  <div className="text-xs opacity-60">No sections.</div>
                ) : (
                  sectionOrder.map((s, i) => (
                    <div
                      key={`${s}-${i}`}
                      className="flex items-center justify-between gap-2"
                      draggable
                      onDragStart={() => (dragFromRef.current = i)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        const from = dragFromRef.current;
                        if (from == null || from === i) return;
                        setSectionOrder((prev) => {
                          const next = prev.slice();
                          const [moved] = next.splice(from, 1);
                          next.splice(i, 0, moved);
                          dragFromRef.current = i;
                          setSectionsCrdt(next);
                          return next;
                        });
                      }}
                      onDrop={async (e) => {
                        e.preventDefault();
                        dragFromRef.current = null;
                        await applySectionOrderNow(sectionOrder);
                      }}
                    >
                      <div className="truncate text-xs">{s}</div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveSection(i, -1)}
                          className="px-2 py-0.5 text-xs rounded border"
                          disabled={i === 0}
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveSection(i, +1)}
                          className="px-2 py-0.5 text-xs rounded border"
                          disabled={i === sectionOrder.length - 1}
                          title="Move down"
                        >
                          ↓
                        </button>
                        <select
                          className="ml-1 px-1 py-0.5 text-xs rounded border max-w=[120px] max-w-[120px]"
                          value={s}
                          onChange={(e) =>
                            setSectionOrder((prev) => {
                              const next = prev.slice();
                              next[i] = e.target.value;
                              setSectionsCrdt(next);
                              return next;
                            })
                          }
                          title="Switch section variant"
                        >
                          {variantsFor(s).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-2">
                <button
                  onClick={applySectionOrder}
                  className="w-full px-2 py-1 text-xs rounded border bg-black text-white disabled:opacity-50"
                  disabled={sectionOrder.length === 0}
                >
                  Apply order
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Autopilot HUD */}
        {autopilotOn && (
          <div className="absolute left-3 bottom-20 bg-white/95 backdrop-blur rounded-xl shadow p-3 border w-[360px]">
            <div className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1">
              Autopilot
            </div>
            <div className="text-xs opacity-70 mb-2">
              Say things like: “make a dark waitlist”, “fix contrast”, “enable zero JS”, “run army”,
              “blend winner”, “start A/B”, “undo”.
            </div>
            <div className="grid gap-1 max-h-[22vh] overflow-auto">
              {autoLog.map((l, i) => (
                <div key={i} className="text-sm">
                  <b>{l.role === "you" ? "You" : `Pilot (${persona})`}:</b> {l.text}
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <button onClick={handlePTT} className="px-2 py-1 text-xs rounded border">
                {listening ? "Listening…" : "Push to talk"}
              </button>
              <button onClick={undoLast} className="px-2 py-1 text-xs rounded border">
                Undo
              </button>
            </div>
          </div>
        )}

        {/* workspace hint */}
        <div className="absolute left-3 bottom-3 text-xs text-gray-500 select-none">
          Hold <b>Space</b> and drag to pan • <b>Ctrl/⌘ + wheel</b> to zoom • Press <b>C</b> to
          place a note • Hold <b>Alt</b> to peek Proof • Hold <b>Ctrl/⌘</b> to peek Perf • Hold{" "}
          <b>Shift</b> to peek Measure • Press <b>D</b> to toggle Measure • Press <b>F</b> to freeze
          hover • <b>Data</b> selector = mock states
        </div>

        {/* NEW: tiny HUD for comment mode */}
        {commentMode && (
          <div className="absolute left-3 bottom-10 text-xs px-2 py-1 rounded bg-amber-100 border border-amber-300 text-amber-900">
            Comment mode — click to drop • Esc to cancel
          </div>
        )}

        {/* comment arming banner (legacy noteArm) */}
        {noteArm && (
          <div className="absolute left-1/2 bottom-6 -translate-x-1/2 px-3 py-1.5 text-sm bg-amber-100 text-amber-900 border border-amber-200 rounded-lg shadow">
            Click anywhere on the preview to add a note • Esc to cancel
          </div>
        )}
      </div>
    </div>
  );
}

/* helper for Constraint Ledger */
function Row({ label, val, hint }: { label: string; val: boolean | null; hint?: string }) {
  const badge =
    val === true
      ? "bg-emerald-100 text-emerald-800"
      : val === false
      ? "bg-rose-100 text-rose-800"
      : "bg-gray-100 text-gray-700";
  const text = val === true ? "PASS" : val === false ? "FAIL" : "—";
  return (
    <div className="flex items-center justify-between">
      <div>{label}</div>
      <div className="flex items-center gap-2">
        {hint ? <span className="text-xs opacity-60">{hint}</span> : null}
        <span className={`text-[10px] px-2 py-0.5 rounded ${badge}`}>{text}</span>
      </div>
    </div>
  );
}
