// server/design/design-store.ts
import fs from "fs";
import path from "path";

// 1) Types for slots and packs

export type DesignSlot =
  | "hero"
  | "navbar"
  | "feature-grid"
  | "pricing"
  | "testimonials"
  | "cta"
  | "footer";

export type UiDesignPackContentField = {
  key: string;
  label: string;
  type: "string" | "richtext" | "image" | "list";
  required?: boolean;
  default?: unknown;
};

export type UiDesignPackPricing = {
  kind: "free" | "paid";
  amountInCredits?: number;
};

export type UiDesignPack = {
  id: string;
  name: string;
  author?: string;
  slot: DesignSlot;
  description: string;
  previewUrl: string;
  tags: string[];
  // For now we keep this as "any" so we don't fight over Spec typing.
  specPatch: any;
  contentSchema: {
    fields: UiDesignPackContentField[];
  };
  pricing?: UiDesignPackPricing;
  preferredPosition?: "top" | "bottom" | "replace";
  version?: number;
};

export type UiDesignPackSummary = {
  id: string;
  name: string;
  author?: string;
  slot: DesignSlot;
  description: string;
  previewUrl: string;
  tags: string[];
  pricing?: UiDesignPackPricing;
};

// 2) Seed design packs (in-memory "database" for core/built-in packs)

const CORE_PACKS: UiDesignPack[] = [
  {
    id: "hero_minimal_dark",
    name: "Minimal Dark Hero",
    author: "YBuilt",
    slot: "hero",
    description: "A clean dark hero with a single CTA button.",
    previewUrl: "/static/design-packs/hero_minimal_dark.png",
    tags: ["hero", "dark", "minimal"],
    specPatch: {
      sections: [
        {
          id: "hero_minimal_dark_section",
          role: "hero",
          kind: "section",
          style: {
            theme: "dark",
            align: "center",
          },
          content: {
            headline: "Launch your next big thing",
            subheadline:
              "A focused, minimal hero section from the YBuilt design store.",
            primaryCtaLabel: "Get started",
          },
        },
      ],
    },
    contentSchema: {
      fields: [
        {
          key: "headline",
          label: "Main heading",
          type: "string",
          required: true,
          default: "Launch your next big thing",
        },
        {
          key: "subheadline",
          label: "Subheading",
          type: "richtext",
          default:
            "A focused, minimal hero section from the YBuilt design store.",
        },
        {
          key: "primaryCtaLabel",
          label: "Primary button text",
          type: "string",
          default: "Get started",
        },
      ],
    },
    pricing: {
      kind: "free",
    },
    preferredPosition: "top",
    version: 1,
  },
  {
    id: "pricing_3_tiers",
    name: "3-Tier Pricing",
    author: "YBuilt",
    slot: "pricing",
    description:
      "Three-column pricing section with a highlighted middle plan.",
    previewUrl: "/static/design-packs/pricing_3_tiers.png",
    tags: ["pricing", "3-tiers", "cards"],
    specPatch: {
      sections: [
        {
          id: "pricing_3_tiers_section",
          role: "pricing",
          kind: "section",
          content: {
            title: "Simple pricing",
            subtitle: "Pick the plan that fits you best.",
            tiers: [
              {
                id: "starter",
                name: "Starter",
                price: "$0",
                period: "Forever",
                badge: "Free",
                features: ["1 project", "Basic support"],
              },
              {
                id: "creator",
                name: "Creator",
                price: "$19",
                period: "per month",
                badge: "Most popular",
                features: [
                  "Unlimited projects",
                  "Email support",
                  "Basic analytics",
                ],
              },
              {
                id: "pro",
                name: "Pro",
                price: "$49",
                period: "per month",
                badge: "Teams",
                features: [
                  "Team workspaces",
                  "Priority support",
                  "Advanced analytics",
                ],
              },
            ],
          },
        },
      ],
    },
    contentSchema: {
      fields: [
        {
          key: "title",
          label: "Section title",
          type: "string",
          default: "Simple pricing",
        },
        {
          key: "subtitle",
          label: "Section subtitle",
          type: "richtext",
          default: "Pick the plan that fits you best.",
        },
        {
          key: "tiers",
          label: "Pricing tiers",
          type: "list",
        },
      ],
    },
    pricing: {
      kind: "free",
    },
    preferredPosition: "bottom",
    version: 1,
  },
  {
    id: "footer_basic",
    name: "Basic Footer",
    author: "YBuilt",
    slot: "footer",
    description: "Simple footer with links and copyright text.",
    previewUrl: "/static/design-packs/footer_basic.png",
    tags: ["footer", "links", "simple"],
    specPatch: {
      sections: [
        {
          id: "footer_basic_section",
          role: "footer",
          kind: "section",
          content: {
            text: "© 2025 Your Brand. All rights reserved.",
            links: [
              { label: "Privacy", href: "/privacy" },
              { label: "Terms", href: "/terms" },
            ],
          },
        },
      ],
    },
    contentSchema: {
      fields: [
        {
          key: "text",
          label: "Footer text",
          type: "string",
          default: "© 2025 Your Brand. All rights reserved.",
        },
        {
          key: "links",
          label: "Footer links",
          type: "list",
        },
      ],
    },
    pricing: {
      kind: "free",
    },
    preferredPosition: "bottom",
    version: 1,
  },
];

