"use client";
import { useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = "HIGH" | "MODERATE" | "LOW";

interface Patient {
id: string;
name: string;
age: number;
glp1Agent: string;
glp1Dose: string;
muscleScore: number;
giSymptom: string;
proteinAdherence: number; // percent
lastSeen: string;
riskLevel: RiskLevel;
riskFactor: string;
proteinTarget: number;
proteinActual: number;
weeklyCheckins: number[];
}

// ── Mock data ────────────────────────────────────────────────────────────────

const PATIENTS: Patient[] = [
{
id: "1",
name: "M. Celestine",
age: 54,
glp1Agent: "Semaglutide",
glp1Dose: "2.4 mg",
muscleScore: 28,
giSymptom: "Gastroparesis symptoms",
proteinAdherence: 41,
lastSeen: "2h ago",
riskLevel: "HIGH",
riskFactor: "72h Protein Deficit + Gastroparesis",
proteinTarget: 136,
proteinActual: 56,
weeklyCheckins: [45, 38, 41, 35, 41],
},
{
id: "2",
name: "R. Bartholomew",
age: 61,
glp1Agent: "Tirzepatide",
glp1Dose: "10 mg",
muscleScore: 34,
giSymptom: "Nausea + constipation",
proteinAdherence: 52,
lastSeen: "1d ago",
riskLevel: "HIGH",
riskFactor: "High-dose tirzepatide + Low protein",
proteinTarget: 148,
proteinActual: 77,
weeklyCheckins: [60, 55, 52, 50, 52],
},
{
id: "3",
name: "T. Marchand",
age: 47,
glp1Agent: "Semaglutide",
glp1Dose: "1.0 mg",
muscleScore: 58,
giSymptom: "Mild nausea only",
proteinAdherence: 74,
lastSeen: "3d ago",
riskLevel: "MODERATE",
riskFactor: "Protein adequacy borderline",
proteinTarget: 112,
proteinActual: 83,
weeklyCheckins: [70, 72, 68, 74, 74],
},
{
id: "4",
name: "A. Prentice",
age: 39,
glp1Agent: "Liraglutide",
glp1Dose: "1.8 mg",
muscleScore: 82,
giSymptom: "None",
proteinAdherence: 91,
lastSeen: "5d ago",
riskLevel: "LOW",
riskFactor: "On target",
proteinTarget: 104,
proteinActual: 95,
weeklyCheckins: [85, 88, 90, 91, 91],
},
{
id: "5",
name: "D. Kowlessar",
age: 58,
glp1Agent: "Tirzepatide",
glp1Dose: "5 mg",
muscleScore: 44,
giSymptom: "Constipation",
proteinAdherence: 63,
lastSeen: "1d ago",
riskLevel: "MODERATE",
riskFactor: "GI burden reducing absorption",
proteinTarget: 128,
proteinActual: 81,
weeklyCheckins: [58, 61, 63, 60, 63],
},
];

const RISK_CONFIG: Record<
RiskLevel,
{ label: string; bg: string; border: string; text: string; dot: string; badge: string }
> = {
HIGH: {
label: "High Risk",
bg: "bg-red-50",
border: "border-red-200",
text: "text-red-700",
dot: "bg-red-500",
badge: "bg-red-100 text-red-700",
},
MODERATE: {
label: "Moderate",
bg: "bg-amber-50",
border: "border-amber-200",
text: "text-amber-700",
dot: "bg-amber-400",
badge: "bg-amber-100 text-amber-700",
},
LOW: {
label: "On Target",
bg: "bg-teal-50",
border: "border-teal-200",
text: "text-teal-700",
dot: "bg-teal-500",
badge: "bg-teal-100 text-teal-700",
},
};

// ── Share Kit Modal ──────────────────────────────────────────────────────────

function ShareKit({ onClose }: { onClose: () => void }) {
const [copied, setCopied] = useState(false);
const inviteUrl = "https://myoguard.health/invite/dr-b";

function handleCopy() {
navigator.clipboard.writeText(inviteUrl);
setCopied(true);
setTimeout(() => setCopied(false), 2000);
}

return (
<div
style={{
minHeight: 400,
background: "rgba(0,0,0,0.5)",
display: "flex",
alignItems: "center",
justifyContent: "center",
}}
className="fixed inset-0 z-50 px-4"
onClick={onClose}
>
<div
className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 w-full max-w-sm flex flex-col gap-5"
onClick={(e) => e.stopPropagation()}
>
<div className="flex items-center justify-between">
<div>
<h3 className="text-sm font-semibold text-slate-900">Physician Share Kit</h3>
<p className="text-xs text-slate-400 mt-0.5">
Show patient in exam room — links automatically
</p>
</div>
<button
onClick={onClose}
className="text-slate-400 hover:text-slate-600 text-lg leading-none"
>
✕
</button>
</div>

{/* QR placeholder */}
<div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col items-center gap-3">
<div className="w-32 h-32 bg-white border border-slate-300 rounded-lg flex items-center justify-center">
<div className="grid grid-cols-5 gap-0.5">
{Array.from({ length: 25 }).map((_, i) => (
<div
key={i}
className={`w-4 h-4 rounded-sm ${
[0,1,2,3,4,5,9,10,14,15,19,20,21,22,23,24,7,12,17].includes(i)
? "bg-slate-800"
: "bg-white"
}`}
/>
))}
</div>
</div>
<p className="text-xs text-slate-500 text-center">
Patient scans → auto-linked to your profile
</p>
</div>

{/* Link copy */}
<div className="flex gap-2">
<div className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-500 font-mono truncate bg-slate-50">
{inviteUrl}
</div>
<button
onClick={handleCopy}
className="bg-teal-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-teal-700 transition-colors whitespace-nowrap"
>
{copied ? "Copied!" : "Copy"}
</button>
</div>

{/* SMS */}
<button className="w-full border border-slate-200 text-slate-700 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
Send via SMS
</button>

<p className="text-xs text-slate-400 text-center">
Patient data is automatically linked after sign-up
</p>
</div>
</div>
);
}

// ── Spark line ───────────────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
const max = Math.max(...data);
const min = Math.min(...data);
const range = max - min || 1;
const w = 60;
const h = 24;
const points = data
.map((v, i) => {
const x = (i / (data.length - 1)) * w;
const y = h - ((v - min) / range) * h;
return `${x},${y}`;
})
.join(" ");

return (
<svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
<polyline
points={points}
fill="none"
stroke={color}
strokeWidth="1.5"
strokeLinecap="round"
strokeLinejoin="round"
/>
</svg>
);
}

