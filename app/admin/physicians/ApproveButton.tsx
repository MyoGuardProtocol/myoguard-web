'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Inline "Approve" button used on the admin physician list page.
 * Calls POST /api/admin/upgrade-physician with the target userId.
 * On success, refreshes the page to remove the approved card from the list.
 */
export default function ApproveButton({ userId }: { userId: string }) {
  const router  = useRouter();
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');

  async function handleApprove() {
    setState('loading');
    setErrMsg('');

    try {
      const res = await fetch('/api/admin/upgrade-physician', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json() as { ok?: boolean; error?: string; slug?: string };

      if (!res.ok || !data.ok) {
        setErrMsg(data.error ?? 'Failed to approve. Try again.');
        setState('error');
        return;
      }

      setState('done');
      // Refresh server component data
      router.refresh();
    } catch {
      setErrMsg('Network error. Please try again.');
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <span className="text-xs text-teal-600 font-semibold flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        Approved
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleApprove}
        disabled={state === 'loading'}
        className="bg-teal-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-teal-700 active:bg-teal-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state === 'loading' ? 'Approving…' : 'Approve →'}
      </button>
      {state === 'error' && (
        <p className="text-[11px] text-red-500">{errMsg}</p>
      )}
    </div>
  );
}
