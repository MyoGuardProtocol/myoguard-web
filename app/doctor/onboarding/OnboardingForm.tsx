"use client";
import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

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
  const { user } = useUser();
  const router = useRouter();
  const [form, setForm] = useState({
    country: "", specialty: "", npi: "", license: "",
  });
  const [internationalProvider, setInternationalProvider] = useState(false);
  const [npiStatus, setNpiStatus] = useState<NpiStatus>("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const npiLookupRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    if (name === "npi") {
      // Digits only, max 10
      const digits = value.replace(/\D/g, "").slice(0, 10);
      setForm((prev) => ({ ...prev, npi: digits }));
      if (digits.length < 10) setNpiStatus("idle");
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
          fullName: user?.fullName ?? "",
          email: user?.primaryEmailAddress?.emailAddress ?? "",
          country: form.country,
          specialty: form.specialty,
          npiNumber: !internationalProvider && form.npi ? form.npi : undefined,
          licenseNumber: internationalProvider && form.license ? form.license : undefined,
        }),
      });
      if (!res.ok) throw new Error("Submission failed");
      router.push("/doctor/onboarding/pending");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full flex flex-col gap-6">

        <div className="text-center flex flex-col gap-2">
          <div className="flex items-center justify-center gap-1 mb-2">
            <span className="text-xl font-bold text-slate-900">Myo</span>
            <span className="text-xl font-bold text-teal-600">Guard</span>
          </div>
          <div className="inline-flex items-center justify-center gap-2 bg-slate-900 text-teal-400 text-xs font-medium px-4 py-1.5 rounded-full mx-auto border border-slate-700">
            Physician Registration
          </div>
          <h1 className="text-xl font-semibold text-slate-900 mt-1">Clinical team access</h1>
          <p className="text-sm text-slate-500">
            MyoGuard is a credentialed clinical platform. All physician accounts are individually reviewed before activation.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 items-start">
          <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-blue-700 mb-0.5">Credentialed access only</p>
            <p className="text-xs text-blue-600 leading-relaxed">
              Account pending. Our clinical team reviews all credentials within <strong>24 hours</strong> before activation.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col gap-5"
        >
          {/* Name — read-only from Clerk session */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-700">Full name</span>
            <div className="border border-slate-100 rounded-lg px-3 py-2.5 text-sm text-slate-500 bg-slate-50">
              {user?.fullName ?? "Loading…"}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-700">
              Country <span className="text-red-500">*</span>
            </span>
            <select
              name="country"
              value={form.country}
              onChange={handleChange}
              required
              className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            >
              <option value="">Select country</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          {/* NPI field — hidden when internationalProvider is ON */}
          {!internationalProvider && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">
                  NPI number{" "}
                  <span className="text-slate-400 font-normal">(optional — US physicians)</span>
                </span>
                {npiStatus === "verified" && (
                  <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Verified via NPPES
                  </span>
                )}
                {npiStatus === "not_found" && (
                  <span className="text-xs font-semibold text-red-500">NPI not found</span>
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
                className={`border rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-colors ${
                  npiStatus === "verified"
                    ? "border-emerald-300 focus:ring-emerald-400 bg-emerald-50"
                    : npiStatus === "not_found"
                    ? "border-red-300 focus:ring-red-400"
                    : "border-slate-200 focus:ring-teal-500"
                }`}
              />
            </div>
          )}

          {/* International Provider toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-xs font-medium text-slate-700">International provider</p>
              <p className="text-xs text-slate-400 mt-0.5">Outside the US — use licence number instead of NPI</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setInternationalProvider((v) => !v);
                setNpiStatus("idle");
                setForm((prev) => ({ ...prev, npi: "" }));
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                internationalProvider ? "bg-teal-600" : "bg-slate-200"
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

          {/* Licence number — shown when internationalProvider is ON */}
          {internationalProvider && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-700">
                National licence number{" "}
                <span className="text-slate-400 font-normal">(optional)</span>
              </span>
              <input
                name="license"
                type="text"
                placeholder="e.g. TT-MED-12345"
                value={form.license}
                onChange={handleChange}
                className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </label>
          )}

          {/* Specialty — text input with datalist for NPPES auto-fill */}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-700">
              Specialty <span className="text-red-500">*</span>
            </span>
            <input
              name="specialty"
              type="text"
              list="specialty-suggestions"
              placeholder="e.g. Internal Medicine"
              value={form.specialty}
              onChange={handleChange}
              required
              className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <datalist id="specialty-suggestions">
              {SPECIALTY_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            {npiStatus === "verified" && (
              <p className="text-xs text-emerald-600">Auto-filled from NPI registry</p>
            )}
          </label>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-teal-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Submitting…" : "Submit for clinical review"}
          </button>

          <p className="text-xs text-slate-400 text-center">
            Already approved?{" "}
            <a href="/doctor/sign-in" className="text-teal-600 hover:underline">
              Sign in here
            </a>
          </p>
        </form>

        <p className="text-xs text-slate-400 text-center">
          MyoGuard Clinical Oversight · © 2026 Meridian Health Holding
        </p>
      </div>
    </div>
  );
}
