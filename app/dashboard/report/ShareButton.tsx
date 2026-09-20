'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'react-qr-code';
import { SHARE_NOTICE_TEXT } from '@/src/lib/share/shareNotice';

// ─── Share message templates ──────────────────────────────────────────────────
const WHATSAPP_MSG =
  "Hi Doctor, I've generated my MyoGuard Sarcopenia Risk Index (SRI) summary and wanted to share it with you for review.\n\n" +
  'MyoGuard Protocol is a physician-led Clinical Decision Support platform for muscle preservation during GLP-1 receptor agonist therapy. This summary was generated using the Sarcopenia Risk Index (SRI) framework and is shared for your clinical review.';

const EMAIL_SUBJECT = 'My MyoGuard Protocol summary for your review';

const EMAIL_BODY =
  'Dear Doctor,\n\n' +
  "I'm sharing my MyoGuard Protocol summary with you as my treating physician.\n\n" +
  'MyoGuard Protocol is a physician-led Clinical Decision Support platform for muscle preservation during GLP-1 therapy. This summary was generated using the Sarcopenia Risk Index (SRI) framework and is shared for your clinical review.';

// Consent is deliberately NOT persisted across dialogs.
//
// It used to live in sessionStorage so the tick survived reopening. Since 1D-R1
// the acknowledgement is what causes the link to be generated and is recorded
// server-side as evidence of the patient's act, so a remembered tick would
// mean a link could be minted without the patient affirming anything on that
// occasion. It resets every time the dialog opens.

// ─── Types ────────────────────────────────────────────────────────────────────
type Stage = 'idle' | 'loading' | 'open' | 'error';

