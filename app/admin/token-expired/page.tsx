import Link from "next/link";

export default function TokenExpiredPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-10 flex flex-col items-center gap-5 text-center">

        {/* Logo */}
        <div className="flex items-center gap-1">
          <span className="text-xl font-bold text-slate-900">Myo</span>
          <span className="text-xl font-bold text-teal-600">Guard</span>
        </div>

        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold text-slate-900">This link has expired</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Admin action links are valid for <strong className="text-slate-700">48 hours</strong>.
            Log in to the admin panel to review pending applications.
          </p>
        </div>

        <div className="w-full bg-red-50 border border-red-100 rounded-xl px-5 py-3">
          <p className="text-xs text-red-600 font-medium">
            Token invalid or expired · No action was taken
          </p>
        </div>

        <Link
          href="/admin/physicians"
          className="text-sm text-teal-600 hover:underline font-medium"
        >
          ← Go to admin panel
        </Link>

      </div>
    </div>
  );
}
