'use client';

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-2 bg-teal-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-teal-700 active:bg-teal-800 transition-colors shadow-sm"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.75 19.817a48.162 48.162 0 0110.5 0l.73-5.988M3.5 8.75h17M9 3.75h6a1.5 1.5 0 011.5 1.5v3.75H7.5V5.25A1.5 1.5 0 019 3.75z" />
      </svg>
      Print / Save as PDF
    </button>
  );
}
