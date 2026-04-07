"use client";
import { useState } from "react";

const SPECIALTIES = [
"Internal Medicine",
"Endocrinology",
"Family Medicine",
"Bariatric Medicine",
"Obesity Medicine",
"Sports Medicine",
"General Practice",
"Cardiology",
"Nephrology",
"Other",
];

const COUNTRIES = [
"Trinidad and Tobago",
"United States",
"United Kingdom",
"Canada",
"Australia",
"Jamaica",
"Barbados",
"Guyana",
"India",
"Nigeria",
"Other",
];

export default function OnboardingForm() {
const [form, setForm] = useState({
name: "",
country: "",
specialty: "",
license: "",
});
const [submitted, setSubmitted] = useState(false);
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");

function handleChange(
e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
) {
setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
}

async function handleSubmit(e: React.FormEvent) {
e.preventDefault();
if (!form.name.trim() || !form.country || !form.specialty) {
setError("Please complete all required fields.");
return;
}
setError("");
setLoading(true);
try {
const res = await fetch("/api/doctor/onboarding", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(form),
});
if (!res.ok) throw new Error("Submission failed");
setSubmitted(true);
} catch {
setError("Something went wrong. Please try again.");
} finally {
setLoading(false);
}
}

if (submitted) {
return (
<div className="min-h-screen bg-white flex items-center justify-center px-4">
<div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center flex flex-col gap-4">
<div className="w-12 h-12 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center mx-auto">
<svg className="w-6 h-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
<path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
</svg>
</div>
<h2 className="text-lg font-semibold text-slate-900">Application received</h2>
<p className="text-sm text-slate-500 leading-relaxed">
Thank you, <strong className="text-slate-700">{form.name}</strong>. Your credentials have been submitted for review.
</p>
<div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-left">
<p className="text-xs font-semibold text-amber-700 mb-1">Account pending approval</p>
<p className="text-xs text-amber-600 leading-relaxed">
Our clinical team reviews all physician credentials within{" "}
<strong>6–24 hours</strong> before account activation. You will
receive a confirmation email once approved.
</p>
</div>
<p className="text-xs text-slate-400">
Questions? Contact us at docb@myoguard.health
</p>
</div>
</div>
);
}

return (
<div className="min-h-screen bg-white flex items-center justify-center px-4 py-12">
<div className="max-w-md w-full flex flex-col gap-6">

{/* Header */}
<div className="text-center flex flex-col gap-2">
<div className="flex items-center justify-center gap-1 mb-2">
<span className="text-xl font-bold text-slate-900">Myo</span>
<span className="text-xl font-bold text-teal-600">Guard</span>
</div>
<h1 className="text-xl font-semibold text-slate-900">Physician registration</h1>
<p className="text-sm text-slate-500">
MyoGuard is a credentialed clinical platform. All physician accounts are reviewed before activation.
</p>
</div>

{/* Pending notice */}
<div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
<p className="text-xs font-semibold text-blue-700 mb-1">Credentialed access</p>
<p className="text-xs text-blue-600 leading-relaxed">
Account pending. Our clinical team reviews all credentials within{" "}
<strong>6–24 hours</strong> before activation.
</p>
</div>

{/* Form */}
<form
onSubmit={handleSubmit}
className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col gap-5"
>
{/* Name */}
<label className="flex flex-col gap-1.5">
<span className="text-xs font-medium text-slate-700">
Full name <span className="text-red-500">*</span>
</span>
<input
name="name"
type="text"
placeholder="Dr. Jane Smith"
value={form.name}
onChange={handleChange}
required
className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
/>
</label>

{/* Country */}
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

{/* Specialty */}
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

{/* Licence (optional) */}
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
{loading ? "Submitting…" : "Submit for review"}
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
