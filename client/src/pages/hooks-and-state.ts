// client/src/pages/hooks-and-state.ts
import { useEffect, useRef, useState } from "react";
// @ts-ignore
import * as Y from "yjs";
// @ts-ignore
import { WebrtcProvider } from "y-webrtc";
import { Autopilot } from "@/lib/autopilot";
import { securePrompt } from "@/components/SecureDrawer";
import { applyDesignPackToSpec } from "@/lib/design-apply";
import type { UiDesignPack } from "@/lib/design-store";
import {
  Spec,
  CanvasComment,
  ABState,
  ABAutoConfig,
  HistoryEntry,
  CostMeta,
  PersonaKey,
  DataSkin,
  Role,
  Macro,
  json,
  postJson,
  rid,
  pickCostMeta,
  loadComments,
  saveComments,
  loadMacros,
  saveMacros,
  blendSections,
  VARIANT_HINTS,
  GUARD,
  zTest,
  sprt,
  cdfStdNorm,
} from "./types-and-helpers";
import { mcStep } from "./magicInspector";

/** -------------------- Custom Hook for Canvas State Management -------------------- **/
export function useCanvasState() {
  // Session & prompt
  const [sessionId] = useState(() => `cursor_${rid(8)}`);
  const [pagePrompt, setPagePrompt] = useState(
    "dark saas waitlist for founders"
  );

  // Compose state
  const [spec, setSpecRaw] = useState<Spec | null>(null);
  const [chips, setChips] = useState<string[]>([]);
  const [url, setUrl] = useState<string | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);
  const [breadth, setBreadth] = useState<"" | "wide" | "max">("");
  const [forceNoJS, setForceNoJS] = useState(false);

  // Overlays
  const [showProof, setShowProof] = useState(true);
  const [showPerf, setShowPerf] = useState(true);
  const [proof, setProof] = useState<any>(null);

  // Measurement & freeze
  const [measureOn, setMeasureOn] = useState(false);
  const [modMeasure, setModMeasure] = useState(false);
  const [freezeHover, setFreezeHover] = useState(false);

  // Army
  const [armyBusy, setArmyBusy] = useState(false);
  const [armyTop, setArmyTop] = useState<any[]>([]);
  const [showUnsafe, setShowUnsafe] = useState(false);

  // Canvas transforms
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);

  // Data state
  const [dataSkin, setDataSkin] = useState<DataSkin>("normal");

  // A/B Testing
  const [ab, setAb] = useState<ABState>({ on: false, exp: "", arm: "A" });
  const [abKpi, setAbKpi] = useState<null | {
    A: { views: number; conv: number };
    B: { views: number; conv: number };
  }>(null);
  const [abAuto, setAbAuto] = useState<ABAutoConfig>({
    enabled: true,
    confidence: 0.95,
    minViews: 100,
    minConv: 5,
    seq: false,
    power: 0.8,
  });
  const [abWinner, setAbWinner] = useState<"A" | "B" | null>(null);

  // History & lineage
  const [history, setHistoryRaw] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showNarrative, setShowNarrative] = useState(false);
  const [narrative, setNarrative] = useState<string[]>([]);

  // Comments
  const [comments, setComments] = useState<CanvasComment[]>([]);
  const [showComments, setShowComments] = useState(true);
  const [noteArm, setNoteArm] = useState(false);
  const [commentMode, setCommentMode] = useState(false);

  // Sections
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);

  // Cost & receipt
  const [costMeta, setCostMeta] = useState<CostMeta>(null);
  const [receipt, setReceipt] = useState<{ summary: string } | null>(null);

  // Macros
  const [macros, setMacros] = useState<Macro[]>(() => loadMacros());
  const [showMacros, setShowMacros] = useState(false);
  const [recording, setRecording] = useState(false);
  const [macroName, setMacroName] = useState("");

  // Presence & role
  const [role, setRole] = useState<Role>("Edit");
  const [peers, setPeers] = useState<
    Record<string, { x: number; y: number; layer: string; role: Role; ts: number }>
  >({});
  const [layer, setLayer] = useState<
    "Layout" | "Copy" | "Brand" | "Proof" | "Perf" | "Variants"
  >("Layout");

  // Autopilot
  const [autopilotOn, setAutopilotOn] = useState(false);
  const [persona, setPersona] = useState<PersonaKey>(() => {
    try {
      const v = localStorage.getItem("yb_persona_v1") as PersonaKey | null;
      return v || "builder";
    } catch {
      return "builder";
    }
  });
  const [listening, setListening] = useState(false);
  const [autoLog, setAutoLog] = useState<
    Array<{ role: "you" | "pilot"; text: string }>
  >([]);

  // Hover & cursor
  const [hoverBox, setHoverBox] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [hoverMeta, setHoverMeta] = useState<any>(null);
  const [cursorPt, setCursorPt] = useState<{ x: number; y: number } | null>(
    null
  );
  const [contrastInfo, setContrastInfo] = useState<{
    ratio: number;
    passAA: boolean;
  } | null>(null);

  // Ledger
  const [ledger, setLedger] = useState<{
    show: boolean;
    rect: { x: number; y: number; w: number; h: number } | null;
    truths: string[];
  }>({ show: false, rect: null, truths: [] });

  // Drag states
  const [dragId, setDragId] = useState<string | null>(null);

  // Goal simulator
  const [goal, setGoal] = useState(60);

  // Time travel
  const [scrubIdx, setScrubIdx] = useState<number>(0);

  // Keyboard modifiers
  const [modProof, setModProof] = useState(false);
  const [modPerf, setModPerf] = useState(false);

  // --- Instrumented setters for Magic Cursor Inspector ---
  const setSpec: typeof setSpecRaw = (value) => {
    setSpecRaw((prev) => {
      const next = typeof value === "function" ? (value as any)(prev) : value;
      try {
        if (next !== prev) {
          const prevSections = (prev as any)?.sections;
          const nextSections = (next as any)?.sections;
          mcStep("spec_applied", {
            hasPrev: !!prev,
            hasNext: !!next,
            sectionsBefore: Array.isArray(prevSections)
              ? prevSections.length
              : undefined,
            sectionsAfter: Array.isArray(nextSections)
              ? nextSections.length
              : undefined,
          });
        }
      } catch {
        // inspector failures should never break UX
      }
      return next;
    });
  };

  const setHistory: typeof setHistoryRaw = (value) => {
    setHistoryRaw((prev) => {
      const next = typeof value === "function" ? (value as any)(prev) : value;
      try {
        if (next !== prev) {
          const before = Array.isArray(prev) ? prev.length : undefined;
          const after = Array.isArray(next) ? next.length : undefined;
          mcStep("history_pushed", {
            before,
            after,
          });
        }
      } catch {
        // inspector failures should never break UX
      }
      return next;
    });
  };

  // --- Actions bundle (for Workspace / Autopilot consumers) ---
  const actions = {
    applyDesignPackFromStore: (pack: UiDesignPack) => {
      setSpec((prev: any) => applyDesignPackToSpec(prev, pack));
    },
  };

  return {
    // Session & core
    sessionId,
    pagePrompt,
    setPagePrompt,
    spec,
    setSpec,
    chips,
    setChips,
    url,
    setUrl,
    pageId,
    setPageId,
    breadth,
    setBreadth,
    forceNoJS,
    setForceNoJS,

    // Overlays
    showProof,
    setShowProof,
    showPerf,
    setShowPerf,
    proof,
    setProof,

    // Measurement
    measureOn,
    setMeasureOn,
    modMeasure,
    setModMeasure,
    freezeHover,
    setFreezeHover,

    // Army
    armyBusy,
    setArmyBusy,
    armyTop,
    setArmyTop,
    showUnsafe,
    setShowUnsafe,

    // Canvas
    zoom,
    setZoom,
    pan,
    setPan,
    panning,
    setPanning,
    spaceDown,
    setSpaceDown,

    // Data
    dataSkin,
    setDataSkin,

    // A/B
    ab,
    setAb,
    abKpi,
    setAbKpi,
    abAuto,
    setAbAuto,
    abWinner,
    setAbWinner,

    // History
    history,
    setHistory,
    showHistory,
    setShowHistory,
    showNarrative,
    setShowNarrative,
    narrative,
    setNarrative,

    // Comments
    comments,
    setComments,
    showComments,
    setShowComments,
    noteArm,
    setNoteArm,
    commentMode,
    setCommentMode,

    // Sections
    sectionOrder,
    setSectionOrder,

    // Cost
    costMeta,
    setCostMeta,
    receipt,
    setReceipt,

    // Macros
    macros,
    setMacros,
    showMacros,
    setShowMacros,
    recording,
    setRecording,
    macroName,
    setMacroName,

    // Presence
    role,
    setRole,
    peers,
    setPeers,
    layer,
    setLayer,

    // Autopilot
    autopilotOn,
    setAutopilotOn,
    persona,
    setPersona,
    listening,
    setListening,
    autoLog,
    setAutoLog,

    // Hover
    hoverBox,
    setHoverBox,
    hoverMeta,
    setHoverMeta,
    cursorPt,
    setCursorPt,
    contrastInfo,
    setContrastInfo,

    // Ledger
    ledger,
    setLedger,

    // Drag
    dragId,
    setDragId,

    // Goal
    goal,
    setGoal,

    // Time travel
    scrubIdx,
    setScrubIdx,

    // Modifiers
    modProof,
    setModProof,
    modPerf,
    setModPerf,

    // Actions
    actions,
  };
}

