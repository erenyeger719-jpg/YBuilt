// client/src/lib/autopilot-sup.ts

export type AutopilotIntentKind =
  | "compose"
  | "chip"
  | "ab_start"
  | "ab_stop"
  | "ab_config"
  | "undo"
  | "status"
  | "other";

export type AutopilotIntent = {
  kind: AutopilotIntentKind;
  summary: string; // short human sentence
  payload?: Record<string, unknown>; // extra details if needed
};

/**
 * Fire-and-forget call so SUP ALGO can “see”
 * what Autopilot just did.
 */
export async function sendAutopilotIntent(intent: AutopilotIntent): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    await fetch("/api/ai/autopilot/intent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...intent,
        source: "autopilot",
        ts: Date.now(),
      }),
    });
  } catch {
    // Never break the UI if this fails.
  }
}
