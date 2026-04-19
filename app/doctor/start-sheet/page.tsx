"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────
type RiskLevel = "Low" | "Moderate" | "High";

// ── Animated counter hook ─────────────────────────────────────────────────────
function useAnimatedCounter(value: number, duration = 400) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const start = prev.current;
    const end = value;
    const startTime = performance.now();
    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(tick);
      else prev.current = end;
    }
    requestAnimationFrame(tick);
  }, [value, duration]);
  return display;
}

// ── Protocol logic ────────────────────────────────────────────────────────────
const PROTEIN_MULTIPLIER: Record<RiskLevel, number> = {
  Low: 1.2,
  Moderate: 1.5,
  High: 1.8,
};

function calcResistance(risk: RiskLevel): string {
  if (risk === "Low") return "2x / week";
  if (risk === "Moderate") return "3x / week";
  return "4–5x / week";
}

function calcSupplements(risk: RiskLevel): string[] {
  const base = ["Whey Protein", "Vitamin D", "Omega-3"];
  if (risk === "Moderate") return [...base, "Creatine", "Magnesium"];
  if (risk === "High") return [...base, "Creatine", "Magnesium", "HMB", "Zinc", "B12"];
  return base;
}

// ── Risk colour palette ───────────────────────────────────────────────────────
const RISK_STYLE: Record<RiskLevel, { border: string; text: string; activeBg: string }> = {
  Low:      { border: "border-emerald-800", text: "text-emerald-400", activeBg: "bg-emerald-600" },
  Moderate: { border: "border-amber-800",   text: "text-amber-400",   activeBg: "bg-amber-600"   },
  High:     { border: "border-red-800",     text: "text-red-400",     activeBg: "bg-red-600"     },
};

// ── Shared input class ────────────────────────────────────────────────────────
const INPUT =
  "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors";

