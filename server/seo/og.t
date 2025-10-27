// server/seo/og.ts
type Brand = { primary?: string; dark?: boolean; tokens?: any };
export function buildSEO({
  title,
  description,
  brand,
  url,
}: { title: string; description?: string; brand?: Brand; url?: string | null }) {
  const site = (title || "Preview").slice(0, 60);
  const desc = (description || "").slice(0, 160);
  const color = brand?.primary || "#6d28d9";
  return {
    title: site,
    description: desc,
    themeColor: color,
    og: {
      "og:title": site,
      "og:description": desc,
      "og:type": "website",
      ...(url ? { "og:url": url } : {}),
    },
    twitter: {
      "twitter:card": "summary_large_image",
      "twitter:title": site,
      "twitter:description": desc,
    },
  };
}
