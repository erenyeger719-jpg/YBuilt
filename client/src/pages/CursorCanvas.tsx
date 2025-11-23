// client/src/pages/CursorCanvas.tsx
import React, { useEffect, useMemo, useState, useRef } from "react";
// @ts-ignore
import * as Y from "yjs";
// @ts-ignore
import { WebrtcProvider } from "y-webrtc";
import { Autopilot } from "@/lib/autopilot";
import { supPost, type SupResponse } from "@/lib/supClient";
import { securePrompt } from "@/components/SecureDrawer";
import { HoverHighlight, Measurements, Row } from "./components";
import {
  useCanvasState,
  useCanvasRefs,
  useABTesting,
  useCostTracking,
  usePersonaPersistence,
} from "./hooks-and-state";
import {
  Spec,
  CanvasComment,
  HoverMsg,
  Macro,
  DataSkin,
  Role,
  json,
  postJson,
  rid,
  pickCostMeta,
  loadComments,
  saveComments,
  loadMacros,
  saveMacros,
  exportMacros,
  importMacrosFromFile,
  VARIANT_HINTS,
  GUARD,
  baseOf,
  variantsFor,
  parseCssColor,
  flattenOnWhite,
  contrastRatio,
  relLum,
  colorFor,
  blendSections,
} from "./types-and-helpers";
import { chipsForGoal } from "./magicCursorLogic";
import { CursorCanvasDesignStore } from "./CursorCanvasDesignStore";
import {
  applyDesignPackByIdExternal,
  getDesignPackEditorFields,
  applyDesignPackFieldUpdate,
  applyDesignPackFromAutopilot,
  type DesignPackEditorField,
} from "./design-store-logic";
import {
  setSectionsCrdt,
  moveSection,
  applySectionOrder,
  applySectionOrderNow,
  composeInstant,
  recompose,
  composeGuarded,
  recomposeGuarded,
  applyChip,
  applyChipGuarded,
  applyChipBatch,
  applyChipBatchGuarded,
  swapVector,
  runArmyTop,
  saveDesignAdjust,
  addComment,
  updateComment,
  deleteComment,
  addMacro,
  updateMacro,
  deleteMacro,
  runMacro,
  handleAutopilotAction,
  handleCompareAction,
  checkBudgets,
  undoLastAction,
  processVoiceCommand,
  handleVoiceCommand,
  type CanvasLogicProps,
} from "./CursorCanvasLogic";

type UIMacro = Macro & {
  id: string;
  actions?: string[];
  created?: number;
};

