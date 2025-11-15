// client/src/lib/autopilot.ts
import { sendAutopilotIntent } from "./autopilot-sup";

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
  private askConfirm?: (plan: string) => Promise<boolean>;
  private A: AutopilotOpts["actions"];

  constructor(opts: AutopilotOpts) {
    this.say = opts.say;
    this.log = opts.log;
    this.askConfirm = opts.askConfirm;
    this.A = opts.actions;
  }

  private async confirmAndRun(
    plan: string,
    work: () => Promise<void> | void
  ): Promise<void> {
    // If no confirm handler, just run.
    if (!this.askConfirm) {
      await work();
      return;
    }

    try {
      const ok = await this.askConfirm(plan);
      if (!ok) {
        this.log?.("pilot", `Cancelled: ${plan}`);
        return;
      }
      await work();
    } catch {
      // If confirm UI crashes, fail open rather than breaking Autopilot.
      await work();
    }
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

    // --- Autopilot ON / OFF (voice pause / resume) ---
    if (
      /\b(autopilot (?:off|stop|disable)|pause autopilot|turn autopilot off)\b/i.test(low)
    ) {
      this.A.setAutopilot(false);
      sendAutopilotIntent({
        kind: "other",
        summary: "Autopilot turned OFF by voice.",
        payload: { on: false },
      });
      told("Autopilot paused.");
      return;
    }

    if (
      /\b(autopilot (?:on|start|enable)|resume autopilot|turn autopilot on)\b/i.test(low)
    ) {
      this.A.setAutopilot(true);
      sendAutopilotIntent({
        kind: "other",
        summary: "Autopilot turned ON by voice.",
        payload: { on: true },
      });
      told("Autopilot resumed.");
      return;
    }

    // --- Compose / Recompose / Prompt ---
    if (/^(make|compose)\b/i.test(t)) {
      // If user wrote “make X…”, capture the prompt portion to setPrompt before compose
      const m = t.match(/^(?:make|compose)\s+(.*)$/i);
      const prompt = m && m[1] ? m[1].trim() : "";

      if (prompt) this.A.setPrompt(prompt);

      const plan = prompt
        ? `Compose page for: "${prompt}"`
        : "Compose with current context.";

      await this.confirmAndRun(plan, async () => {
        sendAutopilotIntent({
          kind: "compose",
          summary: prompt
            ? `Compose for: "${prompt}"`
            : "Compose with current context.",
          payload: prompt ? { prompt } : undefined,
        });

        await this.A.composeInstant();
      });

      return;
    }

    if (/\brecompose\b/i.test(t)) {
      const plan = "Recompose current page.";

      await this.confirmAndRun(plan, async () => {
        sendAutopilotIntent({
          kind: "compose",
          summary: "Recompose current page.",
          payload: { mode: "recompose" },
        });
        await this.A.composeInstant(); // safest fallback
      });

      return;
    }

    // --- Chips (quick intents) ---
    if (/\bfix (contrast|read(ability|able))\b/i.test(t)) {
      const chip = "More minimal";
      sendAutopilotIntent({
        kind: "chip",
        summary: `Apply chip: ${chip}`,
        payload: { chip },
      });
      await this.A.applyChip(chip);
      return;
    }
    if (/\b(email|signup).*(cta|call to action)|\b(sign[-\s]?up)\b/i.test(low)) {
      const chip = "Use email signup CTA";
      sendAutopilotIntent({
        kind: "chip",
        summary: `Apply chip: ${chip}`,
        payload: { chip },
      });
      await this.A.applyChip(chip);
      return;
    }
    if (/\b(use|enable)\s+dark\b/i.test(t)) {
      const chip = "Use dark mode";
      sendAutopilotIntent({
        kind: "chip",
        summary: `Apply chip: ${chip}`,
        payload: { chip },
      });
      await this.A.applyChip(chip);
      return;
    }

    // --- Zero-JS toggle ---
    if (/\b(zero[-\s]?js|no js)\b/i.test(low)) {
      const on = low.includes("off") ? false : low.includes("on") ? true : true;
      const plan = `Toggle zero-JS ${on ? "ON" : "OFF"}.`;

      await this.confirmAndRun(plan, async () => {
        sendAutopilotIntent({
          kind: "other",
          summary: `Toggle zero-JS ${on ? "on" : "off"}.`,
          payload: { on },
        });
        await this.A.setZeroJs(on);
        told(`Zero-JS ${on ? "enabled" : "disabled"}.`);
      });

      return;
    }

    // --- Army + Blend ---
    if (/\brun army\b/i.test(low)) {
      const plan = "Run SUP army for more variants.";

      await this.confirmAndRun(plan, async () => {
        sendAutopilotIntent({
          kind: "compose",
          summary: "Run SUP army for more variants.",
          payload: { mode: "army" },
        });
        await this.A.runArmyTop();
      });

      return;
    }
    if (/\bblend( winner)?\b/i.test(low)) {
      const plan = "Blend top winning variant from army.";

      await this.confirmAndRun(plan, async () => {
        sendAutopilotIntent({
          kind: "compose",
          summary: "Blend top winning variant from army.",
          payload: { mode: "blend" },
        });
        await this.A.blendTopWinner();
      });

      return;
    }

    // --- A/B controls ---
    if (/start( an| the)?\s*(a\/?b|ab)/i.test(low)) {
      const plan = "Start A/B test on this page.";

      await this.confirmAndRun(plan, async () => {
        this.A.startBasicAB();
        sendAutopilotIntent({
          kind: "ab_start",
          summary: "Start A/B test on this page.",
        });
        told("A/B started.");
      });

      return;
    }

    if (/stop( the)?\s*(a\/?b|ab)/i.test(low)) {
      const plan = "Stop current A/B test.";

      await this.confirmAndRun(plan, async () => {
        this.A.toggleAB(false);
        sendAutopilotIntent({
          kind: "ab_stop",
          summary: "Stop current A/B test.",
        });
        told("A/B stopped.");
      });

      return;
    }

    if (/\btoggle (a\/?b|ab)\b/i.test(low)) {
      this.A.toggleAB();
      sendAutopilotIntent({
        kind: "other",
        summary: "Toggle A/B on/off.",
      });
      return;
    }

    // Arm view
    const mView = low.match(/\bview (a|b)\b/i);
    if (mView) {
      const arm = mView[1].toUpperCase() as "A" | "B";
      this.A.viewArm(arm);
      sendAutopilotIntent({
        kind: "other",
        summary: `View variant ${arm}.`,
        payload: { arm },
      });
      return;
    }

    // Experiment name
    const mExp = t.match(/\bexperiment (?:is|=)\s*([a-z0-9_\-]+)\b/i);
    if (mExp) {
      const name = mExp[1];
      sendAutopilotIntent({
        kind: "other",
        summary: `Experiment name hint: ${name}`,
        payload: { name },
      });
      told(`Experiment set hint: ${name}`);
      return;
    }

    // Auto-stop tuning
    const mConf = low.match(/\b(conf|confidence)\s*(\d{1,3})\b/);
    if (mConf) {
      const n = Math.max(50, Math.min(99, parseInt(mConf[2], 10)));
      this.A.setABAuto({ confidence: n / 100 });
      sendAutopilotIntent({
        kind: "ab_config",
        summary: `Set auto-stop confidence ≈ ${n}%`,
        payload: { confidence: n / 100 },
      });
      told(`Auto-stop confidence ≈ ${n}%`);
      return;
    }
    const mMV = low.match(/\bmin\s*views?\s*(\d{1,6})\b/);
    if (mMV) {
      const minViews = parseInt(mMV[1], 10);
      this.A.setABAuto({ minViews });
      sendAutopilotIntent({
        kind: "ab_config",
        summary: `Set auto-stop minViews = ${minViews}.`,
        payload: { minViews },
      });
      told(`Auto-stop minViews = ${mMV[1]}`);
      return;
    }
    const mMC = low.match(/\bmin\s*(conv|conversions?)\s*(\d{1,6})\b/);
    if (mMC) {
      const minConv = parseInt(mMC[2], 10);
      this.A.setABAuto({ minConv });
      sendAutopilotIntent({
        kind: "ab_config",
        summary: `Set auto-stop minConv = ${minConv}.`,
        payload: { minConv },
      });
      told(`Auto-stop minConv = ${mMC[2]}`);
      return;
    }
    if (/\bauto[-\s]?stop\b.*\bon\b/i.test(low)) {
      this.A.setABAuto({ enabled: true });
      sendAutopilotIntent({
        kind: "ab_config",
        summary: "Enable auto-stop for A/B.",
        payload: { enabled: true },
      });
      told("Auto-stop enabled.");
      return;
    }
    if (/\bauto[-\s]?stop\b.*\boff\b/i.test(low)) {
      this.A.setABAuto({ enabled: false });
      sendAutopilotIntent({
        kind: "ab_config",
        summary: "Disable auto-stop for A/B.",
        payload: { enabled: false },
      });
      told("Auto-stop disabled.");
      return;
    }

    // --- Data skins ---
    const mSkin = low.match(/\bdata (normal|empty|long|skeleton|error)\b/);
    if (mSkin) {
      const skin = mSkin[1] as "normal" | "empty" | "long" | "skeleton" | "error";
      sendAutopilotIntent({
        kind: "other",
        summary: `Switch data skin to ${skin}.`,
        payload: { skin },
      });
      this.A.setDataSkin(skin);
      return;
    }

    // --- Goal slider ---
    const mGoal = low.match(/\bgoal\s+(\d{1,3})\b/);
    if (mGoal) {
      const n = Math.max(0, Math.min(100, parseInt(mGoal[1], 10)));
      await this.A.setGoalAndApply(n);
      sendAutopilotIntent({
        kind: "other",
        summary: `Set goal slider to ${n}.`,
        payload: { goal: n },
      });
      told(`Goal set → ${n}`);
      return;
    }

    // --- Comments ---
    if (/\bcomment mode\b.*\bon\b/i.test(low)) {
      this.A.toggleComments(true);
      sendAutopilotIntent({
        kind: "other",
        summary: "Comment mode ON.",
        payload: { on: true },
      });
      told("Comment mode ON.");
      return;
    }
    if (/\bcomment mode\b.*\boff\b/i.test(low)) {
      this.A.toggleComments(false);
      sendAutopilotIntent({
        kind: "other",
        summary: "Comment mode OFF.",
        payload: { on: false },
      });
      told("Comment mode OFF.");
      return;
    }
    if (/\btoggle comments?\b/i.test(low)) {
      this.A.toggleComments();
      sendAutopilotIntent({
        kind: "other",
        summary: "Toggle comment mode.",
      });
      return;
    }

    // --- Undo / Status ---
    if (/\bundo\b/i.test(low)) {
      this.A.undo();
      sendAutopilotIntent({
        kind: "undo",
        summary: "Undo last change.",
      });
      return;
    }
    if (/\b(status|report)\b/i.test(low)) {
      const s = await this.A.reportStatus();
      sendAutopilotIntent({
        kind: "status",
        summary: "Report status requested.",
      });
      if (s) told(s);
      return;
    }

    // Fallback: if the user typed anything else like “make …” without keyword
    if (t.length > 2) {
      this.A.setPrompt(t);

      const plan = `Compose from free-form prompt.`;

      await this.confirmAndRun(plan, async () => {
        sendAutopilotIntent({
          kind: "compose",
          summary: `Compose from free-form prompt.`,
          payload: { prompt: t },
        });

        await this.A.composeInstant();
      });
    }
  }
}
