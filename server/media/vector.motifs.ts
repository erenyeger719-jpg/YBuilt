// server/media/vector.motifs.ts

export interface MotifEvent {
  motifId: string;
  // Optional brand / workspace key – can be null for global motifs.
  brandKey?: string | null;

  // Whether this motif was actually shown.
  // We treat any event as an impression unless seen === false.
  seen?: boolean;

  // Whether this impression ended in a conversion.
  converted?: boolean;
}

export interface MotifStats {
  motifId: string;
  brandKey: string | null;
  impressions: number;
  conversions: number;
  conversionRate: number; // 0..1
}

export interface MotifSummary {
  totalEvents: number;
  stats: MotifStats[];
}

/**
 * Aggregate raw motif usage events into per-(brandKey, motifId) stats.
 */
export function summarizeMotifs(events: MotifEvent[]): MotifSummary {
  const byKey = new Map<
    string,
    {
      motifId: string;
      brandKey: string | null;
      impressions: number;
      conversions: number;
    }
  >();

  for (const ev of events) {
    if (!ev || !ev.motifId) continue;

    const motifId = ev.motifId;
    const brandKey =
      typeof ev.brandKey === "string" ? ev.brandKey : null;

    const mapKey = `${brandKey ?? ""}::${motifId}`;
    const cur =
      byKey.get(mapKey) || {
        motifId,
        brandKey,
        impressions: 0,
        conversions: 0,
      };

    // Count an impression for any event unless explicitly seen === false.
    const isSeen = ev.seen !== false;
    if (isSeen) {
      cur.impressions += 1;
    }

    if (ev.converted) {
      cur.conversions += 1;
      // Note: we assume converted implies it was seen, but we don't
      // enforce that here in case logs are messy.
    }

    byKey.set(mapKey, cur);
  }

  const stats: MotifStats[] = [];
  for (const entry of byKey.values()) {
    const { motifId, brandKey, impressions, conversions } = entry;
    const conversionRate =
      impressions > 0 ? conversions / impressions : 0;

    stats.push({
      motifId,
      brandKey,
      impressions,
      conversions,
      conversionRate,
    });
  }

  return {
    totalEvents: events.length,
    stats,
  };
}

/**
 * Rank motifs for a given brandKey, falling back to "global" motifs
 * (brandKey === null) when there is no brand-specific history.
 *
 * Sort order:
 * - Higher conversionRate first
 * - Then higher impressions (more data wins ties)
 * - Then motifId for stability
 */
export function rankMotifsForBrand(
  summary: MotifSummary,
  brandKey: string | null,
  limit = 3
): MotifStats[] {
  const key = brandKey ?? null;

  let candidates = summary.stats.filter(
    (s) => s.brandKey === key
  );

  if (candidates.length === 0 && key !== null) {
    // Fallback: use global motifs (brandKey === null)
    candidates = summary.stats.filter(
      (s) => s.brandKey === null
    );
  }

  if (candidates.length === 0) {
    return [];
  }

  candidates.sort((a, b) => {
    if (b.conversionRate !== a.conversionRate) {
      return b.conversionRate - a.conversionRate;
    }
    if (b.impressions !== a.impressions) {
      return b.impressions - a.impressions;
    }
    return a.motifId.localeCompare(b.motifId);
  });

  if (limit != null && Number.isFinite(limit) && limit > 0) {
    return candidates.slice(0, limit);
  }

  return candidates;
}
