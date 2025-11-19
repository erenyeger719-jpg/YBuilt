// client/src/lib/design-store.ts

// Shape used across Canvas, Store UI, and tests
export type UiDesignPack = {
  id: string;
  slot: string;
  name?: string;
  description?: string;
  tags?: string[];
  version?: number;
  specPatch?: any;
  contentSchema?: {
    fields?: Array<{
      key: string;
      label?: string;
      type?: string;
      description?: string;
    }>;
  };
  // Allow backend to add extra keys safely
  [key: string]: any;
};

export type DesignStoreListParams = {
  slot?: string;
  q?: string;
};

export type PublishDesignPackInput = {
  id?: string;
  slot: string;
  specPatch: any;
  name?: string;
  description?: string;
  tags?: string[];
  version?: number;
  contentSchema?: UiDesignPack["contentSchema"];
  [key: string]: any;
};

const API_BASE = "/api/design-store";

/**
 * Low-level JSON helper:
 * - Ensures JSON.
 * - Throws on non-2xx HTTP.
 */
async function fetchJson(
  path: string,
  init?: any,
): Promise<{ res: any; json: any }> {
  const res = await fetch(path, {
    headers: {
      Accept: "application/json",
      ...(init && init.headers),
    },
    ...init,
  });

  const text = await res.text();
  let json: any;

  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `Expected JSON from ${path}, got non-JSON response: ${text.slice(
        0,
        200,
      )}`,
    );
  }

  if (!res.ok) {
    const message =
      (json && typeof json === "object" && json.error) ||
      `Request failed with status ${res.status}`;
    const err: any = new Error(message);
    err.status = res.status;
    throw err;
  }

  return { res, json };
}

/**
 * Variant that never throws on non-2xx.
 * Lets the caller decide what to do with 404s / 500s.
 */
async function fetchJsonAllowError(
  path: string,
  init?: any,
): Promise<{ res: any; json: any }> {
  const res = await fetch(path, {
    headers: {
      Accept: "application/json",
      ...(init && init.headers),
    },
    ...init,
  });

  const text = await res.text();
  let json: any;

  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }

  return { res, json };
}

/**
 * List packs with optional filters (slot, q).
 * Throws on backend failure / network error.
 */
export async function listDesignStorePacks(
  params: DesignStoreListParams = {},
): Promise<UiDesignPack[]> {
  const qs = new URLSearchParams();
  if (params.slot) qs.set("slot", params.slot);
  if (params.q) qs.set("q", params.q);

  const path =
    `${API_BASE}/list` + (qs.toString() ? `?${qs.toString()}` : "");

  const { json } = await fetchJson(path);

  if (json && json.ok === false) {
    throw new Error(json.error || "Design store list failed");
  }

  const items = Array.isArray(json?.items) ? json.items : [];
  return items as UiDesignPack[];
}

// Aliases – to avoid breaking other call sites
export const fetchDesignStoreList = listDesignStorePacks;
export const listDesignPacks = listDesignStorePacks;

/**
 * Fetch a single pack by id.
 * - 200 + ok:true → returns pack
 * - 404 → returns null
 * - other errors → throws
 */
export async function getDesignStorePack(
  id: string,
): Promise<UiDesignPack | null> {
  if (!id) {
    throw new Error("id is required to fetch a design pack");
  }

  const { res, json } = await fetchJsonAllowError(
    `${API_BASE}/pack/${encodeURIComponent(id)}`,
  );

  if (res.status === 404) {
    return null;
  }

  if (!res.ok || (json && json.ok === false)) {
    const message =
      (json && typeof json === "object" && json.error) ||
      `Failed to fetch design pack ${id}`;
    const err: any = new Error(message);
    err.status = res.status;
    throw err;
  }

  const pack =
    json.pack ??
    json.item ??
    json.design ??
    (json.id ? json : null);

  if (!pack) {
    throw new Error(`No design pack payload found for id=${id}`);
  }

  return pack as UiDesignPack;
}

export const fetchDesignStorePack = getDesignStorePack;
export const getDesignPack = getDesignStorePack;
export const fetchDesignPack = getDesignStorePack; // <-- new alias

/**
 * Publish/save a pack to the store.
 * - 2xx + ok!==false → returns saved pack.
 * - 4xx/5xx or ok:false → throws.
 */
export async function publishDesignStorePack(
  input: PublishDesignPackInput,
): Promise<UiDesignPack> {
  const { json } = await fetchJson(`${API_BASE}/publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (json && json.ok === false) {
    throw new Error(json.error || "Design store publish failed");
  }

  const pack =
    json.pack ??
    json.item ??
    json.design ??
    (json.id ? json : null);

  if (!pack) {
    throw new Error("No design pack returned from publish");
  }

  return pack as UiDesignPack;
}

export const publishDesignPack = publishDesignStorePack;
export const saveDesignPackToStore = publishDesignStorePack;

// --- temporary shim for legacy callers ---
// Some older screens still import { fetchDesignPacks } from "@/lib/design-store".
// We expose this helper so they don't crash. It either calls the backend
// or safely returns an empty list on failure.
export async function fetchDesignPacks(): Promise<any[]> {
  try {
    const res = await fetch("/api/design-store/packs");

    if (!res.ok) {
      console.error(
        "[design-store] fetchDesignPacks: backend returned status",
        res.status,
      );
      return [];
    }

    const data = await res.json();

    // Accept a few common shapes and normalize to a simple array.
    if (Array.isArray(data)) return data;
    if (Array.isArray((data as any).items)) return (data as any).items;
    if (Array.isArray((data as any).packs)) return (data as any).packs;

    return [];
  } catch (err) {
    console.error("[design-store] fetchDesignPacks error", err);
    return [];
  }
}