// 3) User packs (persisted to disk)

const USER_PACKS_FILE = path.join(
  process.cwd(),
  ".cache",
  "design-packs.user.json",
);

function loadUserPacksFromDisk(): UiDesignPack[] {
  try {
    const raw = fs.readFileSync(USER_PACKS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

let USER_PACKS: UiDesignPack[] = loadUserPacksFromDisk();

function persistUserPacks() {
  try {
    fs.mkdirSync(path.dirname(USER_PACKS_FILE), { recursive: true });
    fs.writeFileSync(
      USER_PACKS_FILE,
      JSON.stringify(USER_PACKS, null, 2),
      "utf8",
    );
  } catch {
    // Never crash because of user-pack persistence.
  }
}

// 4) Shared helpers

function toSummary(pack: UiDesignPack): UiDesignPackSummary {
  const {
    id,
    name,
    author,
    slot,
    description,
    previewUrl,
    tags,
    pricing,
  } = pack;
  return {
    id,
    name,
    author,
    slot,
    description,
    previewUrl,
    tags,
    pricing,
  };
}

// 5) Public API (used by routes and other modules)

// Core-only summaries (original behaviour)
export function listCorePacks(): UiDesignPackSummary[] {
  return CORE_PACKS.map(toSummary);
}

// Core-only full pack lookup
export function getCorePack(id: string): UiDesignPack | undefined {
  return CORE_PACKS.find((pack) => pack.id === id);
}

// All packs (core + user) full list
export function listAllPacks(): UiDesignPack[] {
  return [...CORE_PACKS, ...USER_PACKS];
}

// All packs (core + user) as summaries
export function listAllPacksSummary(): UiDesignPackSummary[] {
  return listAllPacks().map(toSummary);
}

// Find in core or user packs
export function getAnyPack(id: string): UiDesignPack | undefined {
  return (
    CORE_PACKS.find((pack) => pack.id === id) ||
    USER_PACKS.find((pack) => pack.id === id)
  );
}

// Add or update a user pack and persist to disk
export function addUserPack(pack: UiDesignPack): UiDesignPack {
  // Protect against id collisions with core packs
  const coreIdx = CORE_PACKS.findIndex((p) => p.id === pack.id);
  if (coreIdx !== -1) {
    throw new Error("design_pack_id_conflicts_with_core");
  }

  const existingIdx = USER_PACKS.findIndex((p) => p.id === pack.id);
  if (existingIdx !== -1) {
    USER_PACKS[existingIdx] = pack;
  } else {
    USER_PACKS.push(pack);
  }

  persistUserPacks();
  return pack;
}
