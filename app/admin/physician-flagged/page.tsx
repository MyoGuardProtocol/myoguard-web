import Link from "next/link";

export default function PhysicianFlaggedPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-10 flex flex-col items-center gap-5 text-center">

        {/* Logo */}
        <div className="flex items-center gap-1">
          <span className="text-xl font-bold text-slate-900">Myo</span>
          <span className="text-xl font-bold text-teal-600">Guard</span>
        </div>

        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
          <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
          </svg>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold text-slate-900">Application flagged for review</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            This application has been marked for further review.
            No account access has been granted.
          </p>
        </div>

        <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-3">
          <p className="text-xs text-slate-600 font-medium">
            Status set to FLAGGED · Physician not notified
          </p>
        </div>

        <Link
          href="/admin/physicians"
          className="text-sm text-teal-600 hover:underline font-medium"
        >
          ← View all applications
        </Link>

      </div>
    </div>
  );
}
