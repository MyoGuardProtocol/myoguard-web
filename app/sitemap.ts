import type { MetadataRoute } from "next";
import { publicArticleSitemapEntries } from "@/src/lib/learn/evidenceExplained/publicArticles";

const BASE_URL = "https://myoguard.health";

// Generated per request, not cached: the Evidence Explained selector judges
// article exposure against today's date, and a cached sitemap would keep
// listing an article whose review had fallen due. Reads module data only.
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/get-started`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    // ── Research layer ──────────────────────────────────────────────────────
    {
      url: `${BASE_URL}/research`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/research/library`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/research/glp1-therapy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/research/muscle-preservation`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/research/protein-requirements`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/research/sarcopenia-risk`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/research/participate`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    // ── Patient education layer ─────────────────────────────────────────────
    // The patient-led discovery pathway. Separate from the research layer
    // above, which addresses clinicians.
    {
      url: `${BASE_URL}/learn`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/learn/protein-on-glp-1`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    // Evidence Explained: publicly exposable articles only, from the central
    // selector. Empty until an article is published.
    ...publicArticleSitemapEntries(),
  ];
}
