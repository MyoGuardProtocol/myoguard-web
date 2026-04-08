import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import Footer from "@/src/components/ui/Footer";
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
title: "MyoGuard Protocol - GLP-1 Muscle Protection",
description:
"Physician-formulated GLP-1 muscle preservation protocol. Calculate personalised protein, fibre, and hydration targets to maintain muscle during therapy.",
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
          <div className="flex-1">{children}</div>
          <Footer />
        </body>
      </html>
    </ClerkProvider>
  );
}