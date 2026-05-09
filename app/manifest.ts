import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MyoGuard Protocol",
    short_name: "MyoGuard",
    description:
      "Physician-led Clinical Decision Support for muscle preservation during GLP-1 therapy.",
    start_url: "/",
    display: "standalone",
    background_color: "#080C14",
    theme_color: "#2DD4BF",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      // TODO (pre-launch): { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" }
      // TODO (pre-launch): { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
    ],
  };
}
