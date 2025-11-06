// client/src/hooks-and-state.ts
import { useEffect, useRef, useState } from "react";
// @ts-ignore
import * as Y from "yjs";
// @ts-ignore
import { WebrtcProvider } from "y-webrtc";
import { Autopilot } from "@/lib/autopilot";
import { securePrompt } from "@/components/SecureDrawer";
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

/** -------------------- Custom Hook for Canvas State Management -------------------- **/
export function useCanvasState() {
  // Session & prompt
  const [sessionId] = useState(() => `cursor_${rid(8)}`);
  const [pagePrompt, setPagePrompt] = useState("dark saas waitlist for founders");

  // Compose state
  const [spec, setSpec] = useState<Spec | null>(null);
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
  const [abKpi, setAbKpi] = useState<null | { A: { views: number; conv: number }; B: { views: number; conv: number } }>(null);
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
  const [history, setHistory] = useState<HistoryEntry[]>([]);
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
  const [peers, setPeers] = useState<Record<string, { x: number; y: number; layer: string; role: Role; ts: number }>>({});
  const [layer, setLayer] = useState<"Layout" | "Copy" | "Brand" | "Proof" | "Perf" | "Variants">("Layout");

  // Autopilot
  const [autopilotOn, setAutopilotOn] = useState(false);
  const [persona, setPersona] = useState<PersonaKey>(() => {
    const v = localStorage.getItem("yb_persona_v1") as PersonaKey | null;
    return v || "builder";
  });
  const [listening, setListening] = useState(false);
  const [autoLog, setAutoLog] = useState<Array<{ role: "you" | "pilot"; text: string }>>([]);

  // Hover & cursor
  const [hoverBox, setHoverBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [hoverMeta, setHoverMeta] = useState<any>(null);
  const [cursorPt, setCursorPt] = useState<{ x: number; y: number } | null>(null);
  const [contrastInfo, setContrastInfo] = useState<{ ratio: number; passAA: boolean } | null>(null);

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
  useEffect(() => {
    if (!ab.on || !ab.exp) {
      setAbKpi(null);
      return;
    }

    let stop = false;

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

        if (!abAuto.enabled || !ab.on) return;

        // gates
        const viewsOK = out.A.views >= abAuto.minViews && out.B.views >= abAuto.minViews;
        const convOK = out.A.conv >= abAuto.minConv || out.B.conv >= abAuto.minConv;
        if (!viewsOK || !convOK) return;

        // Decide via mode
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
            note = `SPRT llr=${llr.toFixed(3)} [${A_th.toFixed(3)}…${B_th.toFixed(3)}], p0~${(
              p0 * 100
            ).toFixed(2)}%, p1~${(p1 * 100).toFixed(2)}%`;
          }
        } else {
          const { conf, pA, pB, lift, winner: w } = zTest(out.A, out.B);
          if (conf >= abAuto.confidence) {
            winner = w;
            note = `z≈ one-sided, conf≈${Math.round(conf * 100)}%, lift ${lift.toFixed(
              1
            )}%, CTR A ${(pA * 100).toFixed(2)}% vs B ${(pB * 100).toFixed(2)}%`;
          }
        }

        if (winner) {
          // stop experiment, promote winner
          setAb((a: ABState) => ({ ...a, on: false, arm: winner }));
          setAbWinner(winner);

          const target = winner === "A" ? ab.A || {} : ab.B || {};
          if (target?.url) setPreview(target.url, target.pageId || null);

          const msg = `A/B auto-stop → ${winner} wins. ${note}`;
          pushAutoLog("pilot", msg);
          try {
            say(msg);
          } catch {}

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
    setAbKpi,
    setAb,
    setAbWinner,
    setPreview,
    pushAutoLog,
    say,
  ]);
}

/** -------------------- Cost Tracking Hook -------------------- **/
export function useCostTracking(sessionId: string, setCostMeta: any, setReceipt: any) {
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
            if (c && typeof c.tokens === "number") {
              setCostMeta(pickCostMeta(c));
            }
            const r = data?.meta?.receipt;
            if (r?.summary) setReceipt({ summary: String(r.summary) });
          }
        } catch {}
      };
    } catch {}
    return () => {
      try {
        es?.close();
      } catch {}
    };
  }, [sessionId, setCostMeta, setReceipt]);
}

/** -------------------- Persona Persistence Hook -------------------- **/
export function usePersonaPersistence(persona: PersonaKey) {
  useEffect(() => {
    try {
      localStorage.setItem("yb_persona_v1", persona);
    } catch {}
  }, [persona]);
}