'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'react-qr-code';

// ─── Prefilled message sent to the physician ─────────────────────────────────
const PREFILL =
  'My MyoGuard muscle preservation report. Please review before my next GLP-1 dose.';

// ─── Types ────────────────────────────────────────────────────────────────────
type Stage = 'idle' | 'loading' | 'open' | 'error';

// ─── Component ────────────────────────────────────────────────────────────────
export default function ShareButton() {
  const [stage, setStage]       = useState<Stage>('idle');
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied]     = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const closeBtnRef             = useRef<HTMLButtonElement>(null);

  // ── Fetch share token + open modal ─────────────────────────────────────────
  const open = async () => {
    setStage('loading');
    setErrorMsg('');
    try {
      const res  = await fetch('/api/report/share', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate link');
      setShareUrl(data.url);
      setStage('open');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Something went wrong');
      setStage('error');
    }
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
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(`${PREFILL}\n\n${shareUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const shareEmail = () => {
    const subject = encodeURIComponent('MyoGuard Physician Report');
    const body    = encodeURIComponent(`${PREFILL}\n\n${shareUrl}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  // ─── Trigger button ─────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={open}
          disabled={stage === 'loading'}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-teal-300 bg-teal-50 hover:bg-teal-100 text-sm font-semibold text-teal-700 transition-colors shadow-sm disabled:opacity-60"
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
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-inner inline-block">
                  <QRCode
                    value={shareUrl}
                    size={192}
                    bgColor="#ffffff"
                    fgColor="#0f172a"
                    level="M"
                  />
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
                  &ldquo;{PREFILL}&rdquo;
                </p>
              </div>

              {/* ── Share actions ── */}
              <div className="space-y-2">

                {/* Copy link */}
                <button
                  type="button"
                  onClick={copy}
                  className="w-full flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition-colors text-left"
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
                      : 'bg-teal-50 text-teal-600 hover:bg-teal-100'
                  }`}>
                    {copied ? '✓ Copied' : 'Copy'}
                  </span>
                </button>

                {/* WhatsApp */}
                <button
                  type="button"
                  onClick={shareWhatsApp}
                  className="w-full flex items-center gap-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl px-4 py-3 hover:bg-[#dcfce7] active:bg-[#bbf7d0] transition-colors text-left"
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
                  className="w-full flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 hover:bg-slate-100 active:bg-slate-200 transition-colors text-left"
                >
                  <span className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-slate-200">
                    <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                  </span>
                  <p className="text-sm font-semibold text-slate-700">Send via email</p>
                </button>

              </div>

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
