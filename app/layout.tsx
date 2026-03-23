import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
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
  title: "MyoGuard Protocol — GLP-1 Muscle Protection",
  description:
    "Physician-formulated GLP-1 muscle preservation protocol. Calculate personalised protein, fibre, and hydration targets to maintain lean mass during GLP-1 therapy.",
};

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const body = (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );

  // ClerkProvider requires a valid publishableKey at render time.
  // When keys are not configured (local dev / CI without secrets),
  // render without the provider so the public calculator still works.
  if (!clerkPublishableKey) {
    return body;
  }

  return (
    /*
     * signInUrl / signUpUrl are set explicitly here (in addition to the
     * NEXT_PUBLIC_CLERK_SIGN_IN_URL / SIGN_UP_URL env vars) so that Clerk's
     * provider-level navigation config is unambiguous.  Without these props
     * Clerk relies solely on env var hydration timing, which can be late on
     * the client and cause the widget to loop instead of navigating.
     */
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      signInUrl="/sign-in-new"
      signUpUrl="/sign-up-new"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      appearance={{
        elements: {
          /*
           * otpCodeFieldInput — the actual <input> for each OTP digit.
           *
           * These styles are injected by Clerk's appearance API as high-
           * priority CSS on the .cl-otpCodeFieldInput class.  They complement
           * the CSS reset in globals.css that restores appearance:auto and
           * background:transparent — the appearance API handles visual polish
           * (font size, border, radius) while globals.css handles the CSS
           * cascade fights with Tailwind preflight.
           *
           * DO NOT set `appearance` here — it has no effect via this API and
           * must be controlled through CSS (globals.css) instead.
           *
           * DO NOT set width/height — Clerk's own sx system sets each box to
           * t.space.$10 × t.space.$10 (~40px²) via generated CSS classes.
           * Overriding them here without a sizing parent causes the digit
           * boxes to collapse or overflow.
           */
          otpCodeFieldInput: {
            fontSize:     '20px',
            textAlign:    'center',
            borderRadius: '8px',
            border:       '1px solid #cbd5e1', /* slate-300 */
          },
        },
      }}
    >
      {body}
    </ClerkProvider>
  );
}
