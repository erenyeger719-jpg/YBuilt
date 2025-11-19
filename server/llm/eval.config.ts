// server/llm/eval.config.ts
export type EvalMode = "off" | "shadow" | "partial";

export type EvalConfig = {
  primary: string;
  challenger?: string | null;
  mode: EvalMode;
  sampleRate: number; // 0..1
};

let currentConfig: EvalConfig = {
  primary: "main",
  challenger: null,
  mode: "off",
  sampleRate: 0,
};

export function getEvalConfig(): EvalConfig {
  // return a shallow copy so callers can't mutate our internal state
  return { ...currentConfig };
}

export function setEvalConfig(next: Partial<EvalConfig>): void {
  currentConfig = {
    ...currentConfig,
    ...next,
  };

  // clamp sampleRate into [0, 1]
  if (currentConfig.sampleRate < 0) currentConfig.sampleRate = 0;
  if (currentConfig.sampleRate > 1) currentConfig.sampleRate = 1;
}

export function primaryModel(): string {
  return currentConfig.primary;
}

export function challengerModel(): string | null {
  if (!currentConfig.challenger) return null;
  if (currentConfig.mode === "off") return null;
  return currentConfig.challenger;
}

/**
 * Decide if we should run the challenger model for this request.
 * - When mode = "off": never.
 * - When mode = "shadow": always.
 * - When mode = "partial": true if sample < sampleRate.
 *
 * `sample` lets tests be deterministic (we don't have to use Math.random).
 */
export function shouldRunChallenger(sample?: number): boolean {
  if (!currentConfig.challenger) return false;
  if (currentConfig.mode === "off") return false;

  const x = typeof sample === "number" ? sample : Math.random();

  if (currentConfig.mode === "shadow") {
    return true;
  }

  // mode === "partial"
  return x < currentConfig.sampleRate;
}
