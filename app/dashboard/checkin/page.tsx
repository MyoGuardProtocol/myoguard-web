"use client";
import { useState } from "react";

export default function CheckinPage() {
  const [protein, setProtein] = useState("");
  const [weight, setWeight] = useState("");
  const [gi, setGi] = useState("");
  const [exercise, setExercise] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (!protein || !weight || !exercise) return;
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center flex flex-col gap-4">
          <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Check-in recorded</h2>
          <p className="text-sm text-slate-500">
            Your weekly data has been saved. Keep up the consistency — it compounds.
          </p>
          <a
            href="/dashboard"
            className="bg-teal-600 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-6 py-8 max-w-xl mx-auto flex flex-col gap-6">
      <div>
        <a href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700">
          ← Back to dashboard
        </a>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Weekly check-in</h1>
        <p className="text-sm text-slate-500 mt-1">
          Takes 60 seconds. Helps track your muscle-protection progress.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-600">
            This week&apos;s average protein intake (g/day)
          </span>
          <input
            type="number"
            placeholder="e.g. 95"
            value={protein}
            onChange={e => setProtein(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-600">Current weight (kg)</span>
          <input
            type="number"
            placeholder="e.g. 84"
            value={weight}
            onChange={e => setWeight(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-600">GI symptoms this week</span>
          <select
            value={gi}
            onChange={e => setGi(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
          >
            <option value="">Select</option>
            <option>None</option>
            <option>Mild — managed well</option>
            <option>Moderate — affecting diet</option>
            <option>Severe — significantly limiting</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-600">
            Resistance training sessions this week
          </span>
          <select
            value={exercise}
            onChange={e => setExercise(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
          >
            <option value="">Select</option>
            <option>0 sessions</option>
            <option>1 session</option>
            <option>2 sessions</option>
            <option>3 sessions</option>
            <option>4+ sessions</option>
          </select>
        </label>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!protein || !weight || !exercise}
        className="w-full bg-teal-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-teal-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Submit check-in
      </button>

      <p className="text-xs text-slate-400 text-center">
        MyoGuard Clinical Oversight · For monitoring purposes only
      </p>
    </div>
  );
}
