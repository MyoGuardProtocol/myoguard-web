"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";
import PhysicianBoundary from "@/src/components/ui/PhysicianBoundary";

const SPECIALTIES = [
  "Internal Medicine",
  "Endocrinology",
  "Family Medicine",
  "Bariatric Medicine",
  "Obesity Medicine",
  "Sports Medicine",
  "Cardiology",
  "Nephrology",
  "General Practice",
  "Geriatrics",
  "Physical Medicine & Rehabilitation",
  "Orthopedic Surgery",
  "Neurology",
  "Oncology",
  "Other",
];

const COUNTRIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Spain",
  "Italy",
  "Netherlands",
  "Sweden",
  "Norway",
  "Denmark",
  "Switzerland",
  "Belgium",
  "Austria",
  "Japan",
  "South Korea",
  "Singapore",
  "UAE",
  "Saudi Arabia",
  "Israel",
  "Brazil",
  "Mexico",
  "Argentina",
  "Colombia",
  "Chile",
  "South Africa",
  "Nigeria",
  "Ghana",
  "Kenya",
  "India",
  "Pakistan",
  "Bangladesh",
  "New Zealand",
  "Ireland",
  "Portugal",
  "Greece",
  "Poland",
  "Czech Republic",
  "Hungary",
  "Romania",
  "Turkey",
  "Malaysia",
  "Indonesia",
  "Philippines",
  "Thailand",
  "Vietnam",
  "Trinidad and Tobago",
  "Jamaica",
  "Barbados",
  "Guyana",
  "Bahamas",
  "Haiti",
  "Dominican Republic",
  "Other",
];

type NpiStatus = "idle" | "loading" | "verified" | "not_found";