/** -------------------- Custom Refs Hook -------------------- **/
export function useCanvasRefs() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const panStart = useRef<{ x: number; y: number } | null>(null);
  const dragOffRef = useRef<{ dx: number; dy: number } | null>(null);
  const dragFromRef = useRef<number | null>(null);
  const goalRef = useRef<HTMLInputElement>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const yDocRef = useRef<Y.Doc | null>(null);
  const yProvRef = useRef<any>(null);
  const ySectionsRef = useRef<Y.Array<string> | null>(null);
  const yMuteRef = useRef(false);
  const recordingRef = useRef<string[]>([]);
  const autopilotRef = useRef<Autopilot | null>(null);
  const specRef = useRef<Spec | null>(null);
  const armyTopRef = useRef<any[]>([]);
  const historyRef = useRef<HistoryEntry[]>([]);
  const proofRef = useRef<any>(null);
  const commentsRef = useRef<CanvasComment[]>([]);
  const personaRef = useRef<PersonaKey>("builder");
  const prevProofRef = useRef<any>(null);
  // Ephemeral secrets for this canvas session (e.g. email API keys). Must never be logged or persisted.
  const secretsRef = useRef<{ emailApiKey?: string }>({});

  return {
    frameRef,
    surfaceRef,
    canvasWrapRef,
    panStart,
    dragOffRef,
    dragFromRef,
    goalRef,
    bcRef,
    yDocRef,
    yProvRef,
    ySectionsRef,
    yMuteRef,
    recordingRef,
    autopilotRef,
    specRef,
    armyTopRef,
    historyRef,
    proofRef,
    commentsRef,
    personaRef,
    prevProofRef,
    secretsRef,
  };
}

