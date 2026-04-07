'use client';

import { useState } from 'react';
import QRCode from 'react-qr-code';
import Link from 'next/link';

interface Props {
  doctorId:   string;
  doctorName: string;
}

// Use the canonical production URL for the QR value so the code
// works correctly when scanned from a printed handout.
const QR_BASE = 'https://myoguard.health';

// Loose patterns — the API route does strict server-side validation.
function looksLikeEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function looksLikePhone(v: string) {
  return /^\+?[\d\s\-().]{7,15}$/.test(v);
}

export default function PatientGrowthCard({ doctorId, doctorName }: Props) {
  const inviteUrl = `${QR_BASE}/invite/${doctorId}`;

  const [contact, setContact] = useState('');
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  const trimmed     = contact.trim();
  const contactType = looksLikeEmail(trimmed) ? 'email'
                    : looksLikePhone(trimmed) ? 'sms'
                    : null;

  async function handleSend() {
    if (!contactType) {
      setError('Enter a valid email address or phone number.');
      return;
    }
    setError('');
    setSending(true);
    try {
      const res = await fetch('/api/invite/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ contact: trimmed, doctorId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setError(data.error ?? 'Failed to send. Please try again.');
        return;
      }
      setSent(true);
      setContact('');
      setTimeout(() => setSent(false), 4000);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-5 gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Patient Growth</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Share your personal invite link to onboard patients directly to your panel.
          </p>
        </div>
        <Link
          href="/doctor/invite/print"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors"
        >
          {/* Printer icon */}
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print Patient Handout
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">

        {/* ── LEFT: QR Code ── */}
        <div className="flex flex-col items-center gap-3">
          <div className="bg-white border-2 border-slate-900 rounded-xl p-3 inline-block">
            <QRCode
              value={inviteUrl}
              size={160}
              fgColor="#0f172a"
              bgColor="#ffffff"
              level="M"
            />
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500 leading-relaxed">
              Patient scans to sign up directly<br />under your care.
            </p>
            <p className="text-[10px] text-slate-400 mt-1 font-mono break-all max-w-[190px]">
              {inviteUrl}
            </p>
          </div>
        </div>

        {/* ── RIGHT: Digital Invite ── */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Digital Invite
          </p>
          <p className="text-xs text-slate-500 leading-relaxed">
            Send your invite link directly to a patient by email or SMS.
          </p>

          <div className="relative">
            <input
              type="text"
              value={contact}
              onChange={e => {
                setContact(e.target.value);
                setError('');
                setSent(false);
              }}
              placeholder="patient@email.com or +1 555 000 0000"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
            />
            {trimmed.length > 2 && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base select-none">
                {contactType === 'email' ? '✉️' : contactType === 'sms' ? '📱' : ''}
              </span>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}

          {sent ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 text-xs text-emerald-700 font-semibold text-center">
              Invite sent ✓
            </div>
          ) : (
            <button
              onClick={handleSend}
              disabled={sending || !trimmed}
              className="w-full bg-teal-600 hover:bg-teal-700 active:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
            >
              {sending ? 'Sending…' : 'Send Protocol →'}
            </button>
          )}

          <p className="text-[10px] text-slate-400 leading-relaxed">
            {contactType === 'sms'
              ? 'An SMS will be sent with your invite link. Standard rates may apply.'
              : contactType === 'email'
              ? 'A personalised email invite will be sent from hello@myoguard.health.'
              : 'Detects phone or email automatically.'}
          </p>
        </div>
      </div>
    </div>
  );
}
