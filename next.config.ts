import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /**
     * Allow next/image to optimise avatars from Clerk's CDN and the
     * OAuth providers Clerk supports (Google, GitHub, etc.).
     *
     * img.clerk.com    — Clerk-hosted generated + uploaded avatars
     * images.clerk.dev — legacy Clerk image domain
     * lh3.googleusercontent.com — Google OAuth profile pictures
     * avatars.githubusercontent.com — GitHub OAuth profile pictures
     * www.gravatar.com — Gravatar fallbacks (some Clerk environments)
     */
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.clerk.dev" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "www.gravatar.com" },
    ],
  },
};

export default nextConfig;
