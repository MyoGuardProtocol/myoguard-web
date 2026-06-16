"use client";
import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { isAnalyticsEnabled, AnalyticsEvents } from "@/src/lib/posthog";

const SPECIALTY_SUGGESTIONS = [
  "Internal Medicine",
  "Endocrinology",
  "Family Medicine",
  "Bariatric Medicine",
  "Obesity Medicine",
  "Sports Medicine",
  "Cardiology",
  "Nephrology",
  "General Practice",
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

export default function OnboardingForm() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    country: "",
    specialty: "",
    npi: "",
    license: "",
  });
  const [internationalProvider, setInternationalProvider] = useState(false);
  const [npiStatus, setNpiStatus] = useState<NpiStatus>("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const npiLookupRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-fill full name from Clerk when it becomes available.
  // Non-blocking — form renders immediately; name fills in when Clerk hydrates.
  // Does not overwrite if the physician has already started typing.
  useEffect(() => {
    if (isLoaded && user?.fullName && !form.fullName) {
      setForm(prev => ({ ...prev, fullName: user.fullName! }));
    }
  }, [isLoaded, user?.fullName]); // eslint-disable-line react-hooks/exhaustive-deps

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
        const res = await fetch(
          `https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`
        );
        const data = await res.json() as {
          result_count: number;
          results?: Array<{
            taxonomies?: Array<{ desc: string }>;
          }>;
        };
        if (data.result_count > 0 && data.results?.[0]?.taxonomies?.[0]?.desc) {
          const desc = data.results[0].taxonomies[0].desc;
          setForm((prev) => ({ ...prev, specialty: desc }));
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

  useEffect(() => {
    if (isAnalyticsEnabled) posthog.capture(AnalyticsEvents.PHYSICIAN_APPLICATION_STARTED);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    if (name === "npi") {
      const digits = value.replace(/\D/g, "").slice(0, 10);
      setForm((prev) => ({ ...prev, npi: digits }));
      if (digits.length < 10) setNpiStatus("idle");
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!form.fullName.trim() || form.fullName.trim().length < 2) {
      setError("Full name is required.");
      return;
    }
    if (!form.country || !form.specialty) {
      setError("Please complete all required fields.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/doctor/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName:      form.fullName.trim(),
          email:         user?.primaryEmailAddress?.emailAddress ?? "",
          country:       form.country,
          specialty:     form.specialty,
          npiNumber:     !internationalProvider && form.npi     ? form.npi     : undefined,
          licenseNumber: internationalProvider  && form.license ? form.license : undefined,
        }),
      });
      if (!res.ok) throw new Error("Submission failed");
      if (isAnalyticsEnabled) posthog.capture(AnalyticsEvents.PHYSICIAN_APPLICATION_SUBMITTED);
      router.push("/doctor/onboarding/pending");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors";

  return (
    <div
      className="form-dark min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: '#080C14' }}
    >
      <div className="max-w-md w-full flex flex-col gap-6">

        {/* Logo + badge */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-0">
            <span style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em', color: '#F8FAFC' }}>Myo</span>
            <span style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em', color: '#2DD4BF' }}>Guard</span>
            <span style={{ color: '#475569', fontWeight: 300, fontSize: '13px', marginLeft: '4px' }}>Protocol</span>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.2)',
            color: '#2DD4BF', fontSize: '11px', fontWeight: 600,
            padding: '4px 12px', borderRadius: '99px', letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            Physician Registration
          </span>
        </div>

        {/* Info banner */}
        <div style={{
          background: 'rgba(45,212,191,0.06)',
          border: '1px solid rgba(45,212,191,0.18)',
          borderRadius: '12px',
          padding: '14px 16px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start',
        }}>
          <div style={{
            width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, marginTop: '1px',
            background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#2DD4BF" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#2DD4BF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
              Credentialed access only
            </p>
            <p style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.6', margin: 0 }}>
              All physician accounts are individually reviewed within <strong style={{ color: '#94A3B8' }}>24 hours</strong> before activation.
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8" style={{ background: '#0D1421', border: '1px solid #1A2744' }}>
          <div className="mb-6">
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 400, color: '#F1F5F9', marginBottom: '6px' }}>
              Physician Credential Registration
            </h1>
            <p style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.6' }}>
              Complete your credentials below to submit for clinical review.
              MyoGuard Protocol is a Clinical Decision Support (CDS) platform.
              All clinical decisions remain with the treating physician.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>

            {/* Full name — editable; pre-fills from Clerk when available */}
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
                className={inputCls}
              />
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
                className={inputCls}
              >
                <option value="">Select country</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>

            {/* International provider toggle */}
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-xs font-medium text-slate-300">International provider</p>
                <p className="text-xs text-slate-500 mt-0.5">Outside the US — use licence number instead of NPI</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setInternationalProvider((v) => !v);
                  setNpiStatus("idle");
                  setForm((prev) => ({ ...prev, npi: "" }));
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
                  className={`${inputCls} ${
                    npiStatus === "verified"
                      ? "!border-emerald-500 !bg-emerald-950"
                      : npiStatus === "not_found"
                      ? "!border-red-500"
                      : ""
                  }`}
                />
              </div>
            )}

            {/* Licence number — shown when international */}
            {internationalProvider && (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-slate-300">
                  National licence number <span className="text-slate-500 font-normal">(optional)</span>
                </span>
                <input
                  name="license"
                  type="text"
                  placeholder="e.g. TT-MED-12345"
                  value={form.license}
                  onChange={handleChange}
                  className={inputCls}
                />
              </label>
            )}

            {/* Specialty */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-300">
                Specialty <span className="text-red-400">*</span>
              </span>
              <input
                name="specialty"
                type="text"
                list="specialty-suggestions"
                placeholder="e.g. Internal Medicine"
                value={form.specialty}
                onChange={handleChange}
                required
                className={inputCls}
              />
              <datalist id="specialty-suggestions">
                {SPECIALTY_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              {npiStatus === "verified" && (
                <p className="text-xs text-emerald-400">Auto-filled from NPI registry</p>
              )}
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
                "Submit for clinical review"
              )}
            </button>

          </form>

          {/* Footer links */}
          <div className="mt-6 pt-5 flex flex-col items-center gap-2" style={{ borderTop: '1px solid #1A2744' }}>
            <a href="/doctor/sign-in" style={{ fontSize: '13px', color: '#64748B', textDecoration: 'none' }}>
              Already approved? Sign in →
            </a>
            <a href="/" style={{ fontSize: '13px', color: '#475569', textDecoration: 'none' }}>
              Patient? Start your free assessment →
            </a>
          </div>
        </div>

        <p style={{ fontSize: '12px', color: '#334155', textAlign: 'center' }}>
          MyoGuard Protocol · Physician-led Clinical Decision Support
        </p>

      </div>
    </div>
  );
}
