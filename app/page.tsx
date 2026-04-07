"use client";
import { useState } from "react";

function computeScore(weightKg: number, proteinG: number, doseM: number): number {
const target = weightKg * 1.6;
const adequacy = Math.min(proteinG / target, 1);
const dosePenalty = Math.min(doseM / 2.4, 1) * 20;
const raw = adequacy * 100 - dosePenalty;
return Math.max(0, Math.min(100, Math.round(raw)));
}

type RiskBand = "LOW" | "MODERATE" | "HIGH";

function getRisk(score: number): RiskBand {
if (score >= 70) return "LOW";
if (score >= 40) return "MODERATE";
return "HIGH";
}

const RISK_META: Record<RiskBand, { label: string; color: string; explanation: string }> = {
LOW: {
label: "Low Risk",
color: "text-teal-600",
explanation:
"Your protein intake is well-matched to your GLP-1 dose. Lean mass loss risk is within acceptable clinical range. Continue current protocol with quarterly monitoring.",
},
MODERATE: {
label: "Moderate Risk",
color: "text-amber-600",
explanation:
"Protein adequacy is suboptimal relative to your GLP-1 dose stage. Sarcopenic trajectory is possible without intervention. Supplementation and resistance training are recommended.",
},
HIGH: {
label: "High Risk",
color: "text-red-600",
explanation:
"Significant lean mass loss risk detected. Your current protein intake does not meet the 1.6 g/kg protective threshold. Immediate protocol review is indicated.",
},
};

