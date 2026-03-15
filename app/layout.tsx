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
    <ClerkProvider publishableKey={clerkPublishableKey}>
      {body}
    </ClerkProvider>
  );
}
