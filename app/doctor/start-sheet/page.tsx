"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type RiskLevel = "Low" | "Moderate" | "High";

const GLP1_OPTIONS = [
  "Semaglutide 0.25mg/week (Ozempic)",
  "Semaglutide 0.5mg/week (Ozempic)",
  "Semaglutide 1mg/week (Ozempic)",
  "Semaglutide 2mg/week (Ozempic)",
  "Semaglutide 0.25mg/week (Wegovy)",
  "Semaglutide 0.5mg/week (Wegovy)",
  "Semaglutide 1mg/week (Wegovy)",
  "Semaglutide 1.7mg/week (Wegovy)",
  "Semaglutide 2.4mg/week (Wegovy)",
  "Semaglutide 3mg/day oral (Rybelsus)",
  "Semaglutide 7mg/day oral (Rybelsus)",
  "Semaglutide 14mg/day oral (Rybelsus)",
  "Tirzepatide 2.5mg/week (Mounjaro)",
  "Tirzepatide 5mg/week (Mounjaro)",
  "Tirzepatide 7.5mg/week (Mounjaro)",
  "Tirzepatide 10mg/week (Mounjaro)",
  "Tirzepatide 12.5mg/week (Mounjaro)",
  "Tirzepatide 15mg/week (Mounjaro)",
  "Tirzepatide 2.5mg/week (Zepbound)",
  "Tirzepatide 5mg/week (Zepbound)",
  "Tirzepatide 10mg/week (Zepbound)",
  "Tirzepatide 15mg/week (Zepbound)",
  "Liraglutide 0.6mg/day (Saxenda)",
  "Liraglutide 1.2mg/day (Saxenda)",
  "Liraglutide 1.8mg/day (Saxenda/Victoza)",
  "Liraglutide 2.4mg/day (Saxenda)",
  "Liraglutide 3mg/day (Saxenda)",
  "Dulaglutide 0.75mg/week (Trulicity)",
  "Dulaglutide 1.5mg/week (Trulicity)",
  "Dulaglutide 3mg/week (Trulicity)",
  "Dulaglutide 4.5mg/week (Trulicity)",
  "Exenatide 5mcg twice daily (Byetta)",
  "Exenatide 10mcg twice daily (Byetta)",
  "Exenatide 2mg/week (Bydureon)",
];

function calcSupplements(risk: RiskLevel): string[] {
  const base = ["Whey Protein", "Vitamin D", "Omega-3"];
  if (risk === "Moderate") return [...base, "Creatine", "Magnesium"];
  if (risk === "High") return [...base, "Creatine", "Magnesium", "HMB", "Zinc", "B12"];
  return base;
}

function calcResistance(risk: RiskLevel): string {
  if (risk === "Low") return "2 sessions/week";
  if (risk === "Moderate") return "3 sessions/week";
  return "4–5 sessions/week";
}

const PROTEIN_MULTIPLIER: Record<RiskLevel, number> = {
  Low: 1.2,
  Moderate: 1.5,
  High: 1.8,
};

