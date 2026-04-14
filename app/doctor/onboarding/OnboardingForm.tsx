"use client";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

const SPECIALTIES = [
  "Internal Medicine",
  "Endocrinology",
  "Family Medicine",
  "Bariatric Medicine",
  "Obesity Medicine",
  "Sports Medicine",
  "Cardiology",
  "Nephrology",
  "Other",
];

const COUNTRIES = [
  // Highest GLP-1 prescription markets first
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
  // Caribbean
  "Trinidad and Tobago",
  "Jamaica",
  "Barbados",
  "Guyana",
  "Bahamas",
  "Haiti",
  "Dominican Republic",
  "Other",
];

export default function OnboardingForm() {
  const { user } = useUser();
  const router = useRouter();
  const [form, setForm] = useState({
    country: "", specialty: "", npi: "", license: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
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
          npiNumber: form.npi || undefined,
          licenseNumber: form.license || undefined,
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

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-700">
              Specialty <span className="text-red-500">*</span>
            </span>
            <select
              name="specialty"
              value={form.specialty}
              onChange={handleChange}
              required
              className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            >
              <option value="">Select specialty</option>
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-700">
              NPI number{" "}
              <span className="text-slate-400 font-normal">(optional — US physicians)</span>
            </span>
            <input
              name="npi"
              type="text"
              placeholder="e.g. 1234567890"
              value={form.npi}
              onChange={handleChange}
              className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-700">
              Medical licence number{" "}
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
            <a href="/sign-in" className="text-teal-600 hover:underline">
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
