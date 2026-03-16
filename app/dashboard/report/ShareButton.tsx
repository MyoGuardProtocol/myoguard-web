'use client';

import { useState } from 'react';

export default function ShareButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const generate = async () => {
    setState('loading');
    setErrorMsg('');
    try {
      const res  = await fetch('/api/report/share', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate link');
      setShareUrl(data.url);
      setState('done');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Something went wrong');
      setState('error');
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (state === 'done') {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-xl px-3 py-2 shadow-sm min-w-0">
          <span className="text-xs text-slate-500 truncate max-w-[240px] font-mono">{shareUrl}</span>
          <button
            type="button"
            onClick={copy}
            className="flex-shrink-0 text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setState('idle')}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          Reset
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={generate}
        disabled={state === 'loading'}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-teal-300 bg-teal-50 hover:bg-teal-100 text-sm font-semibold text-teal-700 transition-colors shadow-sm disabled:opacity-60"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
        {state === 'loading' ? 'Generating link…' : 'Get shareable link'}
      </button>
      {state === 'error' && (
        <p className="text-xs text-red-500">{errorMsg}</p>
      )}
    </div>
  );
}