/** -------------------- A/B Testing Hook -------------------- **/
export function useABTesting(
  ab: ABState,
  abAuto: ABAutoConfig,
  setAbKpi: any,
  setAb: any,
  setAbWinner: any,
  setPreview: any,
  pushAutoLog: any,
  say: any
) {
  // Autopilot-driven auto-stop config (HUD-only; thresholds still live in abAuto)
  const [autoConfig, setAutoConfig] = useState({
    enabled: false,
    confidence: 0.95, // 95%
    minViews: 150,
    minConversions: 10,
  });
  const [autoWinner, setAutoWinner] = useState<"A" | "B" | null>(null);
  const [autoStopped, setAutoStopped] = useState(false);

  function setABAuto(cfg: {
    confidence?: number;
    minViews?: number;
    minConversions?: number;
    enabled?: boolean;
    on?: boolean;
  }) {
    setAutoConfig((prev) => ({
      ...prev,
      ...(cfg.confidence != null ? { confidence: cfg.confidence } : {}),
      ...(cfg.minViews != null ? { minViews: cfg.minViews } : {}),
      ...(cfg.minConversions != null
        ? { minConversions: cfg.minConversions }
        : {}),
      ...(cfg.enabled != null ? { enabled: !!cfg.enabled } : {}),
      ...(cfg.on != null ? { enabled: !!cfg.on } : {}),
    }));
  }

  // Simple helpers consumed by CursorCanvas
  function startAB() {
    setAb((a: ABState) =>
      a.on
        ? a
        : {
            ...a,
            on: true,
            exp: a.exp || `exp_${rid(6)}`,
            arm: "A",
          }
    );
  }

  function toggleAB(on?: boolean) {
    setAb((a: ABState) =>
      typeof on === "boolean" ? { ...a, on } : { ...a, on: !a.on }
    );
  }

  function viewArm(arm: "A" | "B") {
    setAb((a: ABState) => {
      const target = arm === "A" ? (a as any).A : (a as any).B;
      if (target?.url) setPreview(target.url, target.pageId || null);
      return { ...a, arm };
    });
  }

  // reset auto-stop state whenever experiment changes / restarts
  useEffect(() => {
    if (!ab.exp) {
      setAutoWinner(null);
      setAutoStopped(false);
      return;
    }
    if (ab.on) {
      setAutoWinner(null);
      setAutoStopped(false);
    }
  }, [ab.exp, ab.on]);

  useEffect(() => {
    if (!ab.on || !ab.exp) {
      setAbKpi(null);
      return;
    }

    let stop = false;

    async function tick() {
      try {
        const r = await fetch(
          `/api/metrics?experiment=${encodeURIComponent(ab.exp)}`
        );
        const j = (await r.json().catch(() => ({} as any))) as any;

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

        // Effective auto config = existing abAuto thresholds overridden by HUD config
        const enabled =
          (typeof autoConfig.enabled === "boolean"
            ? autoConfig.enabled
            : abAuto.enabled) ?? false;

        if (!enabled || !ab.on) return;

        const minViews =
          (typeof autoConfig.minViews === "number"
            ? autoConfig.minViews
            : abAuto.minViews) ?? 0;

        const minConv =
          (typeof autoConfig.minConversions === "number"
            ? autoConfig.minConversions
            : abAuto.minConv) ?? 0;

        const confidenceThresh =
          (typeof autoConfig.confidence === "number"
            ? autoConfig.confidence
            : abAuto.confidence) ?? 0.95;

        const viewsOK = out.A.views >= minViews && out.B.views >= minViews;
        const convOK = out.A.conv >= minConv || out.B.conv >= minConv;
        if (!viewsOK || !convOK) return;

        let winner: "A" | "B" | null = null;
        let note = "";

        if (abAuto.seq) {
          const alpha = 0.05;
          const { decided, winner: w, llr, A_th, B_th, p0, p1 } = sprt(
            out.A,
            out.B,
            alpha,
            abAuto.power,
            0.05
          );
          if (decided) {
            winner = w;
            note = `SPRT llr=${llr.toFixed(
              3
            )} [${A_th.toFixed(3)}…${B_th.toFixed(
              3
            )}], p0~${(p0 * 100).toFixed(2)}%, p1~${(p1 * 100).toFixed(
              2
            )}%`;
          }
        } else {
          const { conf, pA, pB, lift, winner: w } = zTest(out.A, out.B);
          if (conf >= confidenceThresh) {
            winner = w;
            note = `z≈ one-sided, conf≈${Math.round(
              conf * 100
            )}%, lift ${lift.toFixed(1)}%, CTR A ${(pA * 100).toFixed(
              2
            )}% vs B ${(pB * 100).toFixed(2)}%`;
          }
        }

        if (winner) {
          setAb((a: ABState) => ({ ...a, on: false, arm: winner! }));
          setAbWinner(winner);
          setAutoWinner(winner);
          setAutoStopped(true);

          const target =
            winner === "A" ? (ab as any).A || {} : (ab as any).B || {};
          if (target?.url) setPreview(target.url, target.pageId || null);

          const msg = `A/B auto-stop → ${winner} wins. ${note}`;
          pushAutoLog("pilot", msg);
          try {
            say(msg);
          } catch {
            // ignore TTS failure
          }

          stop = true;
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
  }, [
    ab.on,
    ab.exp,
    ab.A,
    ab.B,
    abAuto.enabled,
    abAuto.confidence,
    abAuto.minViews,
    abAuto.minConv,
    abAuto.seq,
    abAuto.power,
    autoConfig.enabled,
    autoConfig.confidence,
    autoConfig.minViews,
    autoConfig.minConversions,
    setAbKpi,
    setAb,
    setAbWinner,
    setPreview,
    pushAutoLog,
    say,
  ]);

  return {
    startAB,
    toggleAB,
    viewArm,
    setABAuto,
    autoConfig,
    autoWinner,
    autoStopped,
  };
}

/** -------------------- Cost Tracking Hook -------------------- **/
export function useCostTracking(
  sessionId: string,
  setCostMeta: any,
  setReceipt: any
) {
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      const url = `/api/ai/signals?sessionId=${encodeURIComponent(sessionId)}`;
      es = new EventSource(url);
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data || "{}");
          const type = data?.type || data?.kind;
          if (type === "compose_success") {
            const c = data?.meta?.cost;
            let hudCostMeta: any = null;
            if (c && typeof c.tokens === "number") {
              hudCostMeta = pickCostMeta(c);
              setCostMeta(hudCostMeta);
            }
            const r = data?.meta?.receipt;
            let receiptSummary: string | null = null;
            if (r?.summary) {
              receiptSummary = String(r.summary);
              setReceipt({ summary: receiptSummary });
            }

            // Trace HUD updates for Magic Cursor Inspector
            try {
              mcStep("hud_updated", {
                sessionId,
                type,
                rawCost: c ?? null,
                costMeta: hudCostMeta,
                receiptSummary,
              });
            } catch {
              // inspector should never break SSE handling
            }
          }
        } catch {
          // ignore parse issues
        }
      };
    } catch {
      // ignore SSE failures
    }
    return () => {
      try {
        es?.close();
      } catch {
        // ignore
      }
    };
  }, [sessionId, setCostMeta, setReceipt]);
}

/** -------------------- Persona Persistence Hook -------------------- **/
export function usePersonaPersistence(persona: PersonaKey) {
  useEffect(() => {
    try {
      localStorage.setItem("yb_persona_v1", persona);
    } catch {
      // ignore
    }
  }, [persona]);
}
