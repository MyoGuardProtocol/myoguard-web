/**
 * Shared site footer — rendered in the root layout so it appears on
 * every page automatically.  Does not render during print (print:hidden).
 */
export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white print:hidden" role="contentinfo">
      <div className="max-w-3xl mx-auto px-6 py-7 text-center">

        {/* Shield mark + wordmark */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <svg
            className="w-4 h-4 text-teal-600 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 2L3.5 5.5v6c0 5.25 3.83 10.16 8.5 11.5 4.67-1.34 8.5-6.25 8.5-11.5v-6L12 2z" />
            <path d="M8.5 12l2.5 2.5 5-5" />
          </svg>
          <span className="text-xs font-semibold text-slate-700 tracking-wide">
            Myo<span className="text-teal-600">Guard</span> Protocol
          </span>
        </div>

        {/* Legal / attribution line */}
        <p className="text-xs text-slate-500 leading-relaxed">
          © 2026 Meridian Wellness Systems LLC
        </p>

        {/* Utility links */}
        <div className="mt-4 flex items-center justify-center gap-5">
          <a
            href="/privacy"
            className="text-xs text-slate-400 hover:text-teal-600 transition-colors"
          >
            Privacy Policy
          </a>
          <span className="text-slate-200 select-none">|</span>
          <a
            href="/"
            className="text-xs text-slate-400 hover:text-teal-600 transition-colors"
          >
            myoguard.health
          </a>
        </div>

      </div>
    </footer>
  );
}
