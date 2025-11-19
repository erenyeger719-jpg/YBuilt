// client/src/lib/supClient.ts

export type SupResponse<T = any> = {
  ok: boolean;              // final verdict from client wrapper
  status: number;           // HTTP status (0 = network error)
  supMode: string | null;   // X-SUP-Mode header if present
  supReasons: string | null; // X-SUP-Reasons header if present
  body: T | null;           // parsed JSON body (if any)
};

/**
 * POST helper for SUP-backed routes.
 * - Always resolves (never throws).
 * - Captures SUP headers + HTTP status.
 * - Treats body.ok === false as a failure even if HTTP is 200.
 */
export async function supPost<T = any>(
  path: string,
  payload: any
): Promise<SupResponse<T>> {
  try {
    const res: any = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const headers = res.headers as { get?: (name: string) => string | null } | undefined;
    const supMode = headers?.get?.("x-sup-mode") || headers?.get?.("X-SUP-Mode") || null;
    const supReasons =
      headers?.get?.("x-sup-reasons") || headers?.get?.("X-SUP-Reasons") || null;

    let body: any = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    const serverOkFlag =
      body && typeof body === "object" && "ok" in body ? !!(body as any).ok : true;

    const ok = !!res.ok && serverOkFlag;

    return {
      ok,
      status: typeof res.status === "number" ? res.status : 0,
      supMode,
      supReasons,
      body: body as T | null,
    };
  } catch {
    // Network failure or something equally bad
    return {
      ok: false,
      status: 0,
      supMode: null,
      supReasons: "network_error",
      body: null,
    };
  }
}
