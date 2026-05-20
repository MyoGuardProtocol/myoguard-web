"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";

type PatientInfo = {
  id:            string;
  fullName:      string;
  band:          string | null;
  score:         number | null;
  assessmentDate: string | null;
  alreadyLinked: boolean;
};

const BAND_COLOR: Record<string, string> = {
  CRITICAL: "#EF4444",
  HIGH:     "#F59E0B",
  MODERATE: "#3B82F6",
  LOW:      "#10B981",
};

export default function AcceptPatientPage() {
  const router  = useRouter();
  const { userId, isLoaded: authLoaded } = useAuth();

  const [invite,      setInvite]      = useState<string | null>(null);
  const [role,        setRole]        = useState<string | null | undefined>(undefined);
  const [patient,     setPatient]     = useState<PatientInfo | null>(null);
  const [loadError,   setLoadError]   = useState("");
  const [accepting,   setAccepting]   = useState(false);
  const [accepted,    setAccepted]    = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Parse invite token from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setInvite(params.get("invite"));
  }, []);

  // Fetch current role
  useEffect(() => {
    if (!userId) { setRole(null); return; }
    fetch("/api/auth/role")
      .then(r => r.json() as Promise<{ role: string | null }>)
      .then(d => setRole(d.role))
      .catch(() => setRole(null));
  }, [userId]);

  // Load patient info once we have both invite + role
  useEffect(() => {
    if (!invite || role === undefined) return;
    if (role !== "PHYSICIAN") return;

    fetch(`/api/doctor/patient-preview?invite=${encodeURIComponent(invite)}`)
      .then(r => r.json() as Promise<{ ok: boolean; patient?: PatientInfo; error?: string }>)
      .then(d => {
        if (d.ok && d.patient) {
          setPatient(d.patient);
          if (d.patient.alreadyLinked) setAccepted(true);
        } else {
          setLoadError(d.error ?? "Could not load patient information.");
        }
      })
      .catch(() => setLoadError("Network error loading patient information."));
  }, [invite, role]);

  async function handleAccept() {
    if (!invite) return;
    setAccepting(true);
    setSubmitError("");
    try {
      const res  = await fetch("/api/doctor/accept-patient", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ shareToken: invite }),
      });
      const json = await res.json() as { ok: boolean; error?: string };
      if (json.ok) {
        setAccepted(true);
      } else {
        setSubmitError(json.error ?? "Failed to accept patient. Please try again.");
      }
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setAccepting(false);
    }
  }

  // ── Guard: not loaded ──────────────────────────────────────────────────────
  if (!authLoaded || role === undefined) {
    return (
      <div style={{ background: "#080C14", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "20px", height: "20px", border: "2px solid #2DD4BF", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      </div>
    );
  }

  // ── Guard: not authenticated ───────────────────────────────────────────────
  if (!userId || !role) {
    if (typeof window !== "undefined") {
      const dest = invite ? `/doctor/sign-in?invite=${invite}` : "/doctor/sign-in";
      window.location.replace(dest);
    }
    return null;
  }

  // ── Guard: PHYSICIAN_PENDING ───────────────────────────────────────────────
  if (role === "PHYSICIAN_PENDING") {
    return (
      <main style={{ background: "#080C14", minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ maxWidth: "480px", width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <span style={{ fontSize: "20px", fontWeight: 900, color: "#F8FAFC", letterSpacing: "-0.03em" }}>
              Myo<span style={{ color: "#2DD4BF" }}>Guard</span>
            </span>
          </div>
          <div style={{ background: "#0D1421", border: "1px solid #1A2744", borderRadius: "20px", padding: "36px 32px", display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#F59E0B" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div style={{ textAlign: "center" }}>
              <h1 style={{ fontFamily: "Georgia, serif", fontSize: "20px", fontWeight: 400, color: "#F1F5F9", marginBottom: "8px" }}>
                Invitation saved
              </h1>
              <p style={{ fontSize: "14px", color: "#94A3B8", lineHeight: "1.6" }}>
                Your account is currently under clinical review. Once approved, this
                patient invitation will be waiting for you in your Clinical Command Center.
              </p>
            </div>
            <div style={{ background: "#060D1E", border: "1px solid #1A2744", borderRadius: "12px", padding: "14px 16px" }}>
              <p style={{ fontSize: "12px", color: "#475569", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>What happens next</p>
              <p style={{ fontSize: "13px", color: "#64748B", lineHeight: "1.6" }}>
                After your credentials are verified, sign in to accept the patient and
                view their Sarcopenia Risk Index (SRI) report in your Clinical Command Center.
              </p>
            </div>
            <Link
              href="/doctor/dashboard"
              style={{ display: "block", textAlign: "center", background: "#2DD4BF", color: "#080C14", padding: "12px", borderRadius: "12px", fontSize: "14px", fontWeight: 700, textDecoration: "none" }}
            >
              Go to my dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ── Guard: wrong role ──────────────────────────────────────────────────────
  if (role !== "PHYSICIAN") {
    return (
      <main style={{ background: "#080C14", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ maxWidth: "400px", textAlign: "center" }}>
          <p style={{ color: "#94A3B8", fontSize: "14px", marginBottom: "16px" }}>
            Physician account required to accept patient invitations.
          </p>
          <Link href="/doctor/sign-in" style={{ color: "#2DD4BF", fontSize: "13px" }}>
            Sign in as physician →
          </Link>
        </div>
      </main>
    );
  }

  // ── No invite token ────────────────────────────────────────────────────────
  if (!invite) {
    return (
      <main style={{ background: "#080C14", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ maxWidth: "400px", textAlign: "center" }}>
          <p style={{ color: "#94A3B8", fontSize: "14px", marginBottom: "16px" }}>No invitation token found.</p>
          <Link href="/doctor/patients" style={{ color: "#2DD4BF", fontSize: "13px" }}>← Back to patients</Link>
        </div>
      </main>
    );
  }

  // ── Main acceptance UI ─────────────────────────────────────────────────────
  const bandColor = patient?.band ? (BAND_COLOR[patient.band] ?? "#94A3B8") : "#94A3B8";

  return (
    <main style={{ background: "#080C14", minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <header style={{ background: "#060D1E", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "0 24px" }}>
        <div style={{ maxWidth: "600px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: "56px" }}>
          <Link href="/" style={{ textDecoration: "none", fontSize: "18px", fontWeight: 900, color: "#F8FAFC", letterSpacing: "-0.03em" }}>
            Myo<span style={{ color: "#2DD4BF" }}>Guard</span>
          </Link>
          <Link href="/doctor/patients" style={{ fontSize: "13px", color: "#94A3B8", textDecoration: "none" }}>
            ← Back to patients
          </Link>
        </div>
      </header>

      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "48px 24px" }}>

        {/* Load error */}
        {loadError && (
          <div style={{ background: "#1a0a0a", border: "1px solid #7f1d1d", borderRadius: "12px", padding: "16px", marginBottom: "24px" }}>
            <p style={{ fontSize: "14px", color: "#fca5a5" }}>{loadError}</p>
          </div>
        )}

        {/* Loading patient */}
        {!patient && !loadError && (
          <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}>
            <div style={{ width: "20px", height: "20px", border: "2px solid #2DD4BF", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          </div>
        )}

        {/* Accepted state */}
        {accepted && (
          <div style={{ background: "#0D1421", border: "1px solid #1A2744", borderRadius: "20px", padding: "40px 32px", textAlign: "center", display: "flex", flexDirection: "column", gap: "20px", alignItems: "center" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "rgba(45,212,191,0.08)", border: "1px solid rgba(45,212,191,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#2DD4BF" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: 400, color: "#F1F5F9", marginBottom: "8px" }}>
                {patient?.fullName ?? "Patient"} added to your panel
              </h1>
              <p style={{ fontSize: "14px", color: "#94A3B8", lineHeight: "1.6" }}>
                This patient&apos;s Sarcopenia Risk Index (SRI) data and longitudinal trends are now
                accessible from your Clinical Command Center.
              </p>
            </div>
            <p style={{ fontSize: "11px", color: "#475569", lineHeight: "1.6" }}>
              MyoGuard Protocol · Physician-led Clinical Decision Support · All clinical decisions remain with the treating physician.
            </p>
            <Link
              href="/doctor/patients"
              style={{ background: "#2DD4BF", color: "#080C14", padding: "12px 28px", borderRadius: "12px", fontSize: "14px", fontWeight: 700, textDecoration: "none" }}
            >
              View Clinical Command Center
            </Link>
          </div>
        )}

        {/* Acceptance card */}
        {patient && !accepted && (
          <div style={{ background: "#0D1421", border: "1px solid #1A2744", borderRadius: "20px", padding: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>

            <div>
              <p style={{ fontSize: "10px", fontWeight: 700, color: "#2DD4BF", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "8px" }}>
                Patient Invitation
              </p>
              <h1 style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: 400, color: "#F1F5F9", marginBottom: "8px", lineHeight: "1.3" }}>
                Accept {patient.fullName} to your panel
              </h1>
              <p style={{ fontSize: "14px", color: "#94A3B8", lineHeight: "1.6" }}>
                This patient has shared their MyoGuard Protocol report with you. Accepting will
                add them to your Clinical Command Center for longitudinal SRI monitoring.
              </p>
            </div>

            {/* Patient summary */}
            <div style={{ background: "#060D1E", border: "1px solid #1A2744", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <p style={{ fontSize: "11px", fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Patient Summary
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", gap: "12px", fontSize: "13px" }}>
                  <span style={{ color: "#475569", width: "80px", flexShrink: 0 }}>Name</span>
                  <span style={{ color: "#F1F5F9", fontWeight: 600 }}>{patient.fullName}</span>
                </div>
                {patient.band && (
                  <div style={{ display: "flex", gap: "12px", fontSize: "13px", alignItems: "center" }}>
                    <span style={{ color: "#475569", width: "80px", flexShrink: 0 }}>Risk Band</span>
                    <span style={{ color: bandColor, fontWeight: 600 }}>{patient.band}</span>
                  </div>
                )}
                {patient.score !== null && (
                  <div style={{ display: "flex", gap: "12px", fontSize: "13px" }}>
                    <span style={{ color: "#475569", width: "80px", flexShrink: 0 }}>SRI</span>
                    <span style={{ color: "#94A3B8" }}>{Math.round(patient.score)}/100</span>
                  </div>
                )}
                {patient.assessmentDate && (
                  <div style={{ display: "flex", gap: "12px", fontSize: "13px" }}>
                    <span style={{ color: "#475569", width: "80px", flexShrink: 0 }}>Assessed</span>
                    <span style={{ color: "#94A3B8" }}>
                      {new Date(patient.assessmentDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* CDS disclaimer */}
            <p style={{ fontSize: "11px", color: "#334155", lineHeight: "1.6" }}>
              MyoGuard Protocol is a Physician-led Clinical Decision Support (CDS) platform. All clinical
              decisions remain with the treating physician. Acceptance adds the patient to your monitoring panel only.
            </p>

            {submitError && (
              <div style={{ background: "#1a0a0a", border: "1px solid #7f1d1d", borderRadius: "8px", padding: "12px" }}>
                <p style={{ fontSize: "13px", color: "#fca5a5" }}>{submitError}</p>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={handleAccept}
                disabled={accepting}
                style={{
                  flex: 1, background: "#2DD4BF", color: "#080C14",
                  padding: "13px", borderRadius: "12px", fontSize: "14px",
                  fontWeight: 700, border: "none", cursor: accepting ? "not-allowed" : "pointer",
                  opacity: accepting ? 0.6 : 1,
                }}
              >
                {accepting ? "Accepting…" : "Accept Patient"}
              </button>
              <Link
                href="/doctor/patients"
                style={{
                  flex: 1, background: "transparent", color: "#94A3B8",
                  padding: "13px", borderRadius: "12px", fontSize: "14px",
                  fontWeight: 600, border: "1px solid #1A2744", textDecoration: "none",
                  textAlign: "center",
                }}
              >
                Decline
              </Link>
            </div>

          </div>
        )}

      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}