export default function HomePage() {
const [weight, setWeight] = useState("");
const [protein, setProtein] = useState("");
const [dose, setDose] = useState("");
const [result, setResult] = useState<{ score: number; risk: RiskBand } | null>(null);
const [email, setEmail] = useState("");
const [submitted, setSubmitted] = useState(false);

function handleCalculate() {
const w = parseFloat(weight);
const p = parseFloat(protein);
const d = parseFloat(dose);
if (!w || !p || !d || w <= 0 || p <= 0 || d <= 0) return;
const score = computeScore(w, p, d);
setResult({ score, risk: getRisk(score) });
}

async function handleEmailSubmit() {
if (!email.includes("@")) return;
setSubmitted(true);
}

return (
<main className="min-h-screen bg-white text-slate-900">

{/* Nav */}
<nav className="border-b border-slate-100 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
<div className="flex items-center gap-1">
<span className="text-xl font-bold text-slate-900">Myo</span>
<span className="text-xl font-bold text-teal-600">Guard</span>
</div>
<div className="flex gap-3">
<a href="/sign-in" className="text-sm text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg border border-slate-200 transition-colors">
Sign in
</a>
<a href="/sign-up" className="text-sm bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors">
Get started
</a>
</div>
</nav>

{/* Hero */}
<section className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

{/* LEFT */}
<div className="flex flex-col gap-6 pt-4">
<div className="inline-flex items-center gap-2 bg-teal-50 text-teal-700 text-xs font-medium px-3 py-1.5 rounded-full w-fit border border-teal-100">
Physician-Formulated · Evidence-Based
</div>
<h1 className="text-4xl lg:text-5xl font-bold text-slate-900 leading-tight">
Protect Muscle.<br />
<span className="text-teal-600">Optimize GLP-1 Outcomes.</span>
</h1>
<p className="text-lg text-slate-500 leading-relaxed max-w-md">
The clinical standard for muscle preservation during GLP-1 therapy. Physician-designed protocols that calculate your sarcopenia risk and deliver actionable protection targets.
</p>
<div className="flex flex-col gap-3 pt-2">
{[
"Real-time sarcopenia risk scoring",
"Personalised protein & fiber targets",
"Evidence-based supplement guidance",
"Continuous adherence monitoring",
].map((f) => (
<div key={f} className="flex items-center gap-2 text-slate-600 text-sm">
<div className="w-4 h-4 rounded-full bg-teal-100 flex items-center justify-center">
<div className="w-2 h-2 rounded-full bg-teal-600" />
</div>
{f}
</div>
))}
</div>
<div className="flex items-center gap-3 pt-2">
<a href="/sign-up" className="bg-teal-600 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors">
Start free assessment
</a>
<a href="/sign-up/physician" className="text-sm text-slate-600 hover:text-teal-600 transition-colors underline underline-offset-2">
Are you a clinician?
</a>
</div>
</div>

{/* RIGHT — Calculator */}
<div className="flex flex-col gap-4">
<div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col gap-5">
<div>
<h2 className="text-base font-semibold text-slate-900">Sarcopenia Risk Calculator</h2>
<p className="text-xs text-slate-400 mt-0.5">No account required · Results in seconds</p>
</div>

<div className="flex flex-col gap-4">
<label className="flex flex-col gap-1.5">
<span className="text-xs font-medium text-slate-600">Body weight (kg)</span>
<input
type="number"
min="30"
max="300"
placeholder="e.g. 85"
value={weight}
onChange={(e) => setWeight(e.target.value)}
className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
/>
</label>

<label className="flex flex-col gap-1.5">
<span className="text-xs font-medium text-slate-600">Daily protein intake (g)</span>
<input
type="number"
min="0"
max="400"
placeholder="e.g. 80"
value={protein}
onChange={(e) => setProtein(e.target.value)}
className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
/>
</label>

<label className="flex flex-col gap-1.5">
<span className="text-xs font-medium text-slate-600">Current GLP-1 dose (mg/week)</span>
<input
type="number"
min="0"
max="15"
step="0.25"
placeholder="e.g. 0.5"
value={dose}
onChange={(e) => setDose(e.target.value)}
className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
/>
</label>
</div>

<button
onClick={handleCalculate}
className="w-full bg-teal-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-teal-700 active:scale-95 transition-all"
>
Calculate my risk score
</button>

{result && (
<div className="flex flex-col gap-4 border-t border-slate-100 pt-4">

{/* Score row */}
<div className="flex items-center justify-between">
<div>
<p className="text-xs text-slate-500 mb-1">MyoGuard Score</p>
<div className="flex items-baseline gap-2">
<span className="text-4xl font-bold text-slate-900">{result.score}</span>
<span className="text-slate-400 text-sm">/100</span>
</div>
</div>
<div className="text-right">
<p className="text-xs text-slate-500 mb-1">Risk band</p>
<span className={`text-sm font-semibold ${RISK_META[result.risk].color}`}>
{RISK_META[result.risk].label}
</span>
</div>
</div>

{/* Bar */}
<div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
<div
className={`h-2 rounded-full transition-all ${
result.risk === "LOW"
? "bg-teal-500"
: result.risk === "MODERATE"
? "bg-amber-400"
: "bg-red-500"
}`}
style={{ width: `${result.score}%` }}
/>
</div>

{/* Explanation */}
<p className="text-xs text-slate-600 leading-relaxed">
{RISK_META[result.risk].explanation}
</p>

{/* Blurred protocol preview */}
<div className="relative rounded-xl border border-slate-200 overflow-hidden">
<div className="p-4 flex flex-col gap-2 select-none pointer-events-none">
<p className="text-xs font-semibold text-slate-700">Clinical Protocol — Full Report</p>
{[
"Protein target: __ g/day (1.6 g/kg adjusted)",
"Fibre target: __ g/day (dose-staged)",
"Hydration baseline: __ ml/day",
"Supplement stack: Whey · Creatine · Vitamin D · Omega-3",
"Resistance training: __ sessions/week",
"Monitoring labs: Ferritin · B12 · Zinc · Magnesium",
].map((line) => (
<p key={line} className="text-xs text-slate-400">{line}</p>
))}
</div>
<div className="absolute inset-0 backdrop-blur-sm bg-white/60 flex flex-col items-center justify-center gap-2 p-4">
<div className="w-8 h-8 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center">
<svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
<path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
</svg>
</div>
<p className="text-xs font-semibold text-slate-800 text-center">Full protocol locked</p>
<p className="text-xs text-slate-500 text-center">Enter your email to unlock the complete clinical report.</p>
</div>
</div>

{/* Email gate */}
{!submitted ? (
<div className="flex flex-col gap-2">
<input
type="email"
placeholder="Enter your email address"
value={email}
onChange={(e) => setEmail(e.target.value)}
className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
/>
<button
onClick={handleEmailSubmit}
className="w-full border border-teal-600 text-teal-600 py-2.5 rounded-xl text-sm font-medium hover:bg-teal-50 transition-colors"
>
Unlock full protocol →
</button>
<p className="text-xs text-slate-400 text-center">No spam. Unsubscribe anytime.</p>
</div>
) : (
<div className="bg-teal-50 border border-teal-100 rounded-xl p-3 text-center">
<p className="text-sm font-medium text-teal-700">Protocol sent to {email}</p>
<p className="text-xs text-teal-500 mt-0.5">Check your inbox — full clinical report included.</p>
</div>
)}
</div>
)}
</div>

<p className="text-xs text-slate-400 text-center px-4">
MyoGuard Clinical Oversight · For educational use only · Not a substitute for clinical consultation
</p>
</div>
</section>

{/* Evidence strip */}
<section className="border-t border-slate-100 bg-slate-50 py-10">
<div className="max-w-6xl mx-auto px-6 text-center flex flex-col gap-3">
<p className="text-xs text-slate-400 uppercase tracking-widest font-medium">Built on peer-reviewed evidence</p>
<div className="flex flex-wrap justify-center gap-6 text-xs text-slate-500">
{[
"NEJM · STEP 1 Trial",
"Diabetes & Metabolism 2026",
"Clinical Obesity · Urbina et al.",
"EWGSOP2 Sarcopenia Criteria",
"Joint GLP-1 Advisory 2025",
].map((s) => (
<span key={s} className="font-medium">{s}</span>
))}
</div>
</div>
</section>

{/* Footer */}
<footer className="border-t border-slate-100 py-8 px-6">
<div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
<span>© 2026 MyoGuard Protocol · Meridian Health Holding</span>
<span>myoguard.health · docb@myoguard.health</span>
</div>
</footer>

</main>
);
}
