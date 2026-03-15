'use client';

import Link from 'next/link';

type AccountGateProps = {
  score:    number;
  onGuest:  () => void;
};

const BENEFITS = [
  { icon: '📋', text: 'Save your protocol and access it anytime' },
  { icon: '📈', text: 'Track weekly progress and score changes' },
  { icon: '🩺', text: 'Share your report directly with your physician' },
  { icon: '⬇️', text: 'Download your full clinical report as PDF' },
];

/**
 * Soft account gate — shown after the score preview, before the full protocol.
 * Signed-in users never see this (controlled by parent via useUser).
 */
export default function AccountGate({ score, onGuest }: AccountGateProps) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-lg mb-4">

      {/* ── Score preview band ── */}
      <div className="bg-slate-900 px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-teal-400 uppercase tracking-widest mb-0.5">
            Your MyoGuard Score
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-white tabular-nums leading-none">
              {score}
            </span>
            <span className="text-lg text-slate-400">/ 100</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400 leading-relaxed max-w-[140px]">
            Your full protocol is ready below.
          </p>
        </div>
      </div>

      {/* ── Unlock card ── */}
      <div className="bg-slate-800 px-5 pt-5 pb-6">
        <p className="text-base font-bold text-white mb-1">
          Unlock your full MyoGuard plan
        </p>
        <p className="text-sm text-slate-400 mb-4 leading-relaxed">
          Create a free account to save your protocol and track your muscle-protection journey over time.
        </p>

        {/* Benefits */}
        <ul className="space-y-2.5 mb-5">
          {BENEFITS.map(b => (
            <li key={b.text} className="flex items-start gap-3">
              <span className="text-base leading-none mt-0.5 flex-shrink-0">{b.icon}</span>
              <span className="text-sm text-slate-300 leading-snug">{b.text}</span>
            </li>
          ))}
        </ul>

        {/* CTAs */}
        <div className="space-y-2">
          <Link
            href="/sign-up"
            className="block w-full text-center bg-teal-500 hover:bg-teal-400 text-white font-bold text-sm py-3 rounded-xl transition-colors"
          >
            Create free account →
          </Link>
          <Link
            href="/sign-in"
            className="block w-full text-center bg-slate-700 hover:bg-slate-600 text-white font-semibold text-sm py-3 rounded-xl transition-colors"
          >
            Sign in
          </Link>
          <button
            onClick={onGuest}
            className="block w-full text-center text-slate-400 hover:text-slate-200 font-medium text-xs py-2.5 transition-colors"
          >
            Continue as guest — view protocol without saving
          </button>
        </div>
      </div>
    </div>
  );
}
