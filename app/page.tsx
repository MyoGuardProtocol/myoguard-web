"use client";
import { useState } from "react";

const GLP1_DRUGS = [
  { label: "Semaglutide 0.25 mg/wk — initiation (Ozempic)", value: 0.25, max: 2.4 },
  { label: "Semaglutide 0.5 mg/wk — standard (Ozempic)", value: 0.5, max: 2.4 },
  { label: "Semaglutide 1.0 mg/wk — maintenance (Ozempic)", value: 1.0, max: 2.4 },
  { label: "Semaglutide 1.7 mg/wk (Wegovy)", value: 1.7, max: 2.4 },
  { label: "Semaglutide 2.4 mg/wk — max (Wegovy)", value: 2.4, max: 2.4 },
  { label: "Tirzepatide 2.5 mg/wk — initiation (Zepbound)", value: 2.5, max: 15 },
  { label: "Tirzepatide 5 mg/wk (Zepbound)", value: 5, max: 15 },
  { label: "Tirzepatide 10 mg/wk (Zepbound)", value: 10, max: 15 },
  { label: "Tirzepatide 15 mg/wk — max (Zepbound)", value: 15, max: 15 },
  { label: "Liraglutide 1.2 mg/wk (Victoza)", value: 1.2, max: 1.8 },
  { label: "Liraglutide 1.8 mg/wk — max (Victoza)", value: 1.8, max: 1.8 },
  { label: "Dulaglutide 0.75 mg/wk (Trulicity)", value: 0.75, max: 1.5 },
  { label: "Dulaglutide 1.5 mg/wk — max (Trulicity)", value: 1.5, max: 1.5 },
];

const GI_SYMPTOMS = [
  { label: "None", value: 0 },
  { label: "Mild nausea only", value: 5 },
  { label: "Nausea + reduced appetite", value: 10 },
  { label: "Constipation", value: 8 },
  { label: "Nausea + constipation", value: 14 },
  { label: "Vomiting episodes", value: 18 },
  { label: "Gastroparesis symptoms (bloating, early satiety)", value: 20 },
  { label: "Severe GI intolerance — multiple symptoms", value: 25 },
];

type RiskBand = "LOW" | "MODERATE" | "HIGH";

function getRisk(score: number): RiskBand {
  if (score >= 70) return "LOW";
  if (score >= 40) return "MODERATE";
  return "HIGH";
}

