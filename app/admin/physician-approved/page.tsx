import Link from "next/link";

export default function PhysicianApprovedPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-10 flex flex-col items-center gap-5 text-center">

        {/* Logo */}
        <div className="flex items-center gap-1">
          <span className="text-xl font-bold text-slate-900">Myo</span>
          <span className="text-xl font-bold text-teal-600">Guard</span>
        </div>

        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold text-slate-900">Physician account activated</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            The physician has been sent their activation email and can now
            access the MyoGuard Clinical Command Center.
          </p>
        </div>

        <div className="w-full bg-emerald-50 border border-emerald-100 rounded-xl px-5 py-3">
          <p className="text-xs text-emerald-700 font-medium">
            Activation email sent · Role set to PHYSICIAN
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