interface ShareButtonProps {
  physicianLinked?: boolean;
  physicianName?: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ShareButton({ physicianLinked = false, physicianName = null }: ShareButtonProps) {
  const [stage, setStage]         = useState<Stage>('idle');
  const [shareUrl, setShareUrl]   = useState('');
  const [copied, setCopied]       = useState(false);
  const [errorMsg, setErrorMsg]   = useState('');
  const [consented, setConsented] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [revoking, setRevoking]   = useState(false);
  const [revoked, setRevoked]     = useState(false);
  const closeBtnRef               = useRef<HTMLButtonElement>(null);

  // The link exists AND the patient has acknowledged on this occasion. Every
  // share action is gated on this, not on the tick alone — between ticking and
  // the link arriving there is nothing to copy.
  const ready = consented && shareUrl !== '';

  // ── Generate — only ever called from the acknowledgement ──────────────────
  //
  // The acknowledgement is what creates the link. That ordering is the point:
  // the server records the act against the notice version the patient was
  // shown, so "the patient intentionally generated this" is evidenced rather
  // than assumed.
  const generate = async () => {
    setErrorMsg('');
    try {
      const res = await fetch('/api/report/share', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ acknowledged: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate link');
      setShareUrl(data.url);
      setExpiresAt(data.expiresAt ?? null);
      setRevoked(false);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Something went wrong');
      setConsented(false);
    }
  };

  const toggleConsent = () => {
    const next = !consented;
    setConsented(next);
    if (next && shareUrl === '') void generate();
  };

  // ── Revoke ────────────────────────────────────────────────────────────────
  //
  // Closes the bearer channel everywhere. It does not affect a linked
  // physician, who reads the record through authenticated access — so this is
  // safe to offer plainly, without warning the patient away from using it.
  const revoke = async () => {
    setRevoking(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/report/share', { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not revoke the link');
      setShareUrl('');
      setExpiresAt(null);
      setConsented(false);
      setRevoked(true);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setRevoking(false);
    }
  };

  // ── Open the dialog. No link is generated until the notice is acknowledged.
  const open = () => {
    setConsented(false);
    setShareUrl('');
    setExpiresAt(null);
    setRevoked(false);
    setErrorMsg('');
    setStage('open');
  };

  const close = useCallback(() => setStage('idle'), []);

  // ── ESC closes modal ────────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'open') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [stage, close]);

  // ── Lock body scroll while modal is open ───────────────────────────────────
  useEffect(() => {
    if (stage === 'open') {
      document.body.style.overflow = 'hidden';
      // Move focus to close button for keyboard / screen-reader users
      closeBtnRef.current?.focus();
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [stage]);

  // ── Share actions ───────────────────────────────────────────────────────────
  const copy = async () => {
    if (!ready) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const shareWhatsApp = () => {
    if (!ready) return;
    const text = encodeURIComponent(`${WHATSAPP_MSG}\n\n${shareUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const shareEmail = () => {
    if (!ready) return;
    const subject = encodeURIComponent(EMAIL_SUBJECT);
    const body    = encodeURIComponent(`${EMAIL_BODY}\n\n${shareUrl}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  // ─── Trigger button ─────────────────────────────────────────────────────────
  return (
    <>
      {physicianLinked ? (
        <div>
          <p style={{ fontSize: '14px', fontWeight: '600', color: '#2DD4BF' }}>
            Shared with {physicianName
              ? `Dr. ${physicianName.replace(/^Dr\.?\s+/i, '')}`
              : 'your physician'}
          </p>
          <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
            Your physician can view this report in the MyoGuard Command Center.
          </p>
          {/* Being linked used to remove every share control from this view,
              which left a patient who had already generated a public link with
              no way to withdraw it. Revoking here closes that link only — the
              linked physician reads the record through their own authenticated
              access and is unaffected. */}
          {/* After revoking, this branch used to end here — a paragraph and
              nothing else. That was a terminal state: `open` is wired only to
              the trigger in the unlinked branch, so a linked patient could
              never reach the dialog again and the approved lifecycle
              (create → revoke → re-share) had no third step. The action below
              is that step. It opens the dialog only; the link is still minted
              by the acknowledgement, never by revoking. */}
          {revoked ? (
            <>
              <p style={{ fontSize: '12px', color: '#64748B', marginTop: '8px' }}>
                Your share link has been revoked. Your physician&rsquo;s access is unaffected.
              </p>
              <button
                type="button"
                onClick={open}
                style={{
                  marginTop: '8px', fontSize: '12px', fontWeight: 600,
                  color: '#2DD4BF', background: 'none', border: 'none',
                  padding: 0, cursor: 'pointer',
                }}
              >
                Share with my physician
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={revoke}
              disabled={revoking}
              style={{
                marginTop: '8px', fontSize: '12px', fontWeight: 600,
                color: '#F87171', background: 'none', border: 'none',
                padding: 0, cursor: 'pointer',
              }}
            >
              {revoking ? 'Revoking…' : 'Revoke my share link'}
            </button>
          )}
          {errorMsg && (
            <p role="alert" style={{ fontSize: '12px', color: '#F87171', marginTop: '4px' }}>{errorMsg}</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={open}
            disabled={stage === 'loading'}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-teal-400 bg-teal-600 hover:bg-teal-700 text-sm font-semibold text-white transition-colors shadow-sm disabled:opacity-60"
          >
            {/* Share icon */}
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
            </svg>
            {stage === 'loading' ? 'Generating…' : 'Share With My Physician'}
          </button>
          {stage === 'error' && (
            <p className="text-xs text-red-500">{errorMsg}</p>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── SHARE MODAL ── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {stage === 'open' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-modal-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={close}
            aria-hidden="true"
          />

          {/* Panel */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

            {/* ── Header ── */}
            <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-slate-100">
              <div>
                <h2 id="share-modal-title" className="text-base font-bold text-slate-900">
                  Share With Your Physician
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Scan the QR code or send the link directly
                </p>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={close}
                aria-label="Close share modal"
                className="flex-shrink-0 ml-3 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-5 py-5 space-y-5 overflow-y-auto max-h-[80vh]">

              {/* ── QR code ── */}
              <div className="flex flex-col items-center gap-2">
                {/* QR is blurred + overlaid with a lock when consent has not been given */}
                <div className="relative bg-white p-3.5 rounded-xl border border-slate-200 shadow-inner inline-block">
                  <div className={`transition-all duration-300 ${ready ? '' : 'blur-sm select-none pointer-events-none'}`}>
                    <QRCode
                      value={shareUrl || 'https://myoguard.health'}
                      size={192}
                      bgColor="#ffffff"
                      fgColor="#0f172a"
                      level="M"
                    />
                  </div>
                  {!ready && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl">
                      <div className="bg-white/95 rounded-xl px-3 py-2 flex flex-col items-center gap-1 shadow border border-slate-200">
                        <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                        <p className="text-[11px] font-semibold text-slate-600 text-center">
                          Consent required
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-400 text-center">
                  Physician scans with phone camera — no app needed
                </p>
              </div>

              {/* ── Prefilled message preview ── */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-1.5">
                  Message included
                </p>
                <p className="text-xs text-slate-700 italic leading-relaxed">
                  &ldquo;{WHATSAPP_MSG}&rdquo;
                </p>
              </div>

              {/* ── Share notice ──────────────────────────────────────────────
                  The Founder's 1D-R1 doctrine wording, read from the shared
                  module so the text shown here and the version recorded with
                  the patient's action cannot drift apart. Three facts: what the
                  link does, how long it lasts, that it can be withdrawn. */}
              <p className="text-[11px] text-slate-500 leading-relaxed border border-slate-200 rounded-lg px-3 py-2.5 bg-slate-50">
                {SHARE_NOTICE_TEXT}
              </p>

              {/* ── Consent checkbox ── */}
              {/*
                Uses a custom <button aria-pressed> instead of <input type="checkbox">
                because globals.css applies -webkit-appearance: none to all inputs,
                which makes native checkboxes invisible on iOS Safari.
              */}
              <button
                type="button"
                onClick={toggleConsent}
                aria-pressed={consented}
                className={`w-full flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                  consented
                    ? 'border-teal-400 bg-teal-50'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                }`}
              >
                {/* Custom checkbox tick box */}
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    consented
                      ? 'bg-teal-600 border-teal-600'
                      : 'bg-white border-slate-400'
                  }`}
                >
                  {consented && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 12 12"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 6l3 3 5-5" />
                    </svg>
                  )}
                </span>
                <span className="text-xs text-slate-700 leading-relaxed">
                  I understand, and want to create a link to share with my physician.
                  {ready && (
                    <span className="ml-1.5 font-semibold text-teal-700">✓ Link created</span>
                  )}
                  {consented && !ready && !errorMsg && (
                    <span className="ml-1.5 font-semibold text-slate-500">Creating link…</span>
                  )}
                </span>
              </button>

              {/* ── Share actions ── */}
              <div className="space-y-2">

                {/* Copy link */}
                <button
                  type="button"
                  onClick={copy}
                  disabled={!ready}
                  aria-disabled={!ready}
                  className="w-full flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:bg-slate-50 enabled:active:bg-slate-100"
                >
                  <span className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">Copy link</p>
                    <p className="text-[11px] text-slate-400 truncate font-mono">{shareUrl}</p>
                  </div>
                  <span className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${
                    copied
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-teal-50 text-teal-600'
                  }`}>
                    {copied ? '✓ Copied' : 'Copy'}
                  </span>
                </button>

                {/* WhatsApp */}
                <button
                  type="button"
                  onClick={shareWhatsApp}
                  disabled={!ready}
                  aria-disabled={!ready}
                  className="w-full flex items-center gap-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl px-4 py-3 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:bg-[#dcfce7] enabled:active:bg-[#bbf7d0]"
                >
                  <span className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-[#25D366]">
                    {/* WhatsApp logo SVG */}
                    <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="white">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </span>
                  <p className="text-sm font-semibold text-[#166534]">Send via WhatsApp</p>
                </button>

                {/* Email */}
                <button
                  type="button"
                  onClick={shareEmail}
                  disabled={!ready}
                  aria-disabled={!ready}
                  className="w-full flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:bg-slate-100 enabled:active:bg-slate-200"
                >
                  <span className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-slate-200">
                    <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                  </span>
                  <p className="text-sm font-semibold text-slate-700">Send via email</p>
                </button>

              </div>

              {/* ── Expiry + revocation ─────────────────────────────────────
                  Both facts the notice promised, made real in the same place
                  the link is handed over — an expiry the patient can see, and
                  a control that withdraws it. */}
              {ready && (
                <div className="border-t border-slate-100 pt-4 space-y-2">
                  {expiresAt && (
                    <p className="text-[11px] text-slate-500 text-center">
                      This link expires on{' '}
                      <span className="font-semibold text-slate-700">
                        {new Date(expiresAt).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'long', year: 'numeric',
                        })}
                      </span>
                      .
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={revoke}
                    disabled={revoking}
                    className="w-full text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg py-2 transition-colors disabled:opacity-50"
                  >
                    {revoking ? 'Revoking…' : 'Revoke this link'}
                  </button>
                </div>
              )}

              {revoked && (
                <p role="status" className="text-xs text-slate-600 text-center leading-relaxed border border-slate-200 rounded-lg px-3 py-2.5 bg-slate-50">
                  This link has been revoked and no longer opens.
                  Your physician&rsquo;s own access to your record is unaffected.
                </p>
              )}

              {errorMsg && (
                <p role="alert" className="text-xs text-red-600 text-center">{errorMsg}</p>
              )}

              {/* ── Privacy note ── */}
              <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                This link grants read-only access to your clinical report.
                No account or login is required to view it.
              </p>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
