"use client";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import posthog from "posthog-js";
import { isAnalyticsEnabled, AnalyticsEvents } from "@/src/lib/posthog";

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

const SYMPTOM_OPTIONS = [
  { label: "Constipation",     penalty: 8  },
  { label: "Nausea",           penalty: 5  },
  { label: "Vomiting",         penalty: 18 },
  { label: "Muscle weakness",  penalty: 6  },
  { label: "Fatigue",          penalty: 4  },
  { label: "Reduced appetite", penalty: 10 },
  { label: "Bloating",         penalty: 8  },
  { label: "Gastroparesis",    penalty: 20 },
];

const ACTIVITY_OPTIONS = [
  { label: "Sedentary", subtitle: "Little/no exercise", bonus: 0  },
  { label: "Moderate",  subtitle: "3-5x per week",      bonus: 5  },
  { label: "Active",    subtitle: "Daily training",      bonus: 10 },
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
  giPenalty: number,
  activityBonus: number,
): number {
  const target = weightKg * 1.6;
  const adequacy = Math.min(proteinG / target, 1);
  const dosePenalty = Math.min(drugValue / drugMax, 1) * 20;
  const raw = adequacy * 100 - dosePenalty - giPenalty + activityBonus;
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
    label: "Elevated SRI Risk",
    color: "text-red-600",
    bar: "bg-red-500",
    explanation:
      "Significant lean mass loss risk detected. Current protein intake, GI symptom burden, and/or anabolic recovery conditions are not meeting the threshold required to protect skeletal muscle at your current GLP-1 dose. Immediate protocol review is indicated.",
  },
};

