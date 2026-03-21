'use client';

import { useState } from 'react';
import type { ProtocolResult, AssessmentInput } from '@/src/types';

type EmailCaptureProps = {
  results: ProtocolResult;
  formData: AssessmentInput;
  referralSlug?: string | null;
};

// What the /api/email-capture route returns
type EmailCaptureResponse = {
  ok:        boolean;
  delivered: boolean; // true = Resend confirmed delivery; false = key missing or delivery error
};

export default function EmailCapture({ results, formData, referralSlug }: EmailCaptureProps) {
  const [email, setEmail]           = useState('');
  const [submitted, setSubmitted]   = useState(false);
  const [delivered, setDelivered]   = useState(false);
  const [emailError, setEmailError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleEmailSubmit = async () => {
    if (!email || !email.includes('@') || !email.includes('.')) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setEmailError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/email-capture', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          protocolResult: results,
          formData: {
            medication:    formData.medication,
            doseMg:        formData.doseMg,
            activityLevel: formData.activityLevel,
            symptoms:      formData.symptoms,
            referralSlug:  referralSlug ?? undefined,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json() as EmailCaptureResponse;
        setDelivered(data.delivered === true);
        setSubmitted(true);
      } else {
        setEmailError('Something went wrong. Please try again.');
      }
    } catch {
      setEmailError('Unable to connect. Please check your internet and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
      <p className="text-sm font-semibold text-slate-800 mb-1">Send My Protocol to My Email</p>
      <p className="text-xs text-slate-500 mb-3">
        Enter your email to receive your full protocol report.<br />
        We will not send spam or share your information.
      </p>

      {submitted ? (
        delivered ? (
          /* ── Email was confirmed delivered by Resend ── */
          <div className="flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-lg px-4 py-3">
            <span className="text-teal-600 text-lg flex-shrink-0">✓</span>
            <p className="text-sm text-teal-700">
              Protocol sent to <span className="font-semibold">{email}</span>. Check your inbox (and spam folder).
            </p>
          </div>
        ) : (
          /* ── Submission received but email was NOT delivered ──
               This happens when RESEND_API_KEY is not configured, or Resend
               returned an error. Be honest: don't say "check your inbox". */
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <span className="text-amber-500 text-lg flex-shrink-0 mt-0.5">⚠</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">Email delivery is not available right now</p>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                We received your address but could not send the email. Screenshot or bookmark this page to save your protocol. We are working on enabling email delivery.
              </p>
            </div>
          </div>
        )
      ) : (
        <>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setEmailError(''); }}
              className={`flex-1 border rounded-lg px-4 py-2.5 text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm ${
                emailError ? 'border-red-400' : 'border-slate-300'
              }`}
            />
            <button
              onClick={handleEmailSubmit}
              disabled={submitting}
              className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap disabled:opacity-60"
            >
              {submitting ? 'Sending…' : 'Send My Protocol →'}
            </button>
          </div>
          {emailError && (
            <p className="text-xs text-red-500 mt-1.5">{emailError}</p>
          )}
          <p className="text-xs text-slate-400 mt-2">No spam. Unsubscribe anytime.</p>
        </>
      )}
    </div>
  );
}