// ── Patient row ──────────────────────────────────────────────────────────────

function PatientRow({
p,
onClick,
}: {
p: Patient;
onClick: (p: Patient) => void;
}) {
const cfg = RISK_CONFIG[p.riskLevel];
const pctBar = Math.round((p.proteinActual / p.proteinTarget) * 100);
const sparkColor =
p.riskLevel === "HIGH"
? "#ef4444"
: p.riskLevel === "MODERATE"
? "#f59e0b"
: "#14b8a6";

return (
<tr
className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
onClick={() => onClick(p)}
>
<td className="py-3 px-4">
<div className="flex items-center gap-2">
<div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
<div>
<p className="text-sm font-medium text-slate-900">{p.name}</p>
<p className="text-xs text-slate-400">Age {p.age}</p>
</div>
</div>
</td>
<td className="py-3 px-4">
<p className="text-xs text-slate-700 font-medium">{p.glp1Agent}</p>
<p className="text-xs text-slate-400">{p.glp1Dose}/wk</p>
</td>
<td className="py-3 px-4">
<div className="flex items-center gap-2">
<span
className={`text-sm font-bold ${
p.muscleScore < 40
? "text-red-600"
: p.muscleScore < 70
? "text-amber-600"
: "text-teal-600"
}`}
>
{p.muscleScore}
</span>
<span className="text-xs text-slate-400">/100</span>
</div>
</td>
<td className="py-3 px-4">
<div className="flex flex-col gap-1">
<div className="flex items-center justify-between">
<span className="text-xs text-slate-500">{pctBar}%</span>
</div>
<div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
<div
className={`h-1.5 rounded-full ${
pctBar < 60
? "bg-red-400"
: pctBar < 80
? "bg-amber-400"
: "bg-teal-500"
}`}
style={{ width: `${pctBar}%` }}
/>
</div>
<span className="text-xs text-slate-400">
{p.proteinActual}g / {p.proteinTarget}g
</span>
</div>
</td>
<td className="py-3 px-4 hidden md:table-cell">
<Sparkline data={p.weeklyCheckins} color={sparkColor} />
</td>
<td className="py-3 px-4">
<span
className={`inline-block text-xs font-medium px-2 py-1 rounded-full ${cfg.badge}`}
>
{cfg.label}
</span>
</td>
<td className="py-3 px-4">
<p className="text-xs text-slate-500 max-w-[140px] leading-snug">
{p.riskFactor}
</p>
</td>
<td className="py-3 px-4">
<span className="text-xs text-slate-400">{p.lastSeen}</span>
</td>
</tr>
);
}