export default function StartSheetPage() {
  const router = useRouter();

  const [patientName, setPatientName]   = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [weightKg, setWeightKg]         = useState("");
  const [age, setAge]                   = useState("");
  const [glp1Agent, setGlp1Agent]       = useState("");
  const [riskLevel, setRiskLevel]       = useState<RiskLevel>("Moderate");
  const [ermEnabled, setErmEnabled]     = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");

  const weight       = parseFloat(weightKg) || 0;
  const multiplier   = PROTEIN_MULTIPLIER[riskLevel];
  const proteinTarget     = weight > 0 ? Math.round(weight * multiplier) : 0;
  const hydrationBase     = weight > 0 ? Math.round(weight * 35) : 0;
  const hydrationTarget   = riskLevel === "High" ? hydrationBase + 500 : hydrationBase;
  const resistanceFrequency = calcResistance(riskLevel);
  const supplements        = calcSupplements(riskLevel);

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError("");

    if (!patientName.trim())
      return setError("Patient name is required.");
    if (!patientEmail.trim() || !patientEmail.includes("@"))
      return setError("A valid patient email is required.");
    if (!weight || weight < 20 || weight > 300)
      return setError("Please enter a valid body weight (20–300 kg).");
    if (!age || parseInt(age) < 18 || parseInt(age) > 120)
      return setError("Please enter a valid age (18–120).");
    if (!glp1Agent)
      return setError("Please select a GLP-1 agent and dose.");

    setLoading(true);
    try {
      const res = await fetch("/api/doctor/start-sheet/save", {
        method:  "POST",
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
          resistanceFrequency,
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

  const inputCls =
    "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors";
  const labelCls = "text-xs font-medium text-slate-300";

  return (
    <div style={{ background: "#0A0A0A", minHeight: "100vh" }}>
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Page header */}
        <div className="mb-8">
          <Link
            href="/doctor/dashboard"
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            ← Dashboard
          </Link>
          <h1
            className="text-2xl font-bold text-white mt-2"
            style={{ fontFamily: "Georgia, serif" }}
          >
            MyoGuard Start Sheet
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Generate a personalised sarcopenia-protection protocol for your GLP-1 patient.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* ── Left: inputs ──────────────────────────────────────────── */}
            <div className="lg:col-span-3 flex flex-col gap-5">

              {/* Patient info */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                  Patient Information
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className={labelCls}>
                      Patient name <span className="text-red-400">*</span>
                    </span>
                    <input
                      type="text"
                      placeholder="Full name"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      className={inputCls}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className={labelCls}>
                      Patient email <span className="text-red-400">*</span>
                    </span>
                    <input
                      type="email"
                      placeholder="patient@email.com"
                      value={patientEmail}
                      onChange={(e) => setPatientEmail(e.target.value)}
                      className={inputCls}
                    />
                  </label>
                </div>
              </div>

              {/* Clinical parameters */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                  Clinical Parameters
                </h2>
                <div className="flex flex-col gap-4">

                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex flex-col gap-1.5">
                      <span className={labelCls}>Body weight (kg)</span>
                      <input
                        type="number"
                        placeholder="e.g. 82"
                        value={weightKg}
                        onChange={(e) => setWeightKg(e.target.value)}
                        min={20}
                        max={300}
                        className={inputCls}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className={labelCls}>Age (years)</span>
                      <input
                        type="number"
                        placeholder="e.g. 54"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        min={18}
                        max={120}
                        className={inputCls}
                      />
                    </label>
                  </div>

                  <label className="flex flex-col gap-1.5">
                    <span className={labelCls}>GLP-1 agent &amp; dose</span>
                    <select
                      value={glp1Agent}
                      onChange={(e) => setGlp1Agent(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">Select agent and dose</option>
                      {GLP1_OPTIONS.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </label>

                  {/* Risk level toggle */}
                  <div className="flex flex-col gap-2">
                    <span className={labelCls}>Sarcopenia risk level</span>
                    <div className="flex rounded-lg overflow-hidden border border-slate-700">
                      {(["Low", "Moderate", "High"] as RiskLevel[]).map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setRiskLevel(level)}
                          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                            riskLevel === level
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-800 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

              {/* ERM toggle */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      Enable Electronic Remote Monitoring (ERM)
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Flags patient for 16/30-day billing threshold tracking
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setErmEnabled((v) => !v)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                      ermEnabled ? "bg-emerald-600" : "bg-slate-600"
                    }`}
                    aria-pressed={ermEnabled}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        ermEnabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                {ermEnabled && (
                  <div className="mt-4 bg-amber-950 border border-amber-800 rounded-xl px-4 py-3">
                    <p className="text-xs text-amber-300 leading-relaxed">
                      <strong className="text-amber-200">
                        ERM billing module launches July 2026.
                      </strong>{" "}
                      Patient will be flagged for activation.
                    </p>
                  </div>
                )}
              </div>

            </div>

            {/* ── Right: live results ───────────────────────────────────── */}
            <div className="lg:col-span-2">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:sticky lg:top-8">

                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-5">
                  Protocol Preview
                </h2>

                {/* Protein */}
                <div className="mb-5 pb-5 border-b border-slate-800">
                  <p className="text-xs text-slate-500 mb-1">Daily Protein Target</p>
                  <p
                    className="text-4xl font-bold text-emerald-400"
                    style={{ fontFamily: "Georgia, serif" }}
                  >
                    {weight > 0 ? `${proteinTarget}g` : "—"}
                    {weight > 0 && (
                      <span className="text-lg font-normal text-slate-400 ml-1">/day</span>
                    )}
                  </p>
                  {weight > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      {weight}kg × {multiplier}g ({riskLevel} risk)
                    </p>
                  )}
                </div>

                {/* Resistance */}
                <div className="mb-5 pb-5 border-b border-slate-800">
                  <p className="text-xs text-slate-500 mb-1">Resistance Training</p>
                  <p className="text-base font-semibold text-white">{resistanceFrequency}</p>
                </div>

                {/* Hydration */}
                <div className="mb-5 pb-5 border-b border-slate-800">
                  <p className="text-xs text-slate-500 mb-1">Daily Hydration Target</p>
                  <p className="text-base font-semibold text-white">
                    {weight > 0 ? `${(hydrationTarget / 1000).toFixed(1)}L` : "—"}
                    {riskLevel === "High" && weight > 0 && (
                      <span className="text-xs font-normal text-slate-400 ml-1">
                        (+500ml high risk)
                      </span>
                    )}
                  </p>
                </div>

                {/* Supplements */}
                <div>
                  <p className="text-xs text-slate-500 mb-2">Supplement Stack</p>
                  <div className="flex flex-wrap gap-1.5">
                    {supplements.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs font-medium px-2.5 py-1 rounded-full"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* Error */}
          {error && (
            <div className="mt-5 bg-red-950 border border-red-800 rounded-lg px-4 py-3">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Submit */}
          <div className="mt-6">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ boxShadow: "0 0 20px rgba(16,185,129,0.3)" }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating Protocol…
                </span>
              ) : (
                "Generate Protocol"
              )}
            </button>
          </div>

          {/* Disclaimer */}
          <div className="mt-8 pt-6 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-500 leading-relaxed">
              Protocol generated based on MyoGuard White Paper v4.2.
              Intended for clinical guidance alongside GLP-1 therapy.<br />
              Adjust based on patient biochemical response and clinical judgement.
              This output does not constitute individualised medical advice.
            </p>
          </div>

        </form>
      </div>
    </div>
  );
}