export default function HomePage() {
  const { isSignedIn } = useUser();
  const [weight,           setWeight]           = useState("");
  const [protein,          setProtein]          = useState("");
  const [selectedDrug,     setSelectedDrug]     = useState("");
  const [symptoms,         setSymptoms]         = useState<string[]>([]);
  const [activityLevel,    setActivityLevel]    = useState<string | null>(null);
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);
  const [sleepHours,       setSleepHours]       = useState(7);
  const [weightUnit,       setWeightUnit]       = useState<'kg' | 'lbs'>('kg');
  const [result, setResult] = useState<{
    leanScore: number;
    recoveryScore: number;
    composite: number;
    risk: RiskBand;
  } | null>(null);
  const [email,     setEmail]     = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState("");

  // Never track: names, emails, SRI values,
  // symptoms, protein inputs, weight,
  // medical values, or any patient clinical data.
  // Only track platform usage events.
  useEffect(() => {
    if (isAnalyticsEnabled) posthog.capture(AnalyticsEvents.LANDING_PAGE_VIEWED);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleCalculate() {
    setFormError("");
    if (!disclaimerChecked) {
      setFormError("Please confirm you understand this tool provides educational information only.");
      document.getElementById('disclaimer-checkbox')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const rawW   = parseFloat(weight);
    const w      = weightUnit === 'lbs'
      ? Math.round(rawW * 0.453592 * 10) / 10
      : rawW;
    const p    = parseFloat(protein);
    const drug = GLP1_DRUGS.find((d) => d.label === selectedDrug);

    if (!rawW || !p || !drug || !activityLevel) {
      setFormError("Please complete all required fields before generating your SRI.");
      return;
    }

    const LIMITS = {
      weight:  { min: 30,  max: 250 },
      protein: { min: 0,   max: 350 },
    };
    const MAX_PROTEIN_PER_KG = 4.0;

    if (weightUnit === 'lbs') {
      if (rawW < 66 || rawW > 551) {
        setFormError(`Body weight must be between 66 lbs and 551 lbs.`);
        return;
      }
    } else {
      if (w < LIMITS.weight.min || w > LIMITS.weight.max) {
        setFormError(`Body weight must be between ${LIMITS.weight.min}kg and ${LIMITS.weight.max}kg.`);
        return;
      }
    }
    if (p < LIMITS.protein.min || p > LIMITS.protein.max) {
      setFormError(`Daily protein intake must be between ${LIMITS.protein.min}g and ${LIMITS.protein.max}g.`);
      return;
    }
    if (w > 0 && p / w > MAX_PROTEIN_PER_KG) {
      const weightDisplay = weightUnit === 'lbs' ? `${rawW} lbs` : `${w}kg`;
      setFormError(
        `Protein intake of ${p}g/day appears unusually high for ${weightDisplay} body weight (${(p / w).toFixed(1)}g/kg). Please verify your entries.`
      );
      return;
    }

    const giPenalty = Math.min(
      SYMPTOM_OPTIONS
        .filter((s) => symptoms.includes(s.label))
        .reduce((sum, s) => sum + s.penalty, 0),
      25,
    );
    const actBonus   = ACTIVITY_OPTIONS.find((a) => a.label === activityLevel)?.bonus ?? 0;
    const leanScore  = computeLeanMassScore(w, p, drug.value, drug.max, giPenalty, actBonus);
    const recoveryScore = computeRecoveryScore(sleepHours);
    const composite  = leanScore;
    const risk = getRisk(composite);
    setResult({ leanScore, recoveryScore, composite, risk });
    if (isAnalyticsEnabled) {
      posthog.capture(AnalyticsEvents.SRI_GENERATED, { risk_band: risk });
    }
  }

  async function handleEmailSubmit() {
    if (!email.includes("@")) return;
    if (!result) return;
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
      if (res.ok) {
        setSubmitted(true);
        if (isAnalyticsEnabled) posthog.capture(AnalyticsEvents.EMAIL_CAPTURE_SUBMITTED, { source: 'landing_results_gate' });
      } else {
        setFormError("Failed to send. Please try again.");
      }
    } catch {
      setFormError("Network error. Please try again.");
    }
  }

  const sleepLabel =
    sleepHours >= 7.5 ? "Optimal for muscle recovery" :
    sleepHours >= 6.5 ? "Mild recovery deficit" :
    sleepHours >= 5.5 ? "Moderate recovery deficit" :
    "Significant recovery impairment";

  const sleepColor =
    sleepHours >= 7.5 ? "text-teal-600" :
    sleepHours >= 6.5 ? "text-amber-500" :
    sleepHours >= 5.5 ? "text-orange-500" :
    "text-red-500";

  // kg-equivalent of whatever the user entered (used in results section + validation)
  const wKg = weightUnit === 'lbs'
    ? Math.round(parseFloat(weight || '0') * 0.453592 * 10) / 10
    : parseFloat(weight || '0');

  // Progress indicator — 4 required fields (symptoms optional)
  const fieldsComplete = [!!weight, !!protein, !!selectedDrug, !!activityLevel].filter(Boolean).length;
  const totalFields = 4;
  const canCalculate = !!(weight && protein && selectedDrug && activityLevel);

  return (
    <main className="form-dark min-h-screen" style={{ background: '#080C14', color: '#F1F5F9' }}>

      {/* Nav */}
      <nav className="border-b border-[#1A2744] max-w-6xl mx-auto flex justify-between items-center px-5 min-h-[56px]">
        <div className="flex items-center gap-1">
          <span className="text-xl font-bold text-slate-100">Myo</span>
          <span className="text-xl font-bold text-teal-400">Guard</span>
        </div>
        <a href="/sign-in" className="text-sm text-slate-400 hover:text-white transition-colors flex-shrink-0 whitespace-nowrap">
          Sign in
        </a>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-8 lg:py-14 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12 items-start">

        {/* LEFT */}
        <div className="flex flex-col gap-5 pt-2 lg:pt-4">
          <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full w-fit" style={{ background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.2)', color: '#2DD4BF' }}>
            Physician-Led&nbsp;•&nbsp;Evidence-Based&nbsp;•&nbsp;Clinical Decision Support
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold leading-tight" style={{ color: '#F1F5F9' }}>
            Protect Muscle While Losing Weight on GLP-1 Therapy
          </h1>
          <p className="text-base text-slate-400 leading-relaxed max-w-md">
            For patients using GLP-1 and incretin-based weight-loss therapy.
          </p>
          <p className="text-sm text-slate-400 leading-relaxed max-w-md">
            Weight loss should not come at the expense of lean tissue. MyoGuard provides
            physician-guided muscle preservation support through the Sarcopenia Risk Index (SRI).
          </p>
          <div className="flex flex-col items-start gap-3 pt-1">
            <a
              href="#sri-form"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("sri-form")?.scrollIntoView({ behavior: "smooth" });
                if (isAnalyticsEnabled) posthog.capture(AnalyticsEvents.GET_STARTED_CLICKED, { location: "hero" });
              }}
              className="bg-teal-600 text-white px-6 py-3.5 rounded-xl text-sm font-semibold hover:bg-teal-700 transition-colors cursor-pointer"
            >
              Generate My Preliminary SRI →
            </a>
            <p className="text-xs text-slate-400">
              No account required&nbsp;•&nbsp;Takes about 60 seconds
            </p>
            <p className="text-xs text-slate-400 border-t border-[#1A2744] pt-3 leading-relaxed">
              Built on:&nbsp;<span className="font-medium text-slate-300">STEP Trials</span>&nbsp;•&nbsp;<span className="font-medium text-slate-300">EWGSOP2</span>&nbsp;•&nbsp;<span className="font-medium text-slate-300">PROT-AGE</span>&nbsp;•&nbsp;<span className="font-medium text-slate-300">Peer-Reviewed Evidence</span>
            </p>
          </div>

        </div>

        {/* RIGHT — Calculator */}
        <div id="sri-form" className="flex flex-col gap-4">
          <div className="rounded-2xl p-6 flex flex-col gap-5" style={{ background: '#0D1421', border: '1px solid #1A2744' }}>
            <div>
              <h2 className="text-base font-semibold" style={{ color: '#F1F5F9' }}>Muscle Protection Assessment</h2>
              <p className="text-xs text-slate-400 mt-0.5">Powered by the Sarcopenia Risk Index (SRI)</p>

              {/* Progress indicator */}
              <div className="flex items-center gap-2 mt-3">
                <div className="flex gap-1">
                  {Array.from({ length: totalFields }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 w-6 rounded-full transition-all ${
                        i < fieldsComplete ? "bg-teal-500" : "bg-[#1A2744]"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-slate-400">
                  {fieldsComplete < totalFields
                    ? `${totalFields - fieldsComplete} field${totalFields - fieldsComplete > 1 ? "s" : ""} remaining`
                    : "Ready to generate SRI"}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-4">

              {/* Body metrics section */}
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                Body metrics
              </p>

              {/* Weight */}
              <div className="flex flex-col gap-1.5">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label htmlFor="sri-weight" className="text-xs font-medium text-slate-400">
                    Body weight ({weightUnit})
                  </label>
                  {/* kg / lbs toggle */}
                  <div style={{
                    display:      'flex',
                    borderRadius: '999px',
                    border:       '1px solid #1A2744',
                    overflow:     'hidden',
                    background:   '#0D1421',
                  }}>
                    {(['kg', 'lbs'] as const).map((unit) => (
                      <button
                        key={unit}
                        type="button"
                        onClick={() => { setWeightUnit(unit); setWeight(''); }}
                        style={{
                          padding:    '3px 10px',
                          fontSize:   '11px',
                          fontWeight: unit === weightUnit ? 700 : 400,
                          background: unit === weightUnit ? '#2DD4BF' : 'transparent',
                          color:      unit === weightUnit ? '#080C14' : '#94A3B8',
                          border:     'none',
                          cursor:     'pointer',
                          lineHeight: '1.6',
                          transition: 'background 0.15s, color 0.15s',
                        }}
                      >
                        {unit}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  id="sri-weight"
                  type="number"
                  min={weightUnit === 'kg' ? 30 : 66}
                  max={weightUnit === 'kg' ? 250 : 551}
                  step={weightUnit === 'kg' ? 0.1 : 1}
                  placeholder={weightUnit === 'kg' ? 'e.g. 85' : 'e.g. 187'}
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="border border-[#1A2744] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Protein */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-slate-400">Daily protein intake (current)</span>
                <input
                  type="number" min={0} max={350} step={1} placeholder="e.g. 80"
                  value={protein} onChange={(e) => setProtein(e.target.value)}
                  className="border border-[#1A2744] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <span className="text-xs text-slate-400 leading-relaxed">
                  Enter your current average daily intake. Used to estimate adequacy against your clinical protein floor.
                </span>
              </label>

              {/* GLP-1 therapy section */}
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-2">
                GLP-1 therapy
              </p>

              {/* GLP-1 dropdown */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-slate-400">Current GLP-1 agent & dose</span>
                <select
                  value={selectedDrug} onChange={(e) => setSelectedDrug(e.target.value)}
                  className="border border-[#1A2744] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500" style={{ background: '#1e293b' }}
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

              {/* Symptoms & lifestyle section */}
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-2">
                Symptoms &amp; lifestyle
              </p>

              {/* GI symptoms — multi-select grid */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-slate-400">GI symptoms on current dose</span>
                <div className="grid grid-cols-2 gap-2">
                  {SYMPTOM_OPTIONS.map((s) => {
                    const selected = symptoms.includes(s.label);
                    return (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() =>
                          setSymptoms((prev) =>
                            prev.includes(s.label)
                              ? prev.filter((x) => x !== s.label)
                              : [...prev, s.label],
                          )
                        }
                        style={{
                          padding:          '8px 12px',
                          borderRadius:     '8px',
                          border:           selected ? '1px solid #2DD4BF' : '1px solid #1A2744',
                          background:       selected ? '#2DD4BF' : '#0D1421',
                          color:            selected ? '#080C14' : '#94A3B8',
                          fontSize:         '12px',
                          fontWeight:       selected ? 600 : 400,
                          textAlign:        'left' as const,
                          cursor:           'pointer',
                          transition:       'all 0.15s ease',
                        }}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
                {symptoms.length === 0 && (
                  <span className="text-xs text-slate-400">Select none if no symptoms</span>
                )}
                <span className="text-xs text-slate-400">
                  GI burden directly impairs nutrient absorption and protein adequacy
                </span>
              </div>

              {/* Activity level cards */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-slate-400">Activity level <span className="text-red-400">*</span></span>
                <div className="grid grid-cols-3 gap-2">
                  {ACTIVITY_OPTIONS.map((a) => {
                    const selected = activityLevel === a.label;
                    return (
                      <button
                        key={a.label}
                        type="button"
                        onClick={() => setActivityLevel(a.label)}
                        style={{
                          display:        'flex',
                          flexDirection:  'column',
                          alignItems:     'center',
                          gap:            '4px',
                          padding:        '12px 8px',
                          borderRadius:   '12px',
                          border:         selected ? '1px solid #2DD4BF' : '1px solid #1A2744',
                          background:     selected ? '#2DD4BF' : '#0D1421',
                          cursor:         'pointer',
                          textAlign:      'center' as const,
                          transition:     'all 0.15s ease',
                        }}
                      >
                        <span style={{
                          fontSize:   '12px',
                          fontWeight: 600,
                          color:      selected ? '#080C14' : '#F1F5F9',
                        }}>
                          {a.label}
                        </span>
                        <span style={{
                          fontSize:   '11px',
                          lineHeight: '1.4',
                          color:      selected ? 'rgba(8,12,20,0.65)' : '#94A3B8',
                        }}>
                          {a.subtitle}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Recovery environment section */}
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-2">
                Recovery environment
              </p>

              {/* Sleep SLIDER */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">
                    Recovery Environment Indicator (informational)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-white">{sleepHours}h</span>
                    <span className={`text-xs font-medium ${sleepColor}`}>{sleepLabel}</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="3" max="14" step="0.5"
                  value={sleepHours}
                  onChange={(e) => setSleepHours(parseFloat(e.target.value))}
                  className="w-full sri-sleep-slider"
                />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>3h</span>
                  <span>6h</span>
                  <span>9h</span>
                  <span>14h</span>
                </div>
                <p className="text-xs text-slate-400">Typical adult range: 5–9 hours</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Sleep duration is displayed as a recovery context indicator. Nocturnal GH and IGF-1 secretion support muscle protein synthesis — adequate sleep optimises your protocol outcomes. This parameter is not incorporated into the sarcopenia risk score.
                </p>
              </div>
            </div>

            {/* Educational Disclaimer */}
            <div
              id="disclaimer-checkbox"
              style={{
                border: canCalculate && !disclaimerChecked
                  ? "1px solid rgba(245,158,11,0.5)"
                  : "1px solid transparent",
                borderRadius: "8px",
                padding: "8px",
                transition: "border-color 0.2s ease",
              }}
            >
            <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 mt-2">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <div className="relative flex-shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={disclaimerChecked}
                    onChange={(e) => setDisclaimerChecked(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    disclaimerChecked
                      ? "bg-teal-600 border-teal-600"
                      : "bg-white border-amber-400"
                  }`}>
                    {disclaimerChecked && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-amber-800">
                    Required before generating SRI
                  </span>
                  <span className="text-xs text-amber-700 leading-relaxed">
                    I understand this tool provides educational nutritional
                    reference information only. It does not constitute medical
                    advice or create a physician-patient relationship. I will
                    review these recommendations with my prescribing physician.
                  </span>
                </div>
              </label>
            </div>
            </div>

            {formError && (
              <div style={{
                background: "rgba(251,113,133,0.1)",
                border: "1px solid rgba(251,113,133,0.3)",
                borderRadius: "8px",
                padding: "10px 14px",
                marginBottom: "12px",
                fontSize: "13px",
                color: "#FB7185",
                textAlign: "center",
              }}>
                {formError}
              </div>
            )}

            {/* Generate CTA */}
            <button
              onClick={handleCalculate}
              disabled={!canCalculate}
              className="w-full py-3.5 rounded-xl text-sm flex items-center justify-center"
              style={{
                fontWeight:  700,
                background:  canCalculate ? '#2DD4BF' : '#f1f5f9',
                color:       canCalculate ? '#080C14' : '#94A3B8',
                cursor:      canCalculate ? 'pointer' : 'not-allowed',
                transition:  'background 0.2s ease, opacity 0.2s ease',
                border:      'none',
              }}
              onMouseEnter={(e) => {
                if (canCalculate) (e.currentTarget as HTMLButtonElement).style.background = '#0D9488';
              }}
              onMouseLeave={(e) => {
                if (canCalculate) (e.currentTarget as HTMLButtonElement).style.background = '#2DD4BF';
              }}
            >
              {canCalculate
                ? "Generate My Preliminary SRI →"
                : "Complete all fields to generate Preliminary SRI"}
            </button>

            {/* Results */}
            {result && (
              <div className="flex flex-col gap-4 border-t border-[#1A2744] pt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">

                {/* Composite score — dramatic card */}
                <div className="rounded-2xl p-4 flex items-center justify-between" style={{ background: '#0D1421' }}>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">MyoGuard Composite Index</p>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-6xl font-bold tracking-tight ${
                        result.risk === "LOW" ? "text-teal-600" :
                        result.risk === "MODERATE" ? "text-amber-600" :
                        "text-red-600"
                      }`}>
                        {result.composite}
                      </span>
                      <span className="text-slate-400 text-lg">/100</span>
                    </div>
                  </div>
                  <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
                    result.risk === "LOW"
                      ? "bg-teal-100 text-teal-700"
                      : result.risk === "MODERATE"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                  }`}>
                    {RISK_META[result.risk].label}
                  </div>
                </div>

                {/* Gradient risk bar */}
                <div className="flex flex-col gap-1">
                  <div className="w-full h-3 rounded-full overflow-hidden relative" style={{ background: '#1A2744' }}>
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: "linear-gradient(to right, #ef4444 0%, #f59e0b 40%, #14b8a6 70%, #0d9488 100%)",
                      }}
                    />
                    <div
                      className="absolute top-0 right-0 h-full rounded-r-full transition-all duration-700"
                      style={{ width: `${100 - result.composite}%`, background: '#080C14' }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>0 — Elevated SRI Risk</span>
                    <span>40</span>
                    <span>70</span>
                    <span>100 — Low Risk</span>
                  </div>
                </div>

                {/* Contributing Factors 2×2 */}
                {(() => {
                  const proteinTarget = wKg > 0 ? wKg * 1.6 : 0;
                  const proteinPct    = proteinTarget > 0 ? (parseFloat(protein) / proteinTarget) * 100 : 0;
                  const giPenalty     = Math.min(
                    SYMPTOM_OPTIONS.filter((s) => symptoms.includes(s.label))
                      .reduce((sum, s) => sum + s.penalty, 0),
                    25,
                  );
                  const factors = [
                    {
                      label: "Protein adequacy",
                      value: proteinTarget > 0 ? `${Math.round(proteinPct)}%` : "—",
                      tier:  proteinPct >= 90 ? "teal" : proteinPct >= 75 ? "amber" : "red",
                    },
                    {
                      label: "GI burden",
                      value: giPenalty === 0 ? "None" : giPenalty <= 14 ? "Moderate" : "High",
                      tier:  giPenalty === 0 ? "teal" : giPenalty <= 14 ? "amber" : "red",
                    },
                    {
                      label: "Recovery environment",
                      value: `${sleepHours}h sleep`,
                      tier:  sleepHours >= 7.5 ? "teal" : sleepHours >= 6 ? "amber" : "red",
                    },
                    {
                      label: "Activity level",
                      value: activityLevel ?? "—",
                      tier:  activityLevel === "Active" ? "teal" : activityLevel === "Moderate" ? "amber" : "red",
                    },
                  ] as const;
                  const palette = {
                    teal:  { bg: "bg-teal-50",  border: "border-teal-100", label: "text-teal-600",  value: "text-teal-700"  },
                    amber: { bg: "bg-amber-50", border: "border-amber-100",label: "text-amber-600", value: "text-amber-700" },
                    red:   { bg: "bg-red-50",   border: "border-red-100",  label: "text-red-600",   value: "text-red-700"   },
                  };
                  return (
                    <div className="grid grid-cols-2 gap-2">
                      {factors.map((f) => {
                        const c = palette[f.tier];
                        return (
                          <div key={f.label} className={`rounded-xl border p-3 ${c.bg} ${c.border}`}>
                            <p className={`text-xs font-medium mb-1 ${c.label}`}>{f.label}</p>
                            <p className={`text-sm font-bold ${c.value}`}>{f.value}</p>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Sub-scores */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl p-3 flex flex-col gap-1" style={{ background: '#0D1421' }}>
                    <p className="text-xs text-slate-400">Lean Mass Risk Index</p>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-xl font-bold ${
                        result.leanScore >= 70 ? "text-teal-600" :
                        result.leanScore >= 40 ? "text-amber-600" : "text-red-600"
                      }`}>{result.leanScore}</span>
                      <span className="text-xs text-slate-400">/100</span>
                    </div>
                    <p className="text-xs text-slate-400">Protein + dose + GI</p>
                  </div>
                  <div className="rounded-xl p-3 flex flex-col gap-1" style={{ background: '#0D1421' }}>
                    <p className="text-xs text-slate-400">Recovery Indicator</p>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-xl font-bold ${sleepColor}`}>{sleepHours}h</span>
                    </div>
                    <p className={`text-xs font-medium ${sleepColor}`}>{sleepLabel}</p>
                  </div>
                </div>

                {/* Clinical alert box */}
                <div className={`rounded-xl border p-4 ${
                  result.risk === "LOW"
                    ? "bg-teal-50 border-teal-100"
                    : result.risk === "MODERATE"
                    ? "bg-amber-50 border-amber-100"
                    : "bg-red-50 border-red-100"
                }`}>
                  <p className={`text-xs font-semibold mb-1 uppercase tracking-wider ${
                    result.risk === "LOW" ? "text-teal-700" :
                    result.risk === "MODERATE" ? "text-amber-700" :
                    "text-red-700"
                  }`}>
                    Clinical Assessment
                  </p>
                  <p className={`text-sm leading-relaxed ${
                    result.risk === "LOW" ? "text-teal-800" :
                    result.risk === "MODERATE" ? "text-amber-800" :
                    "text-red-800"
                  }`}>
                    {RISK_META[result.risk].explanation}
                  </p>
                </div>

                {/* Conversion bridge — unauthenticated only */}
                {!isSignedIn && (
                  <div style={{
                    background: '#0D1421',
                    border: '1px solid rgba(45,212,191,0.35)',
                    borderRadius: '16px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}>
                    <p style={{ fontSize: '14px', fontWeight: '700', color: '#F1F5F9' }}>
                      This is your Preliminary SRI.
                    </p>
                    <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: '1.6' }}>
                      Create your account to unlock your full Clinical SRI Analysis — including treatment stage calibration, functional muscle tracking, and weekly monitoring.
                    </p>
                    <a
                      href="/sign-up"
                      onClick={() => { if (isAnalyticsEnabled) posthog.capture(AnalyticsEvents.GET_STARTED_CLICKED, { location: "results_cta" }); }}
                      style={{
                        display: 'block',
                        background: '#2DD4BF',
                        color: '#080C14',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        fontSize: '13px',
                        fontWeight: '700',
                        textAlign: 'center',
                        textDecoration: 'none',
                      }}
                    >
                      Activate Full Clinical Protocol →
                    </a>
                  </div>
                )}

                {/* Blurred protocol */}
                <div className="relative rounded-xl overflow-hidden" style={{ border: '1px solid #1A2744' }}>
                  <div className="p-4 flex flex-col gap-2 select-none pointer-events-none">
                    <p className="text-xs font-semibold text-slate-300">Clinical Protocol — Full Report</p>
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
                  <div className="absolute inset-0 backdrop-blur-sm flex flex-col items-center justify-center gap-2 p-4" style={{ background: 'rgba(8,12,20,0.85)' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.2)' }}>
                      <svg className="w-4 h-4" style={{ color: '#2DD4BF' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold text-white text-center">Full protocol locked</p>
                    <p className="text-xs text-slate-400 text-center">Enter your email to unlock the complete clinical report.</p>
                  </div>
                </div>

                {/* Email gate / signed-in CTA */}
                {isSignedIn ? (
                  <div className="flex flex-col gap-3 bg-teal-50 border border-teal-100 rounded-2xl p-5">
                    <p className="text-sm font-semibold text-teal-800">
                      You are signed in
                    </p>
                    <p className="text-xs text-teal-600">
                      Your protocol report has been sent to your email. Save this assessment to your dashboard to track progress over time.
                    </p>
                    <a
                      href="/dashboard/assessment"
                      className="w-full bg-teal-600 text-white py-3 rounded-xl text-sm font-medium text-center hover:bg-teal-700 transition-colors"
                    >
                      Go to my dashboard →
                    </a>
                  </div>
                ) : !submitted ? (
                  <div className="flex flex-col gap-3 rounded-2xl p-5" style={{ background: '#0D1421' }}>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Unlock your full MyoGuard Protocol
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Receive your complete clinical report, personalised targets, and supplement stack.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {[
                        "Exact protein target in grams for your weight",
                        "GI-staged fibre protocol",
                        "Personalised supplement stack",
                        "Monitoring lab recommendations",
                      ].map((b) => (
                        <div key={b} className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0">
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span className="text-xs text-slate-300">{b}</span>
                        </div>
                      ))}
                    </div>
                    <input
                      type="email"
                      placeholder="Enter your email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="border border-slate-700 bg-slate-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <button
                      onClick={handleEmailSubmit}
                      className="w-full bg-teal-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-teal-500 transition-colors flex items-center justify-center gap-2"
                    >
                      Send my protocol report
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </button>
                    <div className="flex items-center justify-center gap-4">
                      <a
                        href="/sign-up"
                        className="text-xs text-teal-400 hover:underline"
                        onClick={() => { if (isAnalyticsEnabled) posthog.capture(AnalyticsEvents.GET_STARTED_CLICKED, { location: "email_gate" }); }}
                      >
                        Create free account instead →
                      </a>
                      <span className="text-slate-600 text-xs">·</span>
                      <span className="text-xs text-slate-400">No spam. Unsubscribe anytime.</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-teal-50 border border-teal-100 rounded-2xl p-5 text-center flex flex-col gap-2">
                    <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center mx-auto">
                      <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-teal-800">
                      Protocol report sent to {email}
                    </p>
                    <p className="text-xs text-teal-600">
                      Check your inbox — full clinical report included.
                    </p>
                    <p className="text-xs text-teal-700 mt-1">
                      or{" "}
                      <a href="/sign-up" className="font-medium underline hover:text-teal-800">
                        create a free account
                      </a>{" "}
                      to track progress over time
                    </p>
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

      {/* How MyoGuard Helps — features moved below fold */}
      <section className="border-t border-[#1A2744] py-10">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-medium mb-6 text-center">
            How MyoGuard Helps
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {[
              {
                title: "Real-time sarcopenia risk",
                desc: "SRI generated against your GLP-1 dose stage and clinical protein floor",
              },
              {
                title: "Personalised protein targets",
                desc: "Protein and fibre guidance calibrated to your weight, dose, and GI burden",
              },
              {
                title: "Evidence-based supplement guidance",
                desc: "Protocol stack grounded in peer-reviewed nutrition science",
              },
              {
                title: "Continuous adherence monitoring",
                desc: "Weekly check-ins with longitudinal tracking of your muscle preservation indicators",
              },
            ].map((item) => (
              <div key={item.title} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-teal-600" />
                  </div>
                  <p className="text-sm font-semibold text-slate-200">{item.title}</p>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed pl-6">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


    </main>
  );
}
