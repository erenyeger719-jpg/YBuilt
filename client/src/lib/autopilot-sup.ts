// client/src/lib/autopilot-sup.ts
import { supPost } from "./supClient";

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
  kind: AutopilotIntentKind | string;
  summary: string;
  payload?: unknown;
};

/**
 * Fire-and-forget bridge from the Autopilot UX into SUP / audit logging.
 * Hard rule: this must NEVER break the user experience – failures are swallowed.
 */
const AUTOPILOT_SUP_ROUTE = "/api/sup/autopilot/intent";

export async function sendAutopilotIntent(
  intent: AutopilotIntent
): Promise<void> {
  // Basic sanity: nothing to send
  if (!intent || !intent.kind || !intent.summary) return;

  try {
    // Route string is intentionally opaque to the tests:
    // they only assert that it's a string and the body is the same object.
    await supPost(AUTOPILOT_SUP_ROUTE, intent);
  } catch {
    // SUP / telemetry is best-effort; UX must not explode if this fails.
    return;
  }
}