function computeLeanMassScore(
  weightKg: number,
  proteinG: number,
  drugValue: number,
  drugMax: number,
  giPenalty: number
): number {
  const target = weightKg * 1.6;
  const adequacy = Math.min(proteinG / target, 1);
  const dosePenalty = Math.min(drugValue / drugMax, 1) * 20;
  const raw = adequacy * 100 - dosePenalty - giPenalty;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function computeRecoveryScore(sleepHours: number): number {
  if (sleepHours >= 7.5) return 95;
  if (sleepHours >= 7) return 85;
  if (sleepHours >= 6.5) return 72;
  if (sleepHours >= 6) return 58;
  if (sleepHours >= 5.5) return 42;
  if (sleepHours >= 5) return 28;
  return 14;
}

function computeComposite(leanScore: number, recoveryScore: number): number {
  return Math.round(leanScore * 0.7 + recoveryScore * 0.3);
}

const RISK_META: Record<RiskBand, {
  label: string;
  color: string;
  bar: string;
  explanation: string;
}> = {
  LOW: {
    label: "Low Risk",
    color: "text-teal-600",
    bar: "bg-teal-500",
    explanation:
      "Protein intake is well-matched to your GLP-1 dose stage and your anabolic recovery environment is supportive. Lean mass loss risk is within acceptable clinical range. Continue current protocol with quarterly monitoring.",
  },
  MODERATE: {
    label: "Moderate Risk",
    color: "text-amber-600",
    bar: "bg-amber-400",
    explanation:
      "Protein adequacy or recovery environment is suboptimal relative to your GLP-1 dose stage. A sarcopenic trajectory is possible without intervention. Supplementation and structured resistance training are recommended.",
  },
  HIGH: {
    label: "High Risk",
    color: "text-red-600",
    bar: "bg-red-500",
    explanation:
      "Significant lean mass loss risk detected. Current protein intake, GI symptom burden, and/or anabolic recovery conditions are not meeting the threshold required to protect skeletal muscle at your current GLP-1 dose. Immediate protocol review is indicated.",
  },
};

export default function HomePage() {
  const [weight, setWeight] = useState("");
  const [protein, setProtein] = useState("");
  const [selectedDrug, setSelectedDrug] = useState("");
  const [giSymptom, setGiSymptom] = useState("");
  const [sleepHours, setSleepHours] = useState(7);
  const [result, setResult] = useState<{
    leanScore: number;
    recoveryScore: number;
    composite: number;
    risk: RiskBand;
  } | null>(null);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState("");

  function handleCalculate() {
    setFormError("");
    const w = parseFloat(weight);
    const p = parseFloat(protein);
    const drug = GLP1_DRUGS.find((d) => d.label === selectedDrug);
    const gi = GI_SYMPTOMS.find((s) => s.label === giSymptom);

    if (!w || !p || !drug || !gi) {
      setFormError("Please complete all fields before calculating.");
      return;
    }

    const leanScore = computeLeanMassScore(w, p, drug.value, drug.max, gi.value);
    const recoveryScore = computeRecoveryScore(sleepHours);
    const composite = computeComposite(leanScore, recoveryScore);
    setResult({ leanScore, recoveryScore, composite, risk: getRisk(composite) });
  }

  async function handleEmailSubmit() {
    if (!email.includes("@")) return;
    if (!result) return;
    setFormError("");
    try {
      const res = await fetch("/api/protocol-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          score: result.composite,
          leanScore: result.leanScore,
          recoveryScore: result.recoveryScore,
          risk: result.risk,
        }),
      });
      if (!res.ok) throw new Error("Send failed");
      setSubmitted(true);
    } catch {
      setFormError("Could not send your report. Please try again.");
    }
  }

  const sleepLabel =
    sleepHours >= 7.5 ? "Optimal" :
    sleepHours >= 6.5 ? "Mild deficit" :
    sleepHours >= 5.5 ? "Moderate deficit" :
    "Significant deficit";

  const sleepColor =
    sleepHours >= 7.5 ? "text-teal-600" :
    sleepHours >= 6.5 ? "text-amber-500" :
    sleepHours >= 5.5 ? "text-orange-500" :
    "text-red-500";

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
            The clinical standard for muscle preservation during GLP-1 therapy.
            Physician-designed protocols that calculate sarcopenia risk and deliver
            actionable protection targets.
          </p>
          <div className="flex flex-col gap-3 pt-2">
            {[
              "Real-time sarcopenia risk scoring",
              "Personalised protein & fiber targets",
              "Evidence-based supplement guidance",
              "Continuous adherence monitoring",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2 text-slate-600 text-sm">
                <div className="w-4 h-4 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
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
              <p className="text-xs text-slate-400 mt-0.5">No account required · Clinical parameters · Results in seconds</p>
            </div>

            <div className="flex flex-col gap-4">

              {/* Weight */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-slate-600">Body weight (kg)</span>
                <input
                  type="number" min="30" max="300" placeholder="e.g. 85"
                  value={weight} onChange={(e) => setWeight(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </label>

              {/* Protein */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-slate-600">Daily protein intake (g)</span>
                <input
                  type="number" min="0" max="400" placeholder="e.g. 80"
                  value={protein} onChange={(e) => setProtein(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </label>

              {/* GLP-1 dropdown */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-slate-600">Current GLP-1 agent & dose</span>
                <select
                  value={selectedDrug} onChange={(e) => setSelectedDrug(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                >
                  <option value="">Select agent and dose</option>
                  <optgroup label="Semaglutide">
                    {GLP1_DRUGS.filter(d => d.label.includes("Semaglutide")).map(d => (
                      <option key={d.label} value={d.label}>{d.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Tirzepatide (dual GIP/GLP-1)">
                    {GLP1_DRUGS.filter(d => d.label.includes("Tirzepatide")).map(d => (
                      <option key={d.label} value={d.label}>{d.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Liraglutide">
                    {GLP1_DRUGS.filter(d => d.label.includes("Liraglutide")).map(d => (
                      <option key={d.label} value={d.label}>{d.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Dulaglutide">
                    {GLP1_DRUGS.filter(d => d.label.includes("Dulaglutide")).map(d => (
                      <option key={d.label} value={d.label}>{d.label}</option>
                    ))}
                  </optgroup>
                </select>
              </label>

              {/* GI symptoms */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-slate-600">GI symptoms on current dose</span>
                <select
                  value={giSymptom} onChange={(e) => setGiSymptom(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                >
                  <option value="">Select symptom burden</option>
                  {GI_SYMPTOMS.map(s => (
                    <option key={s.label} value={s.label}>{s.label}</option>
                  ))}
                </select>
                <span className="text-xs text-slate-400">GI burden directly impairs nutrient absorption and protein adequacy</span>
              </label>

              {/* Sleep SLIDER */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600">
                    Anabolic Recovery Environment — sleep duration
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-900">{sleepHours}h</span>
                    <span className={`text-xs font-medium ${sleepColor}`}>{sleepLabel}</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="4" max="9" step="0.5"
                  value={sleepHours}
                  onChange={(e) => setSleepHours(parseFloat(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer accent-teal-600 bg-slate-100"
                />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>4h</span>
                  <span>6h</span>
                  <span>7.5h</span>
                  <span>9h</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Nocturnal GH and IGF-1 secretion — the primary anabolic signals for muscle protein synthesis — are sleep-dependent. Chronic deficit elevates cortisol and impairs recovery. Factored as a recovery modifier, not a diagnostic criterion.
                </p>
              </div>
            </div>

            {formError && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</p>
            )}

            <button
              onClick={handleCalculate}
              className="w-full bg-teal-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-teal-700 active:scale-95 transition-all"
            >
              Calculate my risk score
            </button>

            {/* Results */}
            {result && (
              <div className="flex flex-col gap-4 border-t border-slate-100 pt-4">

                {/* Composite score */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">MyoGuard Composite Score</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-slate-900">{result.composite}</span>
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

                {/* Composite bar */}
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all ${RISK_META[result.risk].bar}`}
                    style={{ width: `${result.composite}%` }}
                  />
                </div>

                {/* Sub-scores */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3 flex flex-col gap-1">
                    <p className="text-xs text-slate-500">Lean Mass Risk</p>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-xl font-bold ${
                        result.leanScore >= 70 ? "text-teal-600" :
                        result.leanScore >= 40 ? "text-amber-600" : "text-red-600"
                      }`}>{result.leanScore}</span>
                      <span className="text-xs text-slate-400">/100</span>
                    </div>
                    <p className="text-xs text-slate-400">Protein + dose + GI</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 flex flex-col gap-1">
                    <p className="text-xs text-slate-500">Recovery Environment</p>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-xl font-bold ${
                        result.recoveryScore >= 70 ? "text-teal-600" :
                        result.recoveryScore >= 40 ? "text-amber-600" : "text-red-600"
                      }`}>{result.recoveryScore}</span>
                      <span className="text-xs text-slate-400">/100</span>
                    </div>
                    <p className="text-xs text-slate-400">GH/IGF-1 context</p>
                  </div>
                </div>

                {/* Explanation */}
                <p className="text-xs text-slate-600 leading-relaxed">
                  {RISK_META[result.risk].explanation}
                </p>

                {/* Blurred protocol */}
                <div className="relative rounded-xl border border-slate-200 overflow-hidden">
                  <div className="p-4 flex flex-col gap-2 select-none pointer-events-none">
                    <p className="text-xs font-semibold text-slate-700">Clinical Protocol — Full Report</p>
                    {[
                      "Protein target: __ g/day (1.6 g/kg adjusted for dose stage)",
                      "Fibre target: __ g/day (GI-symptom staged)",
                      "Hydration baseline: __ ml/day",
                      "Supplement stack: Whey · Creatine · Vitamin D · Omega-3",
                      "Resistance training: __ sessions/week",
                      "Monitoring labs: Ferritin · B12 · Zinc · Magnesium · Thiamine",
                      "GI management protocol: __ (based on symptom profile)",
                      "Sleep optimisation: __ (based on recovery score)",
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
                      type="email" placeholder="Enter your email address"
                      value={email} onChange={(e) => setEmail(e.target.value)}
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
          <div className="flex gap-4">
            <a href="/privacy" className="hover:text-slate-600 transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-slate-600 transition-colors">Terms of Use</a>
            <span>myoguard.health</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
