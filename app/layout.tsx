import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MyoGuard Protocol",
  description: "Physician-Formulated Muscle Protection for GLP-1 Patients",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ClerkProvider publishableKey="pk_live_Y2xlcmsubXlvZ3VhcmQuaGVhbHRoJA">
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