// ── Patient detail drawer ────────────────────────────────────────────────────

function PatientDrawer({
patient,
onClose,
}: {
patient: Patient;
onClose: () => void;
}) {
const cfg = RISK_CONFIG[patient.riskLevel];
const pct = Math.round((patient.proteinActual / patient.proteinTarget) * 100);

return (
<div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
<div
className="w-full max-w-sm bg-white border-l border-slate-200 h-full overflow-y-auto p-6 flex flex-col gap-6 shadow-xl"
onClick={(e) => e.stopPropagation()}
>
<div className="flex items-center justify-between">
<div>
<h3 className="text-base font-semibold text-slate-900">
{patient.name}
</h3>
<p className="text-xs text-slate-400">
Age {patient.age} · Last active {patient.lastSeen}
</p>
</div>
<button
onClick={onClose}
className="text-slate-400 hover:text-slate-600"
>
✕
</button>
</div>

{/* Risk alert */}
<div
className={`rounded-xl border p-4 flex flex-col gap-1 ${cfg.bg} ${cfg.border}`}
>
<p className={`text-xs font-semibold ${cfg.text}`}>
{cfg.label} — Action Required
</p>
<p className={`text-xs ${cfg.text} opacity-80`}>{patient.riskFactor}</p>
</div>

{/* Score */}
<div className="flex flex-col gap-2">
<p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
Muscle Retention Score
</p>
<div className="flex items-baseline gap-2">
<span
className={`text-4xl font-bold ${
patient.muscleScore < 40
? "text-red-600"
: patient.muscleScore < 70
? "text-amber-600"
: "text-teal-600"
}`}
>
{patient.muscleScore}
</span>
<span className="text-slate-400">/100</span>
</div>
<div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
<div
className={`h-2 rounded-full ${
patient.muscleScore < 40
? "bg-red-500"
: patient.muscleScore < 70
? "bg-amber-400"
: "bg-teal-500"
}`}
style={{ width: `${patient.muscleScore}%` }}
/>
</div>
</div>

{/* Protocol stats */}
<div className="grid grid-cols-2 gap-3">
{[
{ label: "GLP-1 Agent", value: patient.glp1Agent },
{ label: "Current Dose", value: patient.glp1Dose + "/wk" },
{ label: "Protein Target", value: patient.proteinTarget + "g/day" },
{ label: "Actual Intake", value: patient.proteinActual + "g/day" },
{ label: "Adherence", value: pct + "%" },
{ label: "GI Burden", value: patient.giSymptom },
].map((item) => (
<div
key={item.label}
className="bg-slate-50 rounded-xl p-3 flex flex-col gap-1"
>
<p className="text-xs text-slate-400">{item.label}</p>
<p className="text-sm font-medium text-slate-800">{item.value}</p>
</div>
))}
</div>

{/* Trend */}
<div className="flex flex-col gap-2">
<p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
5-Week Adherence Trend
</p>
<div className="bg-slate-50 rounded-xl p-4">
<Sparkline
data={patient.weeklyCheckins}
color={
patient.riskLevel === "HIGH"
? "#ef4444"
: patient.riskLevel === "MODERATE"
? "#f59e0b"
: "#14b8a6"
}
/>
<div className="flex justify-between mt-2">
{patient.weeklyCheckins.map((v, i) => (
<span key={i} className="text-xs text-slate-400">
{v}%
</span>
))}
</div>
</div>
</div>

{/* Actions */}
<div className="flex flex-col gap-2">
<button className="w-full bg-teal-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors">
Send protocol update
</button>
<button className="w-full border border-slate-200 text-slate-700 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
Request check-in
</button>
<button className="w-full border border-red-100 text-red-600 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors">
Flag for urgent review
</button>
</div>
</div>
</div>
);
}