// ── Component ─────────────────────────────────────────────────────────────────
export default function StartSheetPage() {
  const router = useRouter();

  const [patientName,  setPatientName]  = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [weightKg,     setWeightKg]     = useState("");
  const [age,          setAge]          = useState("");
  const [glp1Agent,    setGlp1Agent]    = useState("");
  const [riskLevel,    setRiskLevel]    = useState<RiskLevel>("Moderate");
  const [notes,        setNotes]        = useState("");
  const [ermEnabled,   setErmEnabled]   = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");

  // Live calculations
  const weight             = parseFloat(weightKg) || 0;
  const proteinTarget      = weight > 0 ? Math.round(weight * PROTEIN_MULTIPLIER[riskLevel]) : 0;
  const hydrationBase      = weight > 0 ? Math.round(weight * 35) : 0;
  const hydrationTarget    = riskLevel === "High" ? hydrationBase + 500 : hydrationBase;
  const resistanceFreq     = calcResistance(riskLevel);
  const supplements        = calcSupplements(riskLevel);
  const riskStyle          = RISK_STYLE[riskLevel];

  // Animated counters
  const animatedProtein    = useAnimatedCounter(proteinTarget);
  const animatedHydration  = useAnimatedCounter(hydrationTarget);

  // Split resistance into number + label for display
  const [resistNum, ...resistRest] = resistanceFreq.split(" ");
  const resistLabel = resistRest.join(" ");

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError("");

    if (!patientName.trim())
      return setError("Patient name is required.");
    if (!patientEmail.trim() || !patientEmail.includes("@"))
      return setError("A valid patient email is required.");
    if (!weight || weight < 30 || weight > 300)
      return setError("Please enter a valid body weight (30–300 kg).");
    if (!age || parseInt(age) < 18 || parseInt(age) > 100)
      return setError("Please enter a valid age (18–100).");
    if (!glp1Agent)
      return setError("Please select a GLP-1 agent and dose.");

    setLoading(true);
    try {
      const res = await fetch("/api/doctor/start-sheet/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName:         patientName.trim(),
          patientEmail:        patientEmail.trim().toLowerCase(),
          weightKg:            weight,
          age:                 parseInt(age),
          glp1Agent,
          riskLevel,
          proteinTarget,
          hydrationTarget,
          resistanceFrequency: resistanceFreq,
          supplements,
          ermEnabled,
        }),
      });
      const json = await res.json() as { ok: boolean; id?: string; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Failed to save protocol. Please try again.");
        return;
      }
      router.push(`/doctor/start-sheet/${json.id}`);
    } catch (e: unknown) {
      setError(`Network error: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* ── Scoped styles (ERM animation + print) ──────────────────────────── */}
      <style>{`
        @keyframes ermPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.4); }
          50%       { box-shadow: 0 0 0 8px rgba(16,185,129,0); }
        }
        .erm-armed { animation: ermPulse 2s ease-in-out infinite; }

        @media print {
          .no-print  { display: none !important; }
          .print-panel {
            width: 100% !important;
            max-width: 100% !important;
          }
          .print-panel > div {
            background: #ffffff !important;
            border: 1px solid #e2e8f0 !important;
            color: #000000 !important;
          }
          .print-panel * { color: #000000 !important; }
          .supplement-pill {
            background: #ffffff !important;
            border: 1px solid #000000 !important;
            color: #000000 !important;
          }
          .brand-text { color: #000000 !important; }
          body { background: #ffffff !important; }
          @page { margin: 2cm; }
        }
      `}</style>

      <div style={{ background: "#0A0A0A", minHeight: "100vh" }}>
        <div className="max-w-7xl mx-auto px-4 py-8">

          {/* Page header */}
          <div className="mb-8 no-print">
            <Link
              href="/doctor/dashboard"
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              ← Dashboard
            </Link>
            <h1
              className="text-2xl font-bold text-white mt-3"
              style={{ fontFamily: "Georgia, serif" }}
            >
              MyoGuard Start Sheet
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Physician&apos;s Desk — personalised sarcopenia-protection protocol for GLP-1 patients.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

              {/* ═══════════════════════════════════════════════════════════
                  LEFT PANEL — inputs
              ═══════════════════════════════════════════════════════════ */}
              <div className="lg:col-span-3 flex flex-col gap-5 no-print">

                {/* Patient info */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
                    Patient Information
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs text-slate-400 uppercase tracking-widest">
                        Full name <span className="text-red-400">*</span>
                      </span>
                      <input
                        type="text"
                        placeholder="Patient full name"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        className={INPUT}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs text-slate-400 uppercase tracking-widest">
                        Email <span className="text-red-400">*</span>
                      </span>
                      <input
                        type="email"
                        placeholder="patient@email.com"
                        value={patientEmail}
                        onChange={(e) => setPatientEmail(e.target.value)}
                        className={INPUT}
                      />
                    </label>
                  </div>
                </div>

                {/* Clinical parameters */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
                    Clinical Parameters
                  </h2>
                  <div className="flex flex-col gap-4">

                    <div className="grid grid-cols-2 gap-4">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs text-slate-400 uppercase tracking-widest">Weight (kg)</span>
                        <input
                          type="number"
                          placeholder="e.g. 82"
                          value={weightKg}
                          onChange={(e) => setWeightKg(e.target.value)}
                          min={30}
                          max={300}
                          className={INPUT}
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs text-slate-400 uppercase tracking-widest">Age (yrs)</span>
                        <input
                          type="number"
                          placeholder="e.g. 54"
                          value={age}
                          onChange={(e) => setAge(e.target.value)}
                          min={18}
                          max={100}
                          className={INPUT}
                        />
                      </label>
                    </div>

                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs text-slate-400 uppercase tracking-widest">GLP-1 Agent &amp; Dose</span>
                      <select
                        value={glp1Agent}
                        onChange={(e) => setGlp1Agent(e.target.value)}
                        className={INPUT}
                      >
                        <option value="">Select agent and dose</option>
                        <optgroup label="Semaglutide — Ozempic / Wegovy">
                          <option>Semaglutide 0.25 mg/wk (Ozempic)</option>
                          <option>Semaglutide 0.5 mg/wk (Ozempic)</option>
                          <option>Semaglutide 1.0 mg/wk (Ozempic)</option>
                          <option>Semaglutide 0.25 mg/wk (Wegovy)</option>
                          <option>Semaglutide 0.5 mg/wk (Wegovy)</option>
                          <option>Semaglutide 1.0 mg/wk (Wegovy)</option>
                          <option>Semaglutide 1.7 mg/wk (Wegovy)</option>
                          <option>Semaglutide 2.4 mg/wk (Wegovy)</option>
                        </optgroup>
                        <optgroup label="Tirzepatide — Mounjaro / Zepbound">
                          <option>Tirzepatide 2.5 mg/wk (Mounjaro / Zepbound)</option>
                          <option>Tirzepatide 5 mg/wk (Mounjaro / Zepbound)</option>
                          <option>Tirzepatide 7.5 mg/wk (Mounjaro / Zepbound)</option>
                          <option>Tirzepatide 10 mg/wk (Mounjaro / Zepbound)</option>
                          <option>Tirzepatide 12.5 mg/wk (Mounjaro / Zepbound)</option>
                          <option>Tirzepatide 15 mg/wk (Mounjaro / Zepbound)</option>
                        </optgroup>
                        <optgroup label="Liraglutide — Victoza / Saxenda">
                          <option>Liraglutide 1.2 mg/day (Victoza / Saxenda)</option>
                          <option>Liraglutide 1.8 mg/day (Victoza / Saxenda)</option>
                        </optgroup>
                        <optgroup label="Dulaglutide — Trulicity">
                          <option>Dulaglutide 0.75 mg/wk (Trulicity)</option>
                          <option>Dulaglutide 1.5 mg/wk (Trulicity)</option>
                          <option>Dulaglutide 3.0 mg/wk (Trulicity)</option>
                          <option>Dulaglutide 4.5 mg/wk (Trulicity)</option>
                        </optgroup>
                        <optgroup label="Semaglutide Oral — Rybelsus">
                          <option>Semaglutide oral 3 mg/day (Rybelsus)</option>
                          <option>Semaglutide oral 7 mg/day (Rybelsus)</option>
                          <option>Semaglutide oral 14 mg/day (Rybelsus)</option>
                        </optgroup>
                      </select>
                    </label>

                    {/* Sarcopenia risk segmented control */}
                    <div className="flex flex-col gap-2">
                      <span className="text-xs text-slate-400 uppercase tracking-widest">
                        Sarcopenia Risk
                      </span>
                      <div className="flex rounded-xl overflow-hidden border border-slate-700">
                        {(["Low", "Moderate", "High"] as RiskLevel[]).map((level) => {
                          const active = riskLevel === level;
                          const activeBg = RISK_STYLE[level].activeBg;
                          return (
                            <button
                              key={level}
                              type="button"
                              onClick={() => setRiskLevel(level)}
                              className={`flex-1 py-3 text-sm font-semibold transition-colors duration-300 ${
                                active
                                  ? `${activeBg} text-white`
                                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              {level}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                </div>

                {/* Physician notes */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
                    Physician Notes
                  </h2>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Clinical observations, contraindications, patient-specific adjustments..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors resize-none"
                  />
                </div>

                {/* ERM toggle */}
                <div
                  className={`bg-slate-900 border-2 rounded-2xl p-6 transition-colors duration-500 ${
                    ermEnabled ? "border-emerald-500 erm-armed" : "border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Electronic Remote Monitoring (ERM)
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Arms patient record for 16/30-day billing threshold tracking
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setErmEnabled((v) => !v)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-300 focus:outline-none ${
                        ermEnabled ? "bg-emerald-600" : "bg-slate-600"
                      }`}
                      aria-pressed={ermEnabled}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-300 ${
                          ermEnabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                  {ermEnabled && (
                    <div className="mt-4 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                      <p className="text-xs text-emerald-400 font-medium">
                        ERM armed — patient flagged for remote monitoring activation
                      </p>
                    </div>
                  )}
                </div>

                {/* Error */}
                {error && (
                  <div className="bg-red-950 border border-red-800 rounded-xl px-4 py-3">
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ boxShadow: "0 0 24px rgba(16,185,129,0.35)" }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Generating...
                    </span>
                  ) : (
                    "Generate Protocol"
                  )}
                </button>

              </div>

              {/* ═══════════════════════════════════════════════════════════
                  RIGHT PANEL — live results (sticky on desktop, prints full-width)
              ═══════════════════════════════════════════════════════════ */}
              <div className="lg:col-span-2 lg:sticky lg:top-8 print-panel">
                <div
                  className={`bg-slate-900 border-2 rounded-2xl p-6 transition-colors duration-500 ${riskStyle.border}`}
                >
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-6">
                    Protocol Preview
                  </h2>

                  {/* Primary metric — protein */}
                  <div className="mb-6 pb-6 border-b border-slate-800">
                    <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">
                      Daily Protein Target
                    </p>
                    <div className="flex items-end gap-2">
                      <span
                        className={`text-6xl font-bold leading-none transition-colors duration-500 ${riskStyle.text}`}
                        style={{ fontFamily: "Georgia, serif" }}
                      >
                        {weight > 0 ? animatedProtein : "—"}
                      </span>
                      {weight > 0 && (
                        <span className="text-slate-400 text-base mb-1">g / day</span>
                      )}
                    </div>
                    {weight > 0 && (
                      <p className="text-xs text-slate-500 mt-2">
                        Based on {riskLevel} protocol · {weight}kg
                      </p>
                    )}
                  </div>

                  {/* Secondary metrics */}
                  <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-slate-800">
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">
                        Daily Hydration
                      </p>
                      <p
                        className={`text-2xl font-bold transition-colors duration-500 ${riskStyle.text}`}
                        style={{ fontFamily: "Georgia, serif" }}
                      >
                        {weight > 0 ? animatedHydration : "—"}
                      </p>
                      {weight > 0 && (
                        <p className="text-xs text-slate-500 mt-0.5">ml / day</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">
                        Resistance
                      </p>
                      <p
                        className={`text-2xl font-bold transition-colors duration-500 ${riskStyle.text}`}
                        style={{ fontFamily: "Georgia, serif" }}
                      >
                        {resistNum}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{resistLabel}</p>
                    </div>
                  </div>

                  {/* Supplement stack */}
                  <div className="mb-6">
                    <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">
                      Supplement Stack
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {supplements.map((s, i) => (
                        <span
                          key={s}
                          className="supplement-pill inline-flex items-center bg-emerald-900 border border-emerald-800 text-emerald-300 text-xs font-medium px-3 py-1 rounded-full"
                          style={{
                            transition: `opacity 0.3s ease ${i * 40}ms, transform 0.3s ease ${i * 40}ms`,
                          }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Clinical disclaimer */}
                  <div className="pt-5 border-t border-slate-800">
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Protocol based on MyoGuard White Paper v4.2.
                      Intended for clinical guidance alongside GLP-1 therapy.
                      Adjust based on patient biochemical response
                      and clinical judgement.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </form>
        </div>
      </div>
    </>
  );
}
