'use client';
import Link from 'next/link';
import { useState } from 'react';

type FormData = {
  weight: string;
  unit: 'kg' | 'lbs';
  dose: string;
  medication: string;
  activityLevel: string;
  symptoms: string[];
};

type Results = {
  proteinStandard: number;
  proteinAggressive: number;
  fiber: number;
  hydration: number;
  weightKg: number;
};

export default function Home() {
  const [step, setStep] = useState<'form' | 'results'>('form');
  const [form, setForm] = useState<FormData>({
    weight: '',
    unit: 'kg',
    dose: '',
    medication: 'semaglutide',
    activityLevel: 'sedentary',
    symptoms: [],
  });
  const [results, setResults] = useState<Results | null>(null);
  const [email, setEmail] = useState('');
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [consented, setConsented] = useState(false);

  const symptoms = [
    'Constipation',
    'Nausea',
    'Muscle weakness',
    'Fatigue',
    'Reduced appetite',
    'Bloating',
  ];

  const toggleSymptom = (s: string) => {
    setForm(f => ({
      ...f,
      symptoms: f.symptoms.includes(s)
        ? f.symptoms.filter(x => x !== s)
        : [...f.symptoms, s],
    }));
  };

  const calculate = () => {
    const weightKg =
      form.unit === 'lbs'
        ? parseFloat(form.weight) * 0.453592
        : parseFloat(form.weight);
    const proteinStandard = Math.round(weightKg * 1.2 * 10) / 10;
    const proteinAggressive = Math.round(weightKg * 1.5 * 10) / 10;
    const fiber = form.symptoms.includes('Constipation') ? 35 : 25;
    const hydration = Math.round((weightKg * 35) / 1000 * 10) / 10;
    setResults({ proteinStandard, proteinAggressive, fiber, hydration, weightKg: Math.round(weightKg * 10) / 10 });
    setStep('results');
  };

  const handleEmailSubmit = () => {
    if (!email || !email.includes('@') || !email.includes('.')) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setEmailError('');
    setEmailSubmitted(true);
    setTimeout(() => { window.location.href = '/sign-up'; }, 1500);
  };

  const valid = form.weight && parseFloat(form.weight) > 0 && form.dose;

  return (
    <main className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-xl font-bold text-slate-800 tracking-tight">
              Myo<span className="text-teal-600">Guard</span> Protocol
            </span>
            <p className="text-xs text-slate-500 mt-0.5">Physician-Formulated · Data-Driven Muscle Protection</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-3 py-1 font-medium">Dr. B, MBBS</span>
            <Link href="/dashboard" className="text-xs bg-teal-600 text-white rounded-full px-3 py-1 font-medium hover:bg-teal-700">My Dashboard</Link>
            <Link href="/sign-in" className="text-xs border border-slate-200 text-slate-600 rounded-full px-3 py-1 font-medium hover:bg-slate-50">Sign In</Link>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {step === 'form' ? (
          <>
            {/* Hero */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-800 leading-tight">
                GLP-1 Muscle Protection<br />
                <span className="text-teal-600">Protocol Calculator</span>
              </h1>
              <p className="mt-3 text-slate-600 text-base leading-relaxed">
                Calculate your personalised protein, fibre, and hydration targets
                to support lean muscle maintenance and manage GI symptoms during GLP-1 therapy.
              </p>
            </div>

            {/* Form Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">

              {/* Weight */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Current Body Weight
                </label>
                <div className="flex gap-3">
                  <input
                    type="number"
                    placeholder="e.g. 85"
                    value={form.weight}
                    onChange={e => setForm(f => ({ ...f, weight: e.target.value }))}
                    className="flex-1 border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"
                  />
                  <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                    {(['kg', 'lbs'] as const).map(u => (
                      <button
                        key={u}
                        onClick={() => setForm(f => ({ ...f, unit: u }))}
                        className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                          form.unit === u
                            ? 'bg-teal-600 text-white'
                            : 'bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Medication */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  GLP-1 Medication
                </label>
                <select
                  value={form.medication}
                  onChange={e => setForm(f => ({ ...f, medication: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"
                >
                  <option value="semaglutide">Semaglutide (Ozempic / Wegovy)</option>
                  <option value="tirzepatide">Tirzepatide (Zepbound / Mounjaro)</option>
                </select>
              </div>

              {/* Dose */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Current Weekly Dose (mg)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 1.0"
                  value={form.dose}
                  onChange={e => setForm(f => ({ ...f, dose: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"
                />
              </div>

              {/* Activity */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Activity Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'sedentary', label: 'Sedentary', sub: 'Little/no exercise' },
                    { value: 'moderate', label: 'Moderate', sub: '3–5x/week' },
                    { value: 'active', label: 'Active', sub: 'Daily training' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setForm(f => ({ ...f, activityLevel: opt.value }))}
                      className={`rounded-lg border p-3 text-left transition-all ${
                        form.activityLevel === opt.value
                          ? 'border-teal-500 bg-teal-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <p className={`text-sm font-semibold ${form.activityLevel === opt.value ? 'text-teal-700' : 'text-slate-700'}`}>
                        {opt.label}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{opt.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Symptoms */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Current Symptoms <span className="text-slate-400 font-normal">(select all that apply)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {symptoms.map(s => (
                    <button
                      key={s}
                      onClick={() => toggleSymptom(s)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                        form.symptoms.includes(s)
                          ? 'bg-teal-600 border-teal-600 text-white'
                          : 'bg-white border-slate-300 text-slate-600 hover:border-teal-400'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Consent */}
              <div className="rounded-lg border border-slate-200 p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={consented}
                    onChange={e => setConsented(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-teal-600 cursor-pointer"
                  />
                  <span className="text-xs text-slate-500 leading-relaxed">
                    I understand this tool provides educational nutritional reference information only. It does not constitute medical advice or create a physician-patient relationship. I will review these recommendations with my prescribing physician.
                  </span>
                </label>
              </div>

              {/* Submit */}
              <button
                onClick={calculate}
                disabled={!valid || !consented}
                className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${
                  valid
                    ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-sm'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                Generate My Protocol →
              </button>
            </div>

            {/* Disclaimer */}
            <p className="mt-6 text-xs text-slate-400 text-center leading-relaxed">
              This tool generates educational nutritional reference data only. It does not constitute
              a physician-patient relationship or individualised medical advice. Review all recommendations
              with your prescribing physician. © 2026 MyoGuard Protocol · myoguard.health · <a href="/privacy" className="underline hover:text-slate-600 transition-colors">Privacy Policy</a>
            </p>
          </>
        ) : (
          <>
            {/* Results Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-teal-500 inline-block"></span>
                <span className="text-xs font-medium text-teal-600 uppercase tracking-wide">Protocol Generated</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-800">Your MyoGuard Protocol</h1>
              <p className="text-slate-500 text-sm mt-1">
                Based on {results?.weightKg}kg body weight · {form.medication === 'semaglutide' ? 'Semaglutide' : 'Tirzepatide'} {form.dose}mg · {form.activityLevel} activity
              </p>
            </div>

            {/* Result Cards */}
            <div className="grid grid-cols-1 gap-4 mb-6">

              {/* Protein */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-1">The Protein Shield</p>
                    <p className="text-3xl font-bold text-slate-800">{results?.proteinStandard}g <span className="text-slate-400 text-lg font-normal">– {results?.proteinAggressive}g</span></p>
                    <p className="text-sm text-slate-500 mt-1">per day · 1.2–1.5g/kg target range</p>
                  </div>
                  <span className="text-2xl">🛡️</span>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    High-protein intake preserves lean body mass and metabolic rate during GLP-1-induced weight loss. Distribute across 3–4 meals. Prioritise complete protein sources — whey isolate, eggs, fish, legumes.
                  </p>
                </div>
              </div>

              {/* Fibre */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-1">Fibre Protocol</p>
                    <p className="text-3xl font-bold text-slate-800">{results?.fiber}g</p>
                    <p className="text-sm text-slate-500 mt-1">per day · {form.symptoms.includes('Constipation') ? 'elevated — constipation detected' : 'standard maintenance dose'}</p>
                  </div>
                  <span className="text-2xl">🌿</span>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Soluble fibre counteracts GLP-1-associated delayed gastric emptying and supports microbiome integrity. Introduce gradually over 2 weeks to prevent bloating. Psyllium husk or partially hydrolysed guar gum recommended.
                  </p>
                </div>
              </div>

              {/* Hydration */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-1">Hydration Baseline</p>
                    <p className="text-3xl font-bold text-slate-800">{results?.hydration}L</p>
                    <p className="text-sm text-slate-500 mt-1">per day · 35ml/kg baseline</p>
                  </div>
                  <span className="text-2xl">💧</span>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Adequate hydration optimises stool transit time and prevents dehydration-related adverse effects during active weight loss. Increase by 500ml on days of physical activity.
                  </p>
                </div>
              </div>
            </div>

            {/* Email Capture */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
              <p className="text-sm font-semibold text-slate-800 mb-1">Send My Protocol to My Email</p>
              <p className="text-xs text-slate-500 mb-4">Get a copy of your personalised targets delivered to your inbox.</p>

              {emailSubmitted ? (
                <div className="flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-lg px-4 py-3">
                  <span className="text-teal-600 text-lg">✓</span>
                  <p className="text-sm text-teal-700">
                    Protocol sent to <span className="font-semibold">{email}</span>. Check your inbox.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setEmailError(''); }}
                      className={`flex-1 border rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm ${
                        emailError ? 'border-red-400' : 'border-slate-300'
                      }`}
                    />
                    <button
                      onClick={handleEmailSubmit}
                      className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Send My Protocol →
                    </button>
                  </div>
                  {emailError && (
                    <p className="text-xs text-red-500 mt-1.5">{emailError}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-2">No spam. Unsubscribe anytime.</p>
                </>
              )}
            </div>

            {/* Supplement CTA */}
            <div className="bg-teal-600 rounded-2xl p-5 text-white mb-6">
              <p className="font-semibold text-sm mb-1">Recommended Supplements</p>
              <p className="text-teal-100 text-xs leading-relaxed mb-3">
                Professional-grade products curated using published clinical protocols for GLP-1 patients. Thorne and iHerb selections.
              </p>
              <a
                href="https://api-comms.iherb.com/gateway/comms/ct?pl=qkZ8DA0slJ0u7dcv5Pi4oWEnPkGns9a_rhHjdya7gGbAWGlkC1br2hy8cjWKNlSikMBDaRoXdIWLfdOdacFttmU3QRqmpI3R7bzdW8z2uZIV-y1zfjUjmjTHbNHWiwlENV8XVAlnmf0fSTeQjbuXjyJjdwZkTdbJcwxXdLhA1VOQGZ4w2R8F58FMRi5InRtxMqkSwbYYvOM0Kp_OBD5aTyRivFcYbmZWa3RKbQe16BEbmyYv3yqzhFZKoXlJs1cScqVqv6VKTFer_6WTNZeujnX9SulVittb02xsbtBVEDbrBcL4LYT0YKQsjsaY3Q%3d%3d"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white text-teal-700 font-semibold text-sm px-4 py-2 rounded-lg hover:bg-teal-50 transition-colors inline-block"
              >
                View Supplement Stack →
              </a>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => { setStep('form'); setEmailSubmitted(false); setEmail(''); setEmailError(''); }}
                className="flex-1 border border-slate-300 text-slate-600 font-medium text-sm py-3 rounded-xl hover:bg-slate-50 transition-colors"
              >
                ← Recalculate
              </button>
              <button className="flex-1 bg-slate-800 text-white font-medium text-sm py-3 rounded-xl hover:bg-slate-700 transition-colors">
                Save Protocol (PDF)
              </button>
            </div>

            {/* Disclaimer */}
            <p className="mt-6 text-xs text-slate-400 text-center leading-relaxed">
              This protocol output is an educational nutritional reference tool only. It does not constitute
              a physician-patient relationship or individualised medical advice. Review all recommendations
              with your prescribing physician before commencing supplementation. © 2026 MyoGuard Protocol · myoguard.health · Dr. B, MBBS · <a href="/privacy" className="underline hover:text-slate-600 transition-colors">Privacy Policy</a>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
