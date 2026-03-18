'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Inline "Reject" button for the admin physician list page.
 * Calls POST /api/admin/reject-physician with the target userId.
 * Shows a confirmation step before committing to prevent accidental clicks.
 * On success, refreshes the page to remove the card from the pending list.
 */
export default function RejectButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [state,  setState]  = useState<'idle' | 'confirm' | 'loading' | 'done' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');

  async function handleReject() {
    setState('loading');
    setErrMsg('');

    try {
      const res = await fetch('/api/admin/reject-physician', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json() as { ok?: boolean; error?: string };

      if (!res.ok || !data.ok) {
        setErrMsg(data.error ?? 'Failed to reject. Try again.');
        setState('error');
        return;
      }

      setState('done');
      router.refresh();
    } catch {
      setErrMsg('Network error. Please try again.');
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <span className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Rejected
      </span>
    );
  }

  if (state === 'confirm') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Sure?</span>
        <button
          onClick={handleReject}
          className="bg-red-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-red-600 active:bg-red-700 transition-colors"
        >
          Yes, reject
        </button>
        <button
          onClick={() => setState('idle')}
          className="text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => setState('confirm')}
        disabled={state === 'loading'}
        className="border border-red-200 text-red-500 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 active:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state === 'loading' ? 'Rejecting…' : 'Reject'}
      </button>
      {state === 'error' && (
        <p className="text-[11px] text-red-500">{errMsg}</p>
      )}
    </div>
  );
}
