'use client';

interface Props {
  /** Used as the suggested filename when the user saves via the print dialog */
  filename: string;
}

/**
 * Triggers the browser print dialog with a pre-set document title so the
 * browser's "Save as PDF" destination uses `filename` as the file name.
 * Uses the existing @media print styles from globals.css — no extra libraries.
 */
export default function DownloadPDFButton({ filename }: Props) {
  const handleDownload = () => {
    const prev = document.title;
    document.title = filename;

    // Restore title once the print dialog is dismissed
    window.addEventListener('afterprint', () => {
      document.title = prev;
    }, { once: true });

    window.print();
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 transition-colors shadow-sm"
    >
      {/* Download / arrow-down icon */}
      <svg
        className="w-4 h-4 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
        />
      </svg>
      Download PDF
    </button>
  );
}