export default function PhysicianSignUpPage() {
  const router = useRouter();
  const { userId } = useAuth();
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();

  // invite token from URL — read once on mount
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  // DB role of the currently authenticated Clerk session — undefined = not yet fetched
  const [sessionRole, setSessionRole] = useState<string | null | undefined>(undefined);

  // Detect invite token from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setInviteToken(params.get("invite"));
  }, []);

  // Fetch DB role to detect patient-session contamination
  useEffect(() => {
    if (!userId) { setSessionRole(null); return; }
    fetch("/api/auth/role")
      .then(r => r.json() as Promise<{ role: string | null }>)
      .then(d => setSessionRole(d.role))
      .catch(() => setSessionRole(null));
  }, [userId]);

  // A PATIENT session must never be used as physician identity
  const isPatientSession = sessionRole === "PATIENT";

  // Only treat as pre-authenticated if the session belongs to a non-patient
  const isPreAuth = !!userId && !isPatientSession;

  const [form, setForm] = useState({
    fullName:      "",
    email:         "",
    password:      "",
    npi:           "",
    specialty:     "",
    country:       "",
    licenseNumber: "",
  });
  const [showPassword, setShowPassword]                    = useState(false);
  const [internationalProvider, setInternationalProvider]  = useState(false);
  const [npiStatus, setNpiStatus]                          = useState<NpiStatus>("idle");
  const [npisSpecialty, setNpisSpecialty]                  = useState("");
  const [loading, setLoading]                              = useState(false);
  const [error, setError]                                  = useState("");
  const npiLookupRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-fill email from Clerk session — only for non-patient pre-auth sessions
  useEffect(() => {
    if (isPreAuth && !isPatientSession && clerkLoaded && clerkUser) {
      const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
      if (email) setForm(prev => ({ ...prev, email }));
    }
  }, [isPreAuth, isPatientSession, clerkLoaded, clerkUser]);

  // NPPES auto-lookup when NPI reaches 10 digits
  useEffect(() => {
    if (internationalProvider) return;
    const npi = form.npi.replace(/\D/g, "");
    if (npi.length !== 10) {
      if (npi.length > 0) setNpiStatus("idle");
      return;
    }

    if (npiLookupRef.current) clearTimeout(npiLookupRef.current);
    npiLookupRef.current = setTimeout(async () => {
      setNpiStatus("loading");
      try {
        const res  = await fetch(`https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`);
        const data = await res.json() as {
          result_count: number;
          results?: Array<{ taxonomies?: Array<{ desc: string }> }>;
        };
        if (data.result_count > 0 && data.results?.[0]?.taxonomies?.[0]?.desc) {
          const desc = data.results[0].taxonomies[0].desc;
          setNpisSpecialty(desc);
          setForm(prev => ({ ...prev, specialty: desc }));
          setNpiStatus("verified");
        } else {
          setNpiStatus("not_found");
        }
      } catch {
        setNpiStatus("not_found");
      }
    }, 400);

    return () => {
      if (npiLookupRef.current) clearTimeout(npiLookupRef.current);
    };
  }, [form.npi, internationalProvider]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    if (name === "npi") {
      const digits = value.replace(/\D/g, "").slice(0, 10);
      setForm(prev => ({ ...prev, npi: digits }));
      if (digits.length < 10) {
        setNpiStatus("idle");
        setNpisSpecialty("");
      }
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError("");

    if (!form.fullName.trim() || form.fullName.trim().length < 2) {
      setError("Full name is required.");
      return;
    }
    if (!form.email || !form.email.includes("@")) {
      setError("A valid email address is required.");
      return;
    }
    // Password only required when creating a new Clerk account
    if (!isPreAuth && (!form.password || form.password.length < 8)) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!form.specialty) {
      setError("Please select a specialty.");
      return;
    }
    if (!form.country) {
      setError("Please select a country.");
      return;
    }

    setLoading(true);
    try {
      // Authenticated users complete their profile via /api/doctor/onboarding
      // (no Clerk account creation needed — session already exists).
      // Unauthenticated users go through /api/doctor/register which creates
      // the Clerk account and DB row in one step.
      const endpoint = isPreAuth ? "/api/doctor/onboarding" : "/api/doctor/register";

      const payload = isPreAuth
        ? {
            fullName:      form.fullName.trim(),
            email:         form.email.trim().toLowerCase(),
            country:       form.country,
            specialty:     form.specialty,
            npiNumber:     !internationalProvider && form.npi     ? form.npi           : undefined,
            licenseNumber: form.licenseNumber                     ? form.licenseNumber : undefined,
            inviteToken:   inviteToken                            ? inviteToken         : undefined,
          }
        : {
            fullName:      form.fullName.trim(),
            email:         form.email.trim().toLowerCase(),
            password:      form.password,
            country:       form.country,
            specialty:     form.specialty,
            npiNumber:     !internationalProvider && form.npi     ? form.npi           : undefined,
            licenseNumber: form.licenseNumber                     ? form.licenseNumber : undefined,
          };

      const res = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });

      const json = await res.json() as { ok: boolean; error?: string; detail?: string };

      if (!res.ok || !json.ok) {
        const msg = json.error ?? "Registration failed. Please try again.";
        setError(json.detail ? `${msg} — ${json.detail}` : msg);
        return;
      }

      const dest = inviteToken
        ? `/doctor/onboarding/pending?invite=${inviteToken}`
        : "/doctor/onboarding/pending";
      router.push(dest);
    } catch (e: unknown) {
      setError(`Network error: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  const specialtyOptions = npisSpecialty && !SPECIALTIES.includes(npisSpecialty)
    ? [npisSpecialty, ...SPECIALTIES]
    : SPECIALTIES;

  // Brief loading state while Clerk and role check resolve
  if (!clerkLoaded || (userId && sessionRole === undefined)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Hard boundary — PATIENT sessions must never see the physician registration form
  if (isPatientSession) {
    const dest = inviteToken ? `/doctor/sign-up?invite=${inviteToken}` : '/doctor/sign-up';
    return <PhysicianBoundary redirectTo={dest} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: '#080C14' }}>
      <div className="w-full max-w-lg">

        {/* Logo + badge */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex items-center gap-0">
            <span style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em', color: '#F8FAFC' }}>Myo</span>
            <span style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em', color: '#2DD4BF' }}>Guard</span>
            <span style={{ color: '#475569', fontWeight: 300, fontSize: '13px', marginLeft: '4px' }}>Protocol</span>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.2)', color: '#2DD4BF', fontSize: '11px', fontWeight: 600, padding: '4px 12px', borderRadius: '99px', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
            Physician Registration
          </span>
          <span style={{ fontSize: '12px', color: '#475569' }}>Physician-led Clinical Decision Support</span>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8" style={{ background: '#0D1421', border: '1px solid #1A2744' }}>

          <div className="mb-6">
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 400, color: '#F1F5F9', marginBottom: '6px' }}>
              {isPreAuth ? "Complete Your Physician Profile" : "Physician Credential Registration"}
            </h1>
            <p style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.6', marginBottom: '8px' }}>
              {isPreAuth
                ? "You're already signed in. Complete your credentials below to submit for clinical review."
                : "Complete your registration to access the MyoGuard Protocol platform. Your credentials will be reviewed within 24 hours."}
            </p>
            <p style={{ fontSize: '12px', color: '#334155', lineHeight: '1.5' }}>
              MyoGuard Protocol is a Clinical Decision Support (CDS) platform. All clinical decisions remain with the treating physician.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>

            {/* Full name */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-300">
                Full name <span className="text-red-400">*</span>
              </span>
              <input
                name="fullName"
                type="text"
                placeholder="Dr. Jane Smith"
                value={form.fullName}
                onChange={handleChange}
                required
                autoComplete="name"
                className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
              />
            </label>

            {/* Professional email — locked when pre-authenticated */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-300">
                Professional email <span className="text-red-400">*</span>
              </span>
              <input
                name="email"
                type="email"
                placeholder="you@hospital.org"
                value={form.email}
                onChange={handleChange}
                required
                autoComplete="email"
                readOnly={isPreAuth}
                disabled={isPreAuth}
                className={`bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors ${
                  isPreAuth ? "text-slate-400 opacity-70 cursor-not-allowed" : "text-white"
                }`}
              />
              {isPreAuth && (
                <p className="text-xs text-slate-500">From your verified sign-in account</p>
              )}
            </label>

            {/* Password — only shown when creating a new account */}
            {!isPreAuth && (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-slate-300">
                  Password <span className="text-red-400">*</span>
                </span>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Minimum 8 characters"
                    value={form.password}
                    onChange={handleChange}
                    required
                    autoComplete="new-password"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </label>
            )}

            {/* International provider toggle */}
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-xs font-medium text-slate-300">International provider</p>
                <p className="text-xs text-slate-500 mt-0.5">Outside the US — use licence number instead of NPI</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setInternationalProvider(v => !v);
                  setNpiStatus("idle");
                  setNpisSpecialty("");
                  setForm(prev => ({ ...prev, npi: "" }));
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ${
                  internationalProvider ? "bg-teal-600" : "bg-slate-600"
                }`}
                aria-pressed={internationalProvider}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    internationalProvider ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* NPI — shown when not international */}
            {!internationalProvider && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">
                    NPI number <span className="text-slate-500 font-normal">(optional — US physicians)</span>
                  </span>
                  {npiStatus === "verified" && (
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Verified via NPPES
                    </span>
                  )}
                  {npiStatus === "not_found" && (
                    <span className="text-xs font-semibold text-red-400">NPI not found</span>
                  )}
                  {npiStatus === "loading" && (
                    <span className="text-xs text-slate-400">Looking up…</span>
                  )}
                </div>
                <input
                  name="npi"
                  type="text"
                  inputMode="numeric"
                  placeholder="10-digit NPI number"
                  value={form.npi}
                  onChange={handleChange}
                  maxLength={10}
                  className={`bg-slate-800 border rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-colors ${
                    npiStatus === "verified"
                      ? "border-emerald-500 focus:ring-emerald-500 bg-emerald-950"
                      : npiStatus === "not_found"
                      ? "border-red-500 focus:ring-red-500"
                      : "border-slate-600 focus:ring-teal-500 focus:border-transparent"
                  }`}
                />
              </div>
            )}

            {/* National licence number — shown when international */}
            {internationalProvider && (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-slate-300">
                  National licence number <span className="text-slate-500 font-normal">(optional)</span>
                </span>
                <input
                  name="licenseNumber"
                  type="text"
                  placeholder="e.g. TT-MED-12345"
                  value={form.licenseNumber}
                  onChange={handleChange}
                  className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                />
              </label>
            )}

            {/* Specialty */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-300">
                Specialty <span className="text-red-400">*</span>
              </span>
              <select
                name="specialty"
                value={form.specialty}
                onChange={handleChange}
                required
                className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
              >
                <option value="">Select specialty</option>
                {specialtyOptions.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {npiStatus === "verified" && (
                <p className="text-xs text-emerald-400">Auto-filled from NPI registry</p>
              )}
            </label>

            {/* Country */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-300">
                Country <span className="text-red-400">*</span>
              </span>
              <select
                name="country"
                value={form.country}
                onChange={handleChange}
                required
                className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
              >
                <option value="">Select country</option>
                {COUNTRIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>

            {/* Medical licence number */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-300">
                Medical licence number <span className="text-slate-500 font-normal">(optional)</span>
              </span>
              <input
                name="licenseNumber"
                type="text"
                placeholder="e.g. TX-MD-123456"
                value={internationalProvider ? "" : form.licenseNumber}
                onChange={handleChange}
                disabled={internationalProvider}
                className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </label>

            {/* Error */}
            {error && (
              <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-500 hover:bg-teal-400 text-white py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-1"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Submitting…
                </span>
              ) : (
                "Submit for Clinical Review"
              )}
            </button>

          </form>

          {/* Footer links */}
          <div className="mt-6 pt-5 flex flex-col items-center gap-2" style={{ borderTop: '1px solid #1A2744' }}>
            <Link href="/doctor/sign-in" style={{ fontSize: '13px', color: '#64748B', textDecoration: 'none' }}>
              Already approved? Sign in →
            </Link>
            <Link href="/" style={{ fontSize: '13px', color: '#475569', textDecoration: 'none' }}>
              Patient? Start your free assessment →
            </Link>
            <p style={{ fontSize: '12px', color: '#334155', marginTop: '4px' }}>
              Questions?{" "}
              <a href="mailto:support@myoguard.health" style={{ color: '#2DD4BF', textDecoration: 'none' }}>
                support@myoguard.health
              </a>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
