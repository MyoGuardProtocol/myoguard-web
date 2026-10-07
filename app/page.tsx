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

// SRI Containment C1 (K2): the public Preliminary SRI produces no quantitative
// or categorical output. The former Preliminary composite, lean and recovery
// values, the risk band and its colours and explanatory copy are removed;
// submitting the form validates the entries and shows the Founder-approved
// interim copy only. Nothing is computed, stored or transmitted from it.

export default function HomePage() {
  // `isLoaded` matters as much as `isSignedIn` here. Until Clerk resolves,
  // `isSignedIn` is undefined, so `!isSignedIn` is true and a signed-in visitor
  // briefly saw the anonymous conversion bridge and the email gate before they
  // swapped. Every auth-dependent branch below waits for `isLoaded`.
  const { isSignedIn, isLoaded } = useUser();
  const [weight,           setWeight]           = useState("");
  const [protein,          setProtein]          = useState("");
  const [selectedDrug,     setSelectedDrug]     = useState("");
  const [symptoms,         setSymptoms]         = useState<string[]>([]);
  const [activityLevel,    setActivityLevel]    = useState<string | null>(null);
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);
  const [sleepHours,       setSleepHours]       = useState(7);
  const [weightUnit,       setWeightUnit]       = useState<'kg' | 'lbs'>('kg');
  const [received,  setReceived]  = useState(false);
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
      setFormError("Please complete all required fields.");
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

    // SRI Containment C1 (K2, K3): no value or band is derived from the
    // entries, and the analytics event carries no property.
    setReceived(true);
    if (isAnalyticsEnabled) {
      posthog.capture(AnalyticsEvents.SRI_GENERATED);
    }
  }

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
        <div className="flex items-center gap-5 flex-shrink-0">
          {/* Entry point into the patient education surface.
              Before C-FUNNEL-2 nothing in the application linked to /learn: it
              was reachable only from the sitemap, so every visitor arrived
              from outside or not at all. A plain nav link is the whole of the
              fix — no banner, no interstitial, no interruption of the SRI. */}
          <a href="/learn" className="text-sm text-slate-400 hover:text-white transition-colors whitespace-nowrap">
            Patient Education
          </a>
          <a href="/sign-in" className="text-sm text-slate-400 hover:text-white transition-colors whitespace-nowrap">
            Sign in
          </a>
        </div>
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
              →
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
                    : ""}
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
                  Enter your current average daily intake.
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
                  Sleep duration is displayed as a recovery context indicator. Nocturnal GH and IGF-1 secretion support muscle protein synthesis — adequate sleep optimises your protocol outcomes.
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
                ? "→"
                : "Complete all fields"}
            </button>

            {/* SRI Containment C1 (K2). Shown once the entries pass validation.
                Founder-approved interim copy, verbatim. No value, band, colour,
                sub-value or derived text is rendered. The action below is the
                account-creation / continuation action that already existed:
                sign-up for a visitor, the dashboard for a signed-in visitor. */}
            {received && (
              <div className="flex flex-col gap-4 border-t border-[#1A2744] pt-4">
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
                    Thank you — your responses have been received.
                  </p>
                  <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: '1.6' }}>
                    MyoGuard is a physician-led platform. Your muscle-health risk assessment is completed as part of a physician-reviewed process rather than generated automatically from this short questionnaire.
                  </p>
                  <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: '1.6' }}>
                    Continue to create your account and begin your physician-reviewed assessment.
                  </p>
                  {!isLoaded ? null : isSignedIn ? (
                    <a
                      href="/dashboard/assessment"
                      className="w-full bg-teal-600 text-white py-3 rounded-xl text-sm font-medium text-center hover:bg-teal-700 transition-colors"
                    >
                      Go to my dashboard →
                    </a>
                  ) : (
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
                  )}
                </div>
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
                desc: "SRI generated against your GLP-1 dose stage",
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
