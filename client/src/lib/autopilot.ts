// client/src/lib/autopilot.ts
export type AutopilotLogRole = "you" | "pilot";

export type AutopilotOpts = {
  say?: (text: string) => void;
  askConfirm?: (plan: string) => Promise<boolean>;
  log?: (role: AutopilotLogRole, text: string) => void;
  actions: {
    setPrompt: (s: string) => void;

    composeInstant: () => Promise<void> | void;
    applyChip: (chip: string) => Promise<void> | void;

    setZeroJs: (on: boolean) => Promise<void> | void;

    runArmyTop: () => Promise<void> | void;
    blendTopWinner: () => Promise<void> | void;

    startBasicAB: () => void;
    toggleAB: (on?: boolean) => void;
    setABAuto: (
      cfg: Partial<{ confidence: number; minViews: number; minConv: number; enabled: boolean }>
    ) => void;
    viewArm: (arm: "A" | "B") => void;

    setAutopilot: (on: boolean) => void;

    undo: () => void;

    reportStatus: () => Promise<string | null> | string | null;

    setGoalAndApply: (n: number) => Promise<void> | void;

    setDataSkin: (skin: "normal" | "empty" | "long" | "skeleton" | "error") => Promise<void> | void;

    toggleComments: (on?: boolean) => void;
  };
};

export class Autopilot {
  private say?: (t: string) => void;
  private log?: (r: AutopilotLogRole, t: string) => void;
  private A: AutopilotOpts["actions"];

  constructor(opts: AutopilotOpts) {
    this.say = opts.say;
    this.log = opts.log;
    this.A = opts.actions;
  }

  async handle(raw: string) {
    const t = (raw || "").trim();
    if (!t) return;

    const low = t.toLowerCase();
    const told = (msg: string) => {
      try {
        this.say?.(msg);
      } catch {}
      this.log?.("pilot", msg);
    };

    // --- Compose / Recompose / Prompt ---
    if (/^(make|compose)\b/i.test(t)) {
      // If user wrote “make X…”, capture the prompt portion to setPrompt before compose
      const m = t.match(/^(?:make|compose)\s+(.*)$/i);
      if (m && m[1]) this.A.setPrompt(m[1].trim());
      await this.A.composeInstant();
      return;
    }
    if (/\brecompose\b/i.test(t)) {
      // Delegate to UI hotkey path (you already wire recompose via actions around spec)
      await this.A.composeInstant(); // safest fallback
      return;
    }

    // --- Chips (quick intents) ---
    if (/\bfix (contrast|read(ability|able))\b/i.test(t)) {
      await this.A.applyChip("More minimal");
      return;
    }
    if (/\b(email|signup).*(cta|call to action)|\b(sign[-\s]?up)\b/i.test(low)) {
      await this.A.applyChip("Use email signup CTA");
      return;
    }
    if (/\b(use|enable)\s+dark\b/i.test(t)) {
      await this.A.applyChip("Use dark mode");
      return;
    }

    // --- Zero-JS toggle ---
    if (/\b(zero[-\s]?js|no js)\b/i.test(low)) {
      const on = low.includes("off") ? false : low.includes("on") ? true : true;
      await this.A.setZeroJs(on);
      told(`Zero-JS ${on ? "enabled" : "disabled"}.`);
      return;
    }

    // --- Army + Blend ---
    if (/\brun army\b/i.test(low)) {
      await this.A.runArmyTop();
      return;
    }
    if (/\bblend( winner)?\b/i.test(low)) {
      await this.A.blendTopWinner();
      return;
    }

    // --- A/B controls ---
    if (/start( an| the)?\s*(a\/?b|ab)/i.test(low)) {
      this.A.startBasicAB();
      told("A/B started.");
      return;
    }
    if (/stop( the)?\s*(a\/?b|ab)/i.test(low)) {
      this.A.toggleAB(false);
      told("A/B stopped.");
      return;
    }
    if (/\btoggle (a\/?b|ab)\b/i.test(low)) {
      this.A.toggleAB();
      return;
    }

    // Arm view
    const mView = low.match(/\bview (a|b)\b/i);
    if (mView) {
      const arm = (mView[1].toUpperCase() as "A" | "B");
      this.A.viewArm(arm);
      return;
    }

    // Experiment name
    const mExp = t.match(/\bexperiment (?:is|=)\s*([a-z0-9_\-]+)\b/i);
    if (mExp) {
      // No direct setter in actions: piggyback via toggleAB() to keep UX — handled by UI input normally
      told(`Experiment set hint: ${mExp[1]}`);
      return;
    }

    // Auto-stop tuning
    const mConf = low.match(/\b(conf|confidence)\s*(\d{1,3})\b/);
    if (mConf) {
      const n = Math.max(50, Math.min(99, parseInt(mConf[2], 10)));
      this.A.setABAuto({ confidence: n / 100 });
      told(`Auto-stop confidence ≈ ${n}%`);
      return;
    }
    const mMV = low.match(/\bmin\s*views?\s*(\d{1,6})\b/);
    if (mMV) {
      this.A.setABAuto({ minViews: parseInt(mMV[1], 10) });
      told(`Auto-stop minViews = ${mMV[1]}`);
      return;
    }
    const mMC = low.match(/\bmin\s*(conv|conversions?)\s*(\d{1,6})\b/);
    if (mMC) {
      this.A.setABAuto({ minConv: parseInt(mMC[2], 10) });
      told(`Auto-stop minConv = ${mMC[2]}`);
      return;
    }
    if (/\bauto[-\s]?stop\b.*\bon\b/i.test(low)) {
      this.A.setABAuto({ enabled: true });
      told("Auto-stop enabled.");
      return;
    }
    if (/\bauto[-\s]?stop\b.*\boff\b/i.test(low)) {
      this.A.setABAuto({ enabled: false });
      told("Auto-stop disabled.");
      return;
    }

    // --- Data skins ---
    const mSkin = low.match(/\bdata (normal|empty|long|skeleton|error)\b/);
    if (mSkin) {
      this.A.setDataSkin(mSkin[1] as any);
      return;
    }

    // --- Goal slider ---
    const mGoal = low.match(/\bgoal\s+(\d{1,3})\b/);
    if (mGoal) {
      const n = Math.max(0, Math.min(100, parseInt(mGoal[1], 10)));
      await this.A.setGoalAndApply(n);
      told(`Goal set → ${n}`);
      return;
    }

    // --- Comments ---
    if (/\bcomment mode\b.*\bon\b/i.test(low)) {
      this.A.toggleComments(true);
      told("Comment mode ON.");
      return;
    }
    if (/\bcomment mode\b.*\boff\b/i.test(low)) {
      this.A.toggleComments(false);
      told("Comment mode OFF.");
      return;
    }
    if (/\btoggle comments?\b/i.test(low)) {
      this.A.toggleComments();
      return;
    }

    // --- Undo / Status ---
    if (/\bundo\b/i.test(low)) {
      this.A.undo();
      return;
    }
    if (/\b(status|report)\b/i.test(low)) {
      const s = await this.A.reportStatus();
      if (s) told(s);
      return;
    }

    // Fallback: if the user typed anything else like “make …” without keyword
    if (t.length > 2) {
      this.A.setPrompt(t);
      await this.A.composeInstant();
    }
  }
}
