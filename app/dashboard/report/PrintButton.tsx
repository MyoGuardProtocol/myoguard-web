'use client';

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 transition-colors shadow-sm"
    >
      <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.75 19.5l.72-5.671m9.84 0l.72 5.671-9.84-5.671M6.75 19.5H17.25M6.75 19.5L4.5 15M17.25 19.5L19.5 15M9 8.25h6M9 11.25h6M4.5 15h15a1.5 1.5 0 001.5-1.5v-6a1.5 1.5 0 00-1.5-1.5h-15A1.5 1.5 0 003 7.5v6A1.5 1.5 0 004.5 15z" />
      </svg>
      Print / Save PDF
    </button>
  );
}
