import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/privacy", "/terms", "/get-started", "/sign-in", "/sign-up"],
        disallow: [
          "/admin/",
          "/dashboard/",
          "/doctor/",
          "/api/",
          "/onboarding",
          "/checkin",
          "/sign-out",
          "/report/",
          "/join",
          "/sign-in-new/",
          "/sign-up-new/",
        ],
      },
    ],
    sitemap: "https://myoguard.health/sitemap.xml",
  };
}
