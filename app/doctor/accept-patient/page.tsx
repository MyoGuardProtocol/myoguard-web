"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type PatientInfo = {
  id:             string;
  fullName:       string;
  band:           string | null;
  score:          number | null;
  assessmentDate: string | null;
  alreadyLinked:  boolean;
};

const BAND_COLOR: Record<string, string> = {
  CRITICAL: "#EF4444",
  HIGH:     "#F59E0B",
  MODERATE: "#3B82F6",
  LOW:      "#10B981",
};

function FullPageSpinner({ message }: { message: string }) {
  return (
    <main style={{
      background: "#080C14", minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: "16px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        width: "24px", height: "24px",
        border: "2px solid #2DD4BF", borderTopColor: "transparent",
        borderRadius: "50%", animation: "spin 0.7s linear infinite",
      }} />
      <p style={{ fontSize: "13px", color: "#64748B", margin: 0 }}>{message}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

// ── Inner component — uses useSearchParams (requires Suspense above) ──────────

function AcceptPatientPageInner() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const invite      = searchParams.get("invite"); // stable, synchronous on first render

  const { userId, isLoaded: authLoaded } = useAuth();

  const [role,        setRole]        = useState<string | null | undefined>(undefined);
  const [roleError,   setRoleError]   = useState(false);
  const [retryCount,  setRetryCount]  = useState(0);
  const [patient,     setPatient]     = useState<PatientInfo | null>(null);
  const [loadError,   setLoadError]   = useState("");
  const [accepting,   setAccepting]   = useState(false);
  const [accepted,    setAccepted]    = useState(false);
  const [submitError, setSubmitError] = useState("");

  const redirectFired  = useRef(false);
  const previewFetched = useRef(false);

  // ── Fetch role once — retryCount allows manual retry on transient failure ──
  useEffect(() => {
    if (!authLoaded) return;
    if (!userId) { setRole(null); return; }
    setRoleError(false);
    fetch("/api/auth/role")
      .then(r => r.json() as Promise<{ role: string | null }>)
      .then(d => setRole(d.role ?? null))
      .catch(() => {
        setRoleError(true);
        setRole(null);
      });
  }, [authLoaded, userId, retryCount]);

  // ── Redirect unauthenticated users — exactly once, in useEffect only ───────
  // Never called from render body. redirectFired ref prevents loop.
  useEffect(() => {
    if (!authLoaded || role === undefined) return; // still resolving
    if (roleError) return;                         // error state — show retry card, no redirect
    if (userId && role) return;                    // authenticated — no redirect needed
    if (redirectFired.current) return;             // already redirected once

    redirectFired.current = true;
    const dest = invite ? `/doctor/sign-in?invite=${invite}` : "/doctor/sign-in";
    router.replace(dest);
  }, [authLoaded, userId, role, roleError, invite, router]);

  // ── Load patient preview — exactly once per invite token ───────────────────
  useEffect(() => {
    if (!invite || role !== "PHYSICIAN" || previewFetched.current) return;
    previewFetched.current = true;

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

  // ── Auto-redirect to CCC 1.5 s after successful accept ─────────────────────
  useEffect(() => {
    if (!accepted) return;
    const t = setTimeout(() => router.replace("/doctor/patients"), 1500);
    return () => clearTimeout(t);
  }, [accepted, router]);

  async function handleAccept() {
    if (!invite || accepting) return;
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
        setAccepted(true); // auto-redirect fires via useEffect above
      } else {
        setSubmitError(json.error ?? "Failed to accept patient. Please try again.");
        setAccepting(false);
      }
    } catch {
      setSubmitError("Network error. Please try again.");
      setAccepting(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Stable render states — never blank, never null
  // ═══════════════════════════════════════════════════════════════════════════

  // 1. Auth / role still resolving
  if (!authLoaded || role === undefined) {
    return <FullPageSpinner message="Loading patient invitation…" />;
  }

  // 2. Role fetch failed — stable error card with retry (no redirect loop)
  if (roleError) {
    return (
      <main style={{
        background: "#080C14", minHeight: "100vh",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}>
        <div style={{ maxWidth: "400px", width: "100%" }}>
          <div style={{
            background: "#0D1421", border: "1px solid #1A2744",
            borderRadius: "16px", padding: "32px 24px",
            display: "flex", flexDirection: "column", gap: "16px", alignItems: "center", textAlign: "center",
          }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "50%",
              background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#F59E0B" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: "15px", fontWeight: 600, color: "#F1F5F9", marginBottom: "6px", fontFamily: "Georgia, serif" }}>
                Unable to verify credentials
              </p>
              <p style={{ fontSize: "13px", color: "#64748B", lineHeight: "1.6" }}>
                A temporary error occurred while loading your account. Please try again.
              </p>
            </div>
            <button
              onClick={() => { setRoleError(false); setRole(undefined); setRetryCount(c => c + 1); }}
              style={{
                background: "#2DD4BF", color: "#080C14",
                padding: "10px 24px", borderRadius: "10px",
                fontSize: "13px", fontWeight: 700, border: "none", cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </main>
    );
  }

  // 3. No invite token — stable invalid invitation page
  if (!invite) {
    return (
      <main style={{
        background: "#080C14", minHeight: "100vh",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}>
        <div style={{ maxWidth: "400px", width: "100%", textAlign: "center" }}>
          <div style={{
            background: "#0D1421", border: "1px solid #1A2744",
            borderRadius: "16px", padding: "32px 24px",
            display: "flex", flexDirection: "column", gap: "16px", alignItems: "center",
          }}>
            <p style={{ fontSize: "15px", fontWeight: 600, color: "#F1F5F9", fontFamily: "Georgia, serif" }}>
              No invitation found
            </p>
            <p style={{ fontSize: "13px", color: "#64748B", lineHeight: "1.6" }}>
              This link does not contain a valid invitation token. Ask your patient to reshare their report.
            </p>
            <Link href="/doctor/patients" style={{ color: "#2DD4BF", fontSize: "13px", textDecoration: "none" }}>
              ← Back to patients
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 4. Unauthenticated — redirect fires exactly once in useEffect above
  if (!userId || !role) {
    return <FullPageSpinner message="Redirecting to sign in…" />;
  }

  // 5. PHYSICIAN_PENDING
  if (role === "PHYSICIAN_PENDING") {
    return (
      <main style={{
        background: "#080C14", minHeight: "100vh",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
      }}>
        <div style={{ maxWidth: "480px", width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <span style={{ fontSize: "20px", fontWeight: 900, color: "#F8FAFC", letterSpacing: "-0.03em" }}>
              Myo<span style={{ color: "#2DD4BF" }}>Guard</span>
            </span>
          </div>
          <div style={{
            background: "#0D1421", border: "1px solid #1A2744",
            borderRadius: "20px", padding: "36px 32px",
            display: "flex", flexDirection: "column", gap: "20px",
          }}>
            <div style={{
              width: "56px", height: "56px", borderRadius: "50%",
              background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto",
            }}>
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
              <p style={{ fontSize: "12px", color: "#475569", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>
                What happens next
              </p>
              <p style={{ fontSize: "13px", color: "#64748B", lineHeight: "1.6" }}>
                After your credentials are verified, sign in to accept the patient and
                view their Sarcopenia Risk Index (SRI) report in your Clinical Command Center.
              </p>
            </div>
            <Link
              href="/doctor/dashboard"
              style={{
                display: "block", textAlign: "center",
                background: "#2DD4BF", color: "#080C14",
                padding: "12px", borderRadius: "12px",
                fontSize: "14px", fontWeight: 700, textDecoration: "none",
              }}
            >
              Go to my dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 6. PATIENT role — physician-only boundary
  if (role === "PATIENT") {
    return (
      <main style={{
        background: "#080C14", minHeight: "100vh",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}>
        <div style={{ maxWidth: "400px", width: "100%" }}>
          <div style={{
            background: "#0D1421", border: "1px solid #1A2744",
            borderRadius: "16px", padding: "32px 24px",
            display: "flex", flexDirection: "column", gap: "16px", alignItems: "center", textAlign: "center",
          }}>
            <p style={{ fontSize: "15px", fontWeight: 600, color: "#F1F5F9", fontFamily: "Georgia, serif" }}>
              Physician account required
            </p>
            <p style={{ fontSize: "13px", color: "#64748B", lineHeight: "1.6" }}>
              This invitation link is for physicians only. You are currently signed in as a patient.
              Please sign in with your physician credentials to continue.
            </p>
            <Link
              href="/doctor/sign-in"
              style={{
                background: "#2DD4BF", color: "#080C14",
                padding: "10px 24px", borderRadius: "10px",
                fontSize: "13px", fontWeight: 700, textDecoration: "none",
              }}
            >
              Sign in as physician →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 7. Other unknown role
  if (role !== "PHYSICIAN") {
    return (
      <main style={{
        background: "#080C14", minHeight: "100vh",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}>
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

  // ═══════════════════════════════════════════════════════════════════════════
  // PHYSICIAN main UI
  // ═══════════════════════════════════════════════════════════════════════════

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

        {/* Stable error card — no loop */}
        {loadError && (
          <div style={{
            background: "#0D1421", border: "1px solid #7f1d1d",
            borderRadius: "16px", padding: "24px",
            display: "flex", flexDirection: "column", gap: "16px", alignItems: "center", textAlign: "center",
          }}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#F87171" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <div>
              <p style={{ fontSize: "15px", fontWeight: 600, color: "#F1F5F9", fontFamily: "Georgia, serif", marginBottom: "6px" }}>
                Unable to load invitation
              </p>
              <p style={{ fontSize: "13px", color: "#fca5a5" }}>{loadError}</p>
            </div>
            <Link href="/doctor/patients" style={{ color: "#2DD4BF", fontSize: "13px", textDecoration: "none" }}>
              ← Back to patients
            </Link>
          </div>
        )}

        {/* Stable loading — with message, no blank screen */}
        {!patient && !loadError && !accepted && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", padding: "64px 0" }}>
            <div style={{
              width: "24px", height: "24px",
              border: "2px solid #2DD4BF", borderTopColor: "transparent",
              borderRadius: "50%", animation: "spin 0.7s linear infinite",
            }} />
            <p style={{ fontSize: "13px", color: "#64748B", margin: 0 }}>Loading patient invitation…</p>
          </div>
        )}

        {/* Accepted — auto-redirect in progress */}
        {accepted && (
          <div style={{
            background: "#0D1421", border: "1px solid #1A2744",
            borderRadius: "20px", padding: "40px 32px", textAlign: "center",
            display: "flex", flexDirection: "column", gap: "20px", alignItems: "center",
          }}>
            <div style={{
              width: "56px", height: "56px", borderRadius: "50%",
              background: "rgba(45,212,191,0.08)", border: "1px solid rgba(45,212,191,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#2DD4BF" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: 400, color: "#F1F5F9", marginBottom: "8px" }}>
                {patient?.fullName ?? "Patient"} added to your panel
              </h1>
              <p style={{ fontSize: "14px", color: "#94A3B8", lineHeight: "1.6" }}>
                Redirecting to your Clinical Command Center…
              </p>
            </div>
            <div style={{
              width: "20px", height: "20px",
              border: "2px solid #2DD4BF", borderTopColor: "transparent",
              borderRadius: "50%", animation: "spin 0.7s linear infinite",
            }} />
            <p style={{ fontSize: "11px", color: "#475569", lineHeight: "1.6" }}>
              MyoGuard Protocol · Physician-led Clinical Decision Support · All clinical decisions remain with the treating physician.
            </p>
          </div>
        )}

        {/* Acceptance card */}
        {patient && !accepted && (
          <div style={{
            background: "#0D1421", border: "1px solid #1A2744",
            borderRadius: "20px", padding: "32px",
            display: "flex", flexDirection: "column", gap: "24px",
          }}>

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

// ── Page export: Suspense boundary required for useSearchParams ───────────────
export default function AcceptPatientPage() {
  return (
    <Suspense fallback={<FullPageSpinner message="Loading patient invitation…" />}>
      <AcceptPatientPageInner />
    </Suspense>
  );
}
