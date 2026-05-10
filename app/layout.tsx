import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import Footer from "@/src/components/ui/Footer";
import PostHogProvider from "@/src/components/analytics/PostHogProvider";
import "./globals.css";

const geistSans = Geist({
variable: "--font-geist-sans",
subsets: ["latin"],
});

const geistMono = Geist_Mono({
variable: "--font-geist-mono",
subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://myoguard.health"),
  title: {
    default: "MyoGuard Protocol | GLP-1 Muscle Protection CDS",
    template: "%s | MyoGuard Protocol",
  },
  description:
    "Physician-led Clinical Decision Support for muscle preservation during GLP-1 therapy using the Sarcopenia Risk Index (SRI).",
  keywords: [
    "GLP-1 muscle preservation",
    "sarcopenia risk index",
    "SRI",
    "physician-led clinical decision support",
    "semaglutide muscle loss",
    "tirzepatide protein protocol",
    "GLP-1 therapy muscle",
    "muscle preservation protocol",
    "clinical decision support GLP-1",
    "MyoGuard Protocol",
    "GLP-1 sarcopenia",
  ],
  authors: [{ name: "Meridian Wellness Systems LLC" }],
  creator: "Meridian Wellness Systems LLC",
  publisher: "Meridian Wellness Systems LLC",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://myoguard.health",
    siteName: "MyoGuard Protocol",
    title: "MyoGuard Protocol | GLP-1 Muscle Protection CDS",
    description:
      "Physician-led Clinical Decision Support for muscle preservation during GLP-1 therapy using the Sarcopenia Risk Index (SRI).",
    // OG image is auto-injected from app/opengraph-image.tsx via Next.js file convention
  },
  twitter: {
    card: "summary_large_image",
    title: "MyoGuard Protocol | GLP-1 Muscle Protection CDS",
    description:
      "Physician-led Clinical Decision Support for muscle preservation during GLP-1 therapy using the Sarcopenia Risk Index (SRI).",
    // Twitter image falls back to app/opengraph-image.tsx; add creator handle once X account is verified
  },
  alternates: {
    canonical: "https://myoguard.health",
  },
  // Icons are auto-detected: app/favicon.ico, app/icon.svg, app/apple-icon.tsx
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          fontFamily: "inherit",
        },
        elements: {
          otpCodeFieldInput: {
            width: "44px",
            height: "52px",
            fontSize: "20px",
            lineHeight: "normal",
            textAlign: "center",
            padding: "0",
            boxSizing: "border-box",
            borderRadius: "8px",
            border: "1px solid #cbd5e1",
          },
          otpCodeFieldInputs: {
            gap: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          },
        },
      }}
    >
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
        >
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@graph": [
                  {
                    "@type": "Organization",
                    name: "MyoGuard Protocol",
                    legalName: "Meridian Wellness Systems LLC",
                    url: "https://myoguard.health",
                    logo: "https://myoguard.health/icon.svg",
                  },
                  {
                    "@type": "SoftwareApplication",
                    name: "MyoGuard Protocol",
                    applicationCategory: "HealthApplication",
                    operatingSystem: "Web",
                    creator: {
                      "@type": "Organization",
                      name: "Meridian Wellness Systems LLC",
                    },
                  },
                  {
                    "@type": "MedicalWebPage",
                    medicalAudience: {
                      "@type": "MedicalAudience",
                      audienceType: "Physician",
                    },
                    about: "GLP-1 muscle preservation",
                    mentions: {
                      "@type": "MedicalCondition",
                      name: "Sarcopenia Risk Index (SRI)",
                    },
                  },
                ],
              }),
            }}
          />
          <PostHogProvider>
            <div className="flex-1">{children}</div>
            <Footer />
          </PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}