// ── Main dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
const [showShare, setShowShare] = useState(false);
const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
const [filter, setFilter] = useState<RiskLevel | "ALL">("ALL");

const highRisk = PATIENTS.filter((p) => p.riskLevel === "HIGH");
const filtered =
filter === "ALL" ? PATIENTS : PATIENTS.filter((p) => p.riskLevel === filter);

const now = new Date();
const hour = now.getHours();
const greeting =
hour < 5
? "Still at it"
: hour < 12
? "Good morning"
: hour < 17
? "Good afternoon"
: hour < 21
? "Good evening"
: "Good evening";

return (
<div className="min-h-screen bg-slate-950 text-white">

{/* Top bar */}
<header className="border-b border-slate-800 px-6 py-4">
<div className="max-w-7xl mx-auto flex items-center justify-between">
<div className="flex items-center gap-4">
<div className="flex items-center gap-1">
<span className="text-lg font-bold text-white">Myo</span>
<span className="text-lg font-bold text-teal-400">Guard</span>
</div>
<div className="hidden sm:block h-4 w-px bg-slate-700" />
<span className="hidden sm:block text-xs text-slate-400 font-medium uppercase tracking-wider">
Clinical Command Center
</span>
</div>

<div className="flex items-center gap-3">
{/* Time */}
<span className="text-xs text-slate-500 hidden md:block">
{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
</span>

{/* Alerts badge */}
<div className="relative">
<button className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-slate-700 transition-colors">
<svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
<path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
</svg>
</button>
{highRisk.length > 0 && (
<div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
<span className="text-xs text-white font-bold">{highRisk.length}</span>
</div>
)}
</div>

{/* Share kit — floating CTA */}
<button
onClick={() => setShowShare(true)}
className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors"
>
<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
<path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
</svg>
Invite Patient
</button>

<div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-xs font-bold">
Dr
</div>
</div>
</div>
</header>

<main className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-8">

{/* Greeting */}
<div className="flex items-start justify-between">
<div>
<h1 className="text-xl font-semibold text-white">
{greeting}, Dr. Okpala.
</h1>
<p className="text-sm text-slate-400 mt-1">
{highRisk.length > 0
? `${highRisk.length} patient${highRisk.length > 1 ? "s" : ""} require${highRisk.length === 1 ? "s" : ""} attention tonight.`
: "All patients within target range."}
</p>
</div>
<div className="text-right hidden sm:block">
<p className="text-xs text-slate-500">
{now.toLocaleDateString("en-GB", {
weekday: "long",
day: "numeric",
month: "long",
year: "numeric",
})}
</p>
</div>
</div>

{/* ── SECTION 1: Triage header ── */}
{highRisk.length > 0 && (
<div className="flex flex-col gap-3">
<div className="flex items-center gap-2">
<div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
<h2 className="text-xs font-semibold text-red-400 uppercase tracking-widest">
Triage — Immediate Attention
</h2>
</div>
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
{highRisk.map((p) => (
<button
key={p.id}
onClick={() => setSelectedPatient(p)}
className="bg-slate-900 border border-red-900 rounded-xl p-4 text-left hover:border-red-700 transition-colors flex flex-col gap-3"
>
<div className="flex items-center justify-between">
<div className="flex items-center gap-2">
<div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
<span className="text-sm font-medium text-white">{p.name}</span>
</div>
<span className="text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded-full font-medium">
Score {p.muscleScore}
</span>
</div>
<div className="flex flex-col gap-1">
<p className="text-xs text-slate-400">
{p.glp1Agent} {p.glp1Dose}/wk
</p>
<p className="text-xs text-red-400 font-medium">
⚠ {p.riskFactor}
</p>
</div>
<div className="flex items-center justify-between">
<div className="flex flex-col gap-1 flex-1">
<div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
<div
className="h-1 bg-red-500 rounded-full"
style={{
width: `${Math.round(
(p.proteinActual / p.proteinTarget) * 100
)}%`,
}}
/>
</div>
<p className="text-xs text-slate-500">
Protein {p.proteinActual}g / {p.proteinTarget}g
</p>
</div>
<span className="text-xs text-slate-500 ml-3">{p.lastSeen}</span>
</div>
</button>
))}
</div>
</div>
)}

{/* ── SECTION 2: KPI strip ── */}
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
{[
{
label: "Total patients",
value: PATIENTS.length.toString(),
sub: "Active on protocol",
color: "text-white",
},
{
label: "High risk",
value: PATIENTS.filter((p) => p.riskLevel === "HIGH").length.toString(),
sub: "Score < 40",
color: "text-red-400",
},
{
label: "Avg muscle score",
value: Math.round(
PATIENTS.reduce((a, p) => a + p.muscleScore, 0) / PATIENTS.length
).toString(),
sub: "Across active cohort",
color: "text-teal-400",
},
{
label: "Avg protein adherence",
value:
Math.round(
PATIENTS.reduce((a, p) => a + p.proteinAdherence, 0) /
PATIENTS.length
) + "%",
sub: "Of 1.6 g/kg target",
color: "text-amber-400",
},
].map((k) => (
<div
key={k.label}
className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-1"
>
<p className="text-xs text-slate-500">{k.label}</p>
<p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
<p className="text-xs text-slate-600">{k.sub}</p>
</div>
))}
</div>

{/* ── SECTION 3: Patient table ── */}
<div className="flex flex-col gap-4">
<div className="flex items-center justify-between">
<h2 className="text-sm font-semibold text-slate-300">
Patient Panel
</h2>
{/* Filter tabs */}
<div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
{(["ALL", "HIGH", "MODERATE", "LOW"] as const).map((f) => (
<button
key={f}
onClick={() => setFilter(f)}
className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
filter === f
? "bg-slate-700 text-white"
: "text-slate-500 hover:text-slate-300"
}`}
>
{f === "ALL" ? "All" : RISK_CONFIG[f].label}
</button>
))}
</div>
</div>

<div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
<div className="overflow-x-auto">
<table className="w-full">
<thead>
<tr className="border-b border-slate-800">
{[
"Patient",
"GLP-1 Agent",
"Score",
"Protein",
"Trend",
"Status",
"Risk Factor",
"Last Active",
].map((h) => (
<th
key={h}
className={`text-left text-xs font-medium text-slate-500 px-4 py-3 uppercase tracking-wider ${
h === "Trend" ? "hidden md:table-cell" : ""
}`}
>
{h}
</th>
))}
</tr>
</thead>
<tbody>
{filtered.map((p) => (
<PatientRow
key={p.id}
p={p}
onClick={setSelectedPatient}
/>
))}
</tbody>
</table>
</div>
</div>
</div>

{/* ── SECTION 4: Share kit promo strip ── */}
<div className="bg-slate-900 border border-teal-900 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
<div className="flex flex-col gap-1">
<p className="text-sm font-semibold text-white">
Refer a patient in 10 seconds
</p>
<p className="text-xs text-slate-400">
Show the QR code in your exam room. Patient signs up and links to your profile automatically — no manual entry.
</p>
</div>
<button
onClick={() => setShowShare(true)}
className="flex-shrink-0 bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
>
Open Share Kit
</button>
</div>

</main>

{/* Modals */}
{showShare && <ShareKit onClose={() => setShowShare(false)} />}
{selectedPatient && (
<PatientDrawer
patient={selectedPatient}
onClose={() => setSelectedPatient(null)}
/>
)}
</div>
);
}