export default function CursorCanvas() {
  // Use custom hooks for state management
  const state = useCanvasState();
  const refs = useCanvasRefs();

  const {
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
    showProof,
    setShowProof,
    showPerf,
    setShowPerf,
    proof,
    setProof,
    measureOn,
    setMeasureOn,
    modMeasure,
    setModMeasure,
    freezeHover,
    setFreezeHover,
    armyBusy,
    setArmyBusy,
    armyTop,
    setArmyTop,
    showUnsafe,
    setShowUnsafe,
    zoom,
    setZoom,
    pan,
    setPan,
    panning,
    setPanning,
    spaceDown,
    setSpaceDown,
    modProof,
    setModProof,
    modPerf,
    setModPerf,
    showNarrative,
    setShowNarrative,
    narrative,
    setNarrative,
    siteUrl,
    setSiteUrl,
    genCount,
    setGenCount,
  } = state;

  const {
    canvasRef,
    iframeRef,
    overlayRef,
    canvasWrapRef,
    noteRef,
    boxRef,
    yDocRef,
    yNarrRef,
    yActorsRef,
    ySectionsRef,
    yFlagsRef,
    goalRef,
    recordingRef,
    specRef,
    yMuteRef,
    rtcRef,
  } = refs;

  // Local state
  const [hoverMeta, setHoverMeta] = useState<HoverMsg | null>(null);
  const [history, setHistory] = useState<
    {
      url: string | null;
      pageId: string | null;
      spec: Spec | null;
      ts?: string;
    }[]
  >([]);
  const [scrubIdx, setScrubIdx] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [showDesign, setShowDesign] = useState(false);
  const [designAdjust, setDesignAdjust] = useState<{ palette: string[] }>({
    palette: [],
  });
  const [comments, setComments] = useState<CanvasComment[]>([]);
  const [commentMode, setCommentMode] = useState(false);
  const [noteArm, setNoteArm] = useState(false);
  const [macros, setMacros] = useState<UIMacro[]>([]);
  const [showMacros, setShowMacros] = useState(false);
  const [recording, setRecording] = useState(false);
  const [pendingMacroActions, setPendingMacroActions] = useState<any[] | null>(
    null,
  );
  const [pendingMacroName, setPendingMacroName] = useState("");
  const [skinData, setSkinData] = useState<DataSkin | null>(null);
  const [autopilotOn, setAutopilotOn] = useState(false);
  const [listening, setListening] = useState(false);
  const [autoLog, setAutoLog] = useState<{ role: Role; text: string }[]>([]);
  const [receipt, setReceipt] = useState<{ summary: string } | null>(null);

  // A/B testing state
  const { ab, setAb } = useABTesting();
  const [compareSpec, setCompareSpec] = useState<Spec | null>(null);
  const [compareUrl, setCompareUrl] = useState<string | null>(null);
  const [comparePageId, setComparePageId] = useState<string | null>(null);
  const [compareScrubIdx, setCompareScrubIdx] = useState(0);
  const [autoConfig, setAutoConfig] = useState<any>(null);
  const [autoStopped, setAutoStopped] = useState(false);
  const [autoWinner, setAutoWinner] = useState<"A" | "B" | null>(null);

  const [goalValue, setGoalValue] = useState<number | null>(null);
  const secretsRef = useRef<any>({});
  const proofRef = useRef<any>(null);

  // Cost tracking
  const { costMeta, setCostMeta, trySetCostMeta } = useCostTracking();

  // Persona persistence
  const { loadPersona, savePersona } = usePersonaPersistence();

  // Autopilot instance
  const [autopilot, setAutopilot] = useState<Autopilot | null>(null);

  // Helper functions
  function setPreview(u: string | null, pid: string | null) {
    setUrl(u);
    setPageId(pid);
  }

  function pushHistory(entry: {
    url: string | null;
    pageId: string | null;
    spec: Spec | null;
  }) {
    const ts = new Date().toISOString();
    setHistory((h) => [
      ...h,
      { url: entry.url, pageId: entry.pageId, spec: entry.spec, ts },
    ]);
    setScrubIdx((h) => h + 1);
  }

  function pushAutoLog(role: Role, text: string) {
    setAutoLog((prev) => [...prev, { role, text }]);
  }

  function say(text: string) {
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    synth.speak(utterance);
  }

  function handleSupError(context: string, res: SupResponse) {
    const msg = res.message || "Unknown error";
    console.error(`[${context}] SUP error:`, msg);
    pushAutoLog("pilot", `Error: ${msg}`);
    try {
      say(`Error. ${msg}`);
    } catch {}
  }

  async function passesBudgets(pageId: string | null): Promise<boolean> {
    return checkBudgets(pageId, {
      ...logicProps,
      proof,
      showUnsafe,
    });
  }

  function activateCompare() {
    if (ab.on && spec) {
      setCompareSpec(spec);
      setCompareUrl(url);
      setComparePageId(pageId);
      setCompareScrubIdx(scrubIdx);
    }
  }

  function undoLast() {
    undoLastAction(history, scrubIdx, setScrubIdx, logicProps);
  }

  // Create logic props object
  const logicProps: CanvasLogicProps = {
    sessionId,
    pagePrompt,
    spec,
    setSpec,
    setChips,
    breadth,
    forceNoJS,
    recording,
    recordingRef,
    trySetCostMeta,
    setPreview,
    pushHistory,
    pushAutoLog,
    say,
    handleSupError,
    passesBudgets,
    hoverMeta,
    ySectionsRef,
    yMuteRef,
    sectionOrder,
    setSectionOrder,
    comments,
    setComments,
    macros,
    setMacros,
    activateCompare,
    compareScrubIdx,
    proof,
    showUnsafe,
    setArmyBusy,
    setArmyTop,
    armyTop,
    designAdjust,
    setDesignAdjust,
    specRef,
    autopilot,
  };

  // Initialize Autopilot
  useEffect(() => {
    if (autopilotOn && !autopilot) {
      const ap = new Autopilot({
        onAction: async (action: any) => {
          await handleAutopilotAction(action, logicProps);
        },
        onSay: (text: string) => {
          pushAutoLog("pilot", text);
          say(text);
        },
      });
      setAutopilot(ap);
    } else if (!autopilotOn && autopilot) {
      autopilot.destroy();
      setAutopilot(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autopilotOn]);

  // Initialize CRDT
  useEffect(() => {
    const ydoc = new Y.Doc();
    yDocRef.current = ydoc;

    // Initialize arrays
    yNarrRef.current = ydoc.getArray("narrative");
    yActorsRef.current = ydoc.getArray("actors");
    ySectionsRef.current = ydoc.getArray("sections");
    yFlagsRef.current = ydoc.getMap("flags");

    // Set up WebRTC provider
    const roomName = `cursor-canvas-${sessionId}`;
    const provider = new WebrtcProvider(roomName, ydoc, {
      signaling: ["wss://signaling.yjs.dev"],
    });
    rtcRef.current = provider;

    // Observe changes
    const onSectionsChange = () => {
      if (yMuteRef.current) return;
      const arr = ySectionsRef.current?.toArray() || [];
      setSectionOrder(arr as string[]);
    };

    ySectionsRef.current?.observe(onSectionsChange);

    return () => {
      ySectionsRef.current?.unobserve(onSectionsChange);
      provider.destroy();
      ydoc.destroy();
    };
  }, [sessionId]);

  // Load saved data
  useEffect(() => {
    const savedComments = loadComments();
    setComments(savedComments);

    const rawMacros = loadMacros() as any[];
    const normalized: UIMacro[] = (rawMacros || []).map((m: any, idx: number) => ({
      id: m.id || rid(8),
      name: m.name || `Macro ${idx + 1}`,
      actions: m.actions || m.steps || [],
      created: m.created || Date.now(),
    }));
    setMacros(normalized);
  }, []);

  // Track spec changes
  useEffect(() => {
    specRef.current = spec;
  }, [spec]);

  // Apply design pack from store (via design-store-logic)
  async function onApplyPackByIdFromStore(packId: string): Promise<boolean> {
    return applyDesignPackByIdExternal(packId, logicProps);
  }

  // Track metrics
  useEffect(() => {
    if (!url || !spec) return;
    const controller = new AbortController();

    // Post metrics
    const body = {
      sessionId,
      url,
      pageId,
      spec,
      breadth,
      ab: ab.on ? ab : null,
    };

    fetch("/api/metrics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
      signal: controller.signal,
    }).catch(() => {
      // never block UI on metrics failures
    });

    return () => controller.abort();
  }, [url, spec]);

  // Keep local copy of section order
  useEffect(() => {
    const arr = (spec?.layout?.sections || []) as string[];
    setSectionOrder(Array.isArray(arr) ? [...arr] : []);
  }, [spec?.layout?.sections]);

  // Load persona on mount
  useEffect(() => {
    const persona = loadPersona();
    if (persona?.prompt) {
      setPagePrompt(persona.prompt);
    }
  }, []);

  // Save persona on prompt change
  useEffect(() => {
    if (pagePrompt) {
      savePersona({ prompt: pagePrompt });
    }
  }, [pagePrompt]);

  // Canvas interactions
  function onWheel(e: React.WheelEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => Math.max(0.5, Math.min(2, z + delta)));
    }
  }

  function onMouseDown(e: React.MouseEvent) {
    if (spaceDown || e.button === 1) {
      setPanning(true);
    }
  }

  function onMouseMove(e: React.MouseEvent) {
    if (panning) {
      setPan((p) => ({
        x: p.x + e.movementX,
        y: p.y + e.movementY,
      }));
    }
  }

  function onMouseUp() {
    setPanning(false);
  }

  // Hover message handling
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "hover" || e.data?.type === "yb_hover") {
        setHoverMeta(e.data as HoverMsg);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Handle iframe click events → add comments
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "click" && commentMode) {
        const { x, y, text, tag, aria, path, sel, selector } = e.data as any;
        const comment: CanvasComment = {
          id: rid(8),
          path: path || sel || selector || "",
          x,
          y,
          text: `${tag}: ${text || aria || ""}`,
          ts: Date.now(),
        };
        addComment(comment, comments, setComments);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [commentMode, comments]);

  // Comment re-anchoring from iframe (observer-based updates from preview)
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (!e.data) return;
      if (
        e.data.type === "comment_target_move" ||
        e.data.type === "yb_comment_target_move"
      ) {
        const { path, rect } = e.data as any;
        if (!path || !rect) return;
        setComments((prev) =>
          prev.map((c) =>
            c.path === path
              ? {
                  ...c,
                  x: rect.x,
                  y: rect.y,
                }
              : c,
          ),
        );
      }
    };

    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Keyboard modifiers
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key === " " || e.code === "Space" || e.key === "Spacebar")
        setSpaceDown(true);
      if (e.altKey) setModProof(true);
      if (e.ctrlKey || e.metaKey) setModPerf(true);
      if (e.shiftKey) setModMeasure(true);
      if (e.key === "Escape") setNoteArm(false);
    };
    const ku = (e: KeyboardEvent) => {
      if (e.key === " " || e.code === "Space" || e.key === "Spacebar") {
        setSpaceDown(false);
      }
      if (!e.altKey) setModProof(false);
      if (!(e.ctrlKey || e.metaKey)) setModPerf(false);
      if (!e.shiftKey) setModMeasure(false);
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, []);

  // Global hotkeys
  useEffect(() => {
    const isTyping = (el: Element | null) => {
      if (!el) return false;
      const t = (el as HTMLElement).tagName;
      return (
        t === "INPUT" ||
        t === "TEXTAREA" ||
        (el as HTMLElement).isContentEditable
      );
    };
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(document.activeElement)) return;
      const k = e.key;
      if (k === "r" || k === "R") {
        e.preventDefault();
        spec && recompose(logicProps, spec);
      } else if (k === "[") {
        setZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))));
      } else if (k === "]") {
        setZoom((z) => Math.min(2, Number((z + 0.1).toFixed(2))));
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
          a.on
            ? { ...a, on: false }
            : {
                ...a,
                on: true,
                exp: a.exp || `exp_${rid(6)}`,
                arm: "A",
              },
        );
      } else if (k === "c" || k === "C") {
        e.preventDefault();
        setCommentMode((v) => !v);
      } else if (k === "Escape") {
        setCommentMode(false);
      } else if (k === "u" || k === "U") {
        undoLast();
      } else if (k === "d" || k === "D") {
        setMeasureOn((v) => !v);
      } else if (k === "f" || k === "F") {
        setFreezeHover((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [spec, history]);

  // Time-Travel scrubber
  useEffect(() => {
    if (!history.length) return;
    const node = history[scrubIdx];
    if (node) setPreview(node.url, node.pageId);
  }, [scrubIdx, history]);

  // Push-to-talk
  async function promptOnce(): Promise<string | null> {
    const SR: any =
      (window as any).webkitSpeechRecognition ||
      (window as any).SpeechRecognition;
    if (!SR) {
      console.warn("SpeechRecognition not available");
      return null;
    }
    const recog = new SR();
    recog.lang = "en-US";
    recog.continuous = false;
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    return new Promise((resolve) => {
      recog.onresult = (e: any) => {
        const t = e.results[0][0].transcript;
        resolve(t);
      };
      recog.onerror = () => resolve(null);
      recog.onend = () => resolve(null);
      recog.start();
    });
  }

  // Proof & Performance data fetching
  useEffect(() => {
    if (!pageId || (!showProof && !modProof && !showPerf && !modPerf)) return;

    const controller = new AbortController();

    Promise.all([
      fetch(`/api/proof/${pageId}`, { signal: controller.signal })
        .then((r) => r.json())
        .catch(() => null),
      fetch(`/api/perf/${pageId}`, { signal: controller.signal })
        .then((r) => r.json())
        .catch(() => null),
    ]).then(([proofData, perfData]) => {
      if (proofData || perfData) {
        setProof({ ...proofData, perf: perfData });
      }
    });

    return () => controller.abort();
  }, [pageId, showProof, modProof, showPerf, modPerf]);

  useEffect(() => {
    proofRef.current = proof;
  }, [proof]);

  // Handle macros file import
  function handleMacrosImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    importMacrosFromFile(file, macros, (next) => {
      setMacros(next as UIMacro[]);
      saveMacros(next);
    });

    e.target.value = "";
  }

  // Handle macros export
  function handleMacrosExport() {
    exportMacros(macros);
  }

  // Data skin application
  useEffect(() => {
    if (!skinData || !spec) return;
    const next = {
      ...spec,
      data: skinData,
    };
    setSpec(next);
    recompose(logicProps, next);
  }, [skinData]);

  // A/B Testing handlers
  useEffect(() => {
    if (!ab.on || !spec) return;

    // Track A/B test events
    const body = {
      exp: ab.exp,
      arm: ab.arm,
      event: "view",
      sessionId,
      pageId,
    };

    fetch("/api/ab/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }, [ab, pageId]);

  // Compare mode sync
  useEffect(() => {
    if (!compareSpec || ab.arm !== "B") return;
    recompose(logicProps, compareSpec);
  }, [compareSpec, ab.arm]);

  // Auto-stop monitoring
  useEffect(() => {
    if (!autoConfig?.enabled || !ab.on) return;

    const checkWinner = async () => {
      const res = await fetch(`/api/ab/check-winner/${ab.exp}`);
      const data = await res.json();
      if (data.winner) {
        setAutoStopped(true);
        setAutoWinner(data.winner);
        setAb({ ...ab, arm: data.winner });
      }
    };

    const interval = setInterval(checkWinner, 30000);
    return () => clearInterval(interval);
  }, [autoConfig, ab]);

  // Handle secure prompts
  async function handleSecurePrompt() {
    const secured = await securePrompt(pagePrompt);
    if (secured !== pagePrompt) {
      setPagePrompt(secured);
      pushAutoLog("pilot", "Prompt secured against risky claims");
    }
  }

  // Apply chips from goal (0–100 scale)
  async function applyGoal(raw: string) {
    const digits = raw.match(/\d+/g);
    if (!digits) return;
    const n = Number.parseInt(digits.join(""), 10);
    if (Number.isNaN(n)) return;
    const goal = Math.max(0, Math.min(100, n));
    const chips = chipsForGoal(goal);
    if (chips.length > 0) {
      await applyChipBatchGuarded(chips, logicProps);
    }
  }

  // Apply chips from a numeric goal (0–100), for Autopilot voice commands
  async function applyNumericGoal(goal: number) {
    const clamped = Math.max(0, Math.min(100, goal));
    const chips = chipsForGoal(clamped);
    if (chips.length > 0) {
      await applyChipBatchGuarded(chips, logicProps);
    }
  }

  // Narrative sync
  useEffect(() => {
    if (!yNarrRef.current || !narrative) return;
    yMuteRef.current = true;
    try {
      yNarrRef.current.delete(0, yNarrRef.current.length);
      yNarrRef.current.insert(0, narrative.split("\n"));
    } finally {
      yMuteRef.current = false;
    }
  }, [narrative]);

  // Initial compose
  useEffect(() => {
    composeInstant(logicProps).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePTT() {
    if (listening) return;
    setListening(true);
    const t = await promptOnce();
    setListening(false);
    const txt = (t && t.trim()) || null;
    if (!txt) return;

    pushAutoLog("you", txt);

    // 1) Let the richer voice/Autopilot command handler try first
    const handled = await handleVoiceCommand(txt, {
      ...logicProps,
      setAb,
      ab,
      setAbAuto: setAutoConfig,
      setGoal: (n: number) => setGoalValue(n),
      applyGoal: applyNumericGoal,
      setForceNoJS,
      setDataSkin: setSkinData,
      secretsRef,
      setCommentMode,
      proofRef,
      setAutopilotOn,
      autopilotOn,
      setPreview,
      pageId,
      securePrompt,
    });

    if (handled) return;

    // 2) Fallback: simple chip extraction, then Autopilot or Compose
    const chips = processVoiceCommand(txt, logicProps);

    if (chips.length > 0) {
      await applyChipBatchGuarded(chips, logicProps);
    } else if (autopilot) {
      // Let Autopilot decide
      autopilot.processVoice(txt);
    } else {
      // Last resort: treat it as a fresh compose prompt
      await composeGuarded({ ...logicProps, pagePrompt: txt });
    }
  }

  // JSX RENDERING STARTS HERE
  return (
    <div className="w-full h-screen grid grid-rows-[auto,1fr] bg-gray-50">
      {/* Cost chip (global HUD) */}
      {costMeta && (
        <div className="fixed top-3 right-3 z-50 rounded-xl px-3 py-1.5 shadow-sm bg-black/70 text-white text-xs backdrop-blur">
          <span title="Estimated latency">
            {Math.round(costMeta.latencyMs)}ms
          </span>
          <span className="mx-1.5">•</span>
          <span title="Estimated tokens">{costMeta.tokens} tok</span>
          <span className="mx-1.5">•</span>
          <span title="Estimated cost">
            ₹
            {(
              (costMeta.cents / 100) *
              (Number((import.meta as any)?.env?.VITE_FX_USD_INR) || 85)
            ).toFixed(2)}
          </span>
        </div>
      )}

      {/* Receipt chip */}
      {receipt && (
        <div className="fixed top-12 right-3 z-50 rounded-xl px-3 py-1.5 shadow-sm bg-black/60 text-white text-xs backdrop-blur">
          {receipt.summary}
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center gap-2 p-3 border-b bg-white">
        <input
          value={pagePrompt}
          onChange={(e) => setPagePrompt(e.target.value)}
          className="flex-1 px-3 py-2 rounded border outline-none"
          placeholder="Describe the page… e.g., dark saas waitlist for founders"
        />
        <button
          onClick={() => composeGuarded(logicProps)}
          className="px-3 py-2 rounded bg-black text-white"
        >
          Compose
        </button>

        {/* Autopilot toggle */}
        <button
          onClick={() => setAutopilotOn((v) => !v)}
          className={
            "px-3 py-2 rounded text-sm border transition " +
            (autopilotOn
              ? "bg-emerald-600 text-white border-emerald-700"
              : "bg-white text-gray-800 border-gray-300")
          }
        >
          Autopilot: {autopilotOn ? "On" : "Off"}
        </button>

        {/* Push-to-talk */}
        <button
          onClick={handlePTT}
          disabled={!autopilotOn}
          className={
            "px-3 py-2 rounded text-sm border flex items-center gap-1 " +
            (autopilotOn
              ? listening
                ? "bg-red-600 text-white border-red-700"
                : "bg-gray-900 text-white border-gray-900"
              : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed")
          }
        >
          <span>{listening ? "Listening…" : "Speak"}</span>
        </button>

        {/* Design Store entrypoint */}
        <CursorCanvasDesignStore
          onApplyPackById={onApplyPackByIdFromStore}
          getBaseSpec={() => specRef.current || spec}
          say={say}
          log={pushAutoLog}
        />
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
            transformOrigin: "center",
          }}
          ref={canvasRef}
        >
          {/* Shadow frame for measurements */}
          <div
            className="absolute rounded-lg shadow-2xl"
            style={{
              width: "1200px",
              height: "800px",
              pointerEvents: "none",
            }}
          />

          {/* Main iframe */}
          {url && (
            <iframe
              ref={iframeRef}
              src={url}
              className="rounded-lg bg-white"
              style={{
                width: "1200px",
                height: "800px",
                border: "1px solid #e5e7eb",
              }}
            />
          )}

          {/* Overlay for interactions */}
          <div
            ref={overlayRef}
            className="absolute inset-0 pointer-events-none"
            style={{
              width: "1200px",
              height: "800px",
            }}
          >
            {/* Hover highlight */}
            {hoverMeta && !freezeHover && (
              <HoverHighlight meta={hoverMeta} />
            )}

            {/* Measurements */}
            {(measureOn || modMeasure) && hoverMeta && (
              <Measurements meta={hoverMeta} />
            )}

            {/* Comments */}
            {comments.map((comment) => {
              const ts =
                (comment as any).ts ?? (comment as any).timestamp;
              return (
                <div
                  key={comment.id}
                  className="absolute bg-yellow-200 p-2 rounded shadow-sm text-xs"
                  style={{
                    left: `${comment.x}px`,
                    top: `${comment.y}px`,
                    maxWidth: "200px",
                  }}
                >
                  <div className="font-semibold mb-1">
                    {ts ? new Date(ts).toLocaleString() : ""}
                  </div>
                  <div>{comment.text}</div>
                  <button
                    onClick={() =>
                      deleteComment(comment.id, comments, setComments)
                    }
                    className="mt-1 text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>

          {/* Compare mode split view */}
          {ab.on && compareUrl && (
            <div
              className="absolute rounded-lg bg-white"
              style={{
                width: "1200px",
                height: "800px",
                left: "1250px",
                border: "1px solid #e5e7eb",
              }}
            >
              <iframe src={compareUrl} className="w-full h-full rounded-lg" />
              <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 text-white text-xs rounded">
                Variant B
              </div>
            </div>
          )}
        </div>

        {/* Floating panels */}

        {/* History panel */}
        {showHistory && (
          <div className="absolute left-3 top-3 w-64 bg-white rounded-lg shadow-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">History</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {history.map((h, i) => (
                <button
                  key={i}
                  onClick={() => setScrubIdx(i)}
                  className={
                    "w-full text-left px-2 py-1 rounded text-sm " +
                    (i === scrubIdx
                      ? "bg-blue-100 text-blue-900"
                      : "hover:bg-gray-100")
                  }
                >
                  {h.ts ? new Date(h.ts).toLocaleTimeString() : `Step ${i}`}
                </button>
              ))}
            </div>
            {history.length > 1 && (
              <input
                type="range"
                min="0"
                max={history.length - 1}
                value={scrubIdx}
                onChange={(e) => setScrubIdx(Number(e.target.value))}
                className="w-full mt-2"
              />
            )}
          </div>
        )}

        {/* Macros panel */}
        {showMacros && (
          <div className="absolute right-3 top-3 w-72 bg-white rounded-lg shadow-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Macros</h3>
              <button
                onClick={() => setShowMacros(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* Macro recording */}
            <div className="mb-3 p-2 bg-gray-50 rounded">
              <button
                onClick={() => {
                  if (recording) {
                    const actions = recordingRef.current || [];
                    setRecording(false);
                    recordingRef.current = [];
                    if (actions.length > 0) {
                      setPendingMacroActions([...actions]);
                      setPendingMacroName("");
                    }
                  } else {
                    recordingRef.current = [];
                    setRecording(true);
                    setPendingMacroActions(null);
                    setPendingMacroName("");
                  }
                }}
                className={
                  "px-3 py-1 rounded text-sm w-full " +
                  (recording
                    ? "bg-red-600 text-white"
                    : "bg-gray-900 text-white")
                }
              >
                {recording ? "Stop Recording" : "Record Macro"}
              </button>
              {recording && (
                <div className="mt-2 text-xs text-gray-600">
                  Actions: {recordingRef.current.length}
                </div>
              )}

              {pendingMacroActions && pendingMacroActions.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs text-gray-600">
                    Name this macro
                  </div>
                  <input
                    value={pendingMacroName}
                    onChange={(e) => setPendingMacroName(e.target.value)}
                    className="w-full px-2 py-1 border rounded text-xs"
                    placeholder="e.g. Tighten hero copy"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        const name =
                          pendingMacroName.trim() || "Untitled";
                        addMacro(
                          {
                            id: rid(8),
                            name,
                            actions: pendingMacroActions,
                            created: Date.now(),
                          } as any,
                          macros,
                          setMacros as any,
                        );
                        setPendingMacroActions(null);
                        setPendingMacroName("");
                      }}
                      className="px-2 py-1 rounded text-xs bg-gray-900 text-white hover:bg-black"
                    >
                      Save macro
                    </button>
                    <button
                      onClick={() => {
                        setPendingMacroActions(null);
                        setPendingMacroName("");
                      }}
                      className="px-2 py-1 rounded text-xs text-gray-500 hover:text-gray-700"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Macros list */}
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {macros.map((macro) => (
                <div
                  key={macro.id}
                  className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{macro.name}</div>
                    <div className="text-xs text-gray-500">
                      {(macro.actions?.length ?? 0)} actions
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => runMacro(macro as any, logicProps)}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Run
                    </button>
                    <button
                      onClick={() =>
                        deleteMacro(
                          macro.id,
                          macros as any,
                          setMacros as any,
                        )
                      }
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Del
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Import/Export */}
            <div className="mt-3 pt-3 border-t flex gap-2">
              <label className="flex-1">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleMacrosImport}
                  className="hidden"
                />
                <span className="block px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-center cursor-pointer">
                  Import
                </span>
              </label>
              <button
                onClick={handleMacrosExport}
                className="flex-1 px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              >
                Export
              </button>
            </div>
          </div>
        )}

        {/* Design adjustment panel */}
        {showDesign && (
          <div className="absolute left-3 bottom-3 w-64 bg-white rounded-lg shadow-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Design</h3>
              <button
                onClick={() => setShowDesign(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-600">Palette</label>
                <div className="flex gap-1 mt-1">
                  {designAdjust.palette.map((color, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={() => saveDesignAdjust(logicProps)}
                className="w-full px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Apply Design
              </button>
            </div>
          </div>
        )}

        {/* Chips panel */}
        {chips.length > 0 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-wrap gap-2 max-w-4xl">
            {chips.map((chip) => (
              <button
                key={chip}
                onClick={() => applyChip(chip, logicProps)}
                className="px-3 py-1 bg-white hover:bg-gray-50 border border-gray-200 rounded-full text-sm shadow-sm"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* Proof overlay */}
        {(showProof || modProof) && proof && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/80 text-white rounded-lg p-3 text-xs max-w-md">
            <div className="font-semibold mb-2">Proof Metrics</div>
            <div className="space-y-1">
              <div>Accessibility: {proof.accessibility?.score || "N/A"}</div>
              <div>SEO: {proof.seo?.score || "N/A"}</div>
              <div>Best Practices: {proof.bestPractices?.score || "N/A"}</div>
              {proof.issues && proof.issues.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/20">
                  <div className="font-semibold mb-1">Issues:</div>
                  {proof.issues.slice(0, 3).map((issue: any, i: number) => (
                    <div key={i} className="ml-2">
                      • {issue.description}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Performance overlay */}
        {(showPerf || modPerf) && proof?.perf && (
          <div className="absolute top-3 right-1/2 translate-x-1/2 bg-black/80 text-white rounded-lg p-3 text-xs max-w-md">
            <div className="font-semibold mb-2">Performance</div>
            <div className="space-y-1">
              <div>Score: {proof.perf.score || "N/A"}</div>
              <div>FCP: {proof.perf.fcp || "N/A"}ms</div>
              <div>LCP: {proof.perf.lcp || "N/A"}ms</div>
              <div>TTI: {proof.perf.tti || "N/A"}ms</div>
              <div>CLS: {proof.perf.cls || "N/A"}</div>
            </div>
          </div>
        )}

        {/* A/B Testing controls */}
        {ab.on && (
          <div className="absolute bottom-3 right-3 bg-white rounded-lg shadow-lg p-3">
            <div className="text-sm font-semibold mb-2">
              A/B Test: {ab.exp}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setAb({ ...ab, arm: "A" })}
                className={
                  "px-3 py-1 rounded text-sm " +
                  (ab.arm === "A"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100")
                }
              >
                A (Control)
              </button>
              <button
                onClick={() => setAb({ ...ab, arm: "B" })}
                className={
                  "px-3 py-1 rounded text-sm " +
                  (ab.arm === "B"
                    ? "bg-green-600 text-white"
                    : "bg-gray-100")
                }
              >
                B (Variant)
              </button>
            </div>
            {autoConfig?.enabled && (
              <div className="mt-2 text-xs text-gray-600">
                Auto-stop: {autoConfig.confidence * 100}% confidence
                {autoStopped && (
                  <div className="text-green-600">
                    Winner: {autoWinner}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Section order controls */}
        {sectionOrder.length > 0 && (
          <div className="absolute top-20 left-3 bg-white rounded-lg shadow-lg p-3 w-48">
            <div className="text-sm font-semibold mb-2">Sections</div>
            <div className="space-y-1">
              {sectionOrder.map((section, idx) => (
                <div
                  key={section}
                  className="flex items-center justify-between p-1 hover:bg-gray-50 rounded"
                >
                  <span className="text-sm truncate flex-1">{section}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() =>
                        moveSection(
                          idx,
                          -1,
                          sectionOrder,
                          setSectionOrder,
                          ySectionsRef,
                          yMuteRef,
                        )
                      }
                      disabled={idx === 0}
                      className="text-xs px-1 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() =>
                        moveSection(
                          idx,
                          1,
                          sectionOrder,
                          setSectionOrder,
                          ySectionsRef,
                          yMuteRef,
                        )
                      }
                      disabled={idx === sectionOrder.length - 1}
                      className="text-xs px-1 disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => applySectionOrder(logicProps)}
              className="w-full mt-2 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              Apply Order
            </button>
          </div>
        )}

        {/* Narrative panel */}
        {showNarrative && (
          <div className="absolute right-3 bottom-3 w-80 bg-white rounded-lg shadow-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Narrative</h3>
              <button
                onClick={() => setShowNarrative(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              className="w-full h-32 p-2 border rounded text-sm resize-none"
              placeholder="Describe the story or context..."
            />
          </div>
        )}

        {/* Goal input (floating) */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2">
          <input
            ref={goalRef}
            type="text"
            placeholder="Type a goal (0–100) and press Enter..."
            className="px-3 py-1 rounded-full border bg-white/90 backdrop-blur text-sm w-64"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.currentTarget.value) {
                applyGoal(e.currentTarget.value);
                e.currentTarget.value = "";
              }
            }}
          />
        </div>

        {/* Comment mode indicator */}
        {commentMode && (
          <div className="absolute top-3 right-3 px-3 py-1 bg-yellow-400 text-black rounded text-sm font-semibold">
            Comment Mode (Click to add)
          </div>
        )}

        {/* Army results */}
        {armyTop && armyTop.length > 0 && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-64 bg-white rounded-lg shadow-lg p-3 max-h-96 overflow-y-auto">
            <div className="font-semibold mb-2">Army Results</div>
            <div className="space-y-2">
              {armyTop.map((item: any, i: number) => (
                <button
                  key={i}
                  onClick={async () => {
                    const res = await supPost("/api/ai/instant/fromUrl", {
                      promptUrl: item.url,
                      sessionId,
                    });
                    const j: any = res.body;
                    if (res.ok && j) {
                      trySetCostMeta(j?.meta?.cost);
                      const u = j?.result?.url || j?.result?.path || null;
                      const pid = j?.result?.pageId || null;
                      setSpec(j.spec || null);
                      setChips((j.chips || []) as string[]);
                      setPreview(u, pid);
                      pushHistory({ url: u, pageId: pid, spec: j?.spec });
                    }
                  }}
                  className="w-full p-2 text-left hover:bg-gray-50 rounded border"
                >
                  <div className="text-sm font-medium">{item.prompt}</div>
                  <div className="text-xs text-gray-600">
                    Rating: {item.rating}/10
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {armyBusy && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-4 shadow-xl">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-2" />
              <div className="text-sm">Running army...</div>
            </div>
          </div>
        )}

        {/* Zoom/Pan indicator */}
        <div className="absolute bottom-3 left-3 text-xs text-gray-500">
          Zoom: {Math.round(zoom * 100)}% | Pan: {Math.round(pan.x)},{" "}
          {Math.round(pan.y)}
          {panning && " (panning)"}
        </div>

        {/* Controls legend */}
        <div className="absolute top-3 right-3 text-xs text-gray-400 space-y-1">
          <div>[R] Recompose</div>
          <div>[P] Proof</div>
          <div>[O] Performance</div>
          <div>[H] History</div>
          <div>[M] Macros</div>
          <div>[C] Comments</div>
          <div>[U] Undo</div>
          <div>[Space] Pan</div>
          <div>[[] []] Zoom</div>
          <div>[0] Reset view</div>
        </div>
      </div>

      {/* Autopilot panel */}
      {autopilotOn && (
        <div className="fixed bottom-3 left-3 w-80 bg-gray-900 text-white rounded-lg p-3 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Autopilot</h3>
            <button
              onClick={() => setAutopilotOn(false)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* A/B auto-stop status chip */}
          {autoConfig?.enabled && (
            <div className="text-[11px] text-emerald-300/80">
              AB auto-stop: on (
              {Math.round((autoConfig.confidence ?? 0.95) * 100)}% · ≥
              {autoConfig.minViews ?? 0} views
              {typeof autoConfig.minConversions === "number" &&
                autoConfig.minConversions > 0 && (
                  <> · ≥{autoConfig.minConversions} conv</>
                )}
              {autoStopped && autoWinner && (
                <> — winner: {String(autoWinner)}</>
              )}
            </div>
          )}

          <div className="max-h-32 overflow-y-auto space-y-1">
            {autoLog.length === 0 ? (
              <div className="text-[11px] text-gray-300">
                Press <b>Speak</b> and say something like{" "}
                <i>"make a dark waitlist page"</i>.
              </div>
            ) : (
              autoLog.map((entry, idx) => (
                <div
                  key={idx}
                  className="flex gap-1 text-[11px] leading-snug text-gray-100"
                >
                  <span className="uppercase opacity-60">
                    {entry.role === "you" ? "You" : "Pilot"}
                  </span>
                  <span className="flex-1 truncate">{entry.text}</span>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={undoLast}
              className="px-2 py-1 rounded border border-white/15 text-[11px] hover:bg-white/10 transition"
            >
              Undo last
            </button>
            <button
              onClick={() => {
                setAutoLog([]);
              }}
              className="px-2 py-1 rounded text-[11px] text-gray-300 hover:text-white hover:bg-white/5 transition"
            >
              Clear log
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
