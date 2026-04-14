export default function PhysicianPendingPage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full flex flex-col gap-5 text-center">

        {/* Logo */}
        <div className="flex items-center justify-center gap-1">
          <span className="text-xl font-bold text-slate-900">Myo</span>
          <span className="text-xl font-bold text-teal-600">Guard</span>
        </div>

        {/* Icon */}
        <div className="w-14 h-14 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
          </svg>
        </div>

        {/* Heading */}
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-slate-900">Application under review</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Our clinical team reviews all credentials within{" "}
            <strong className="text-slate-700">6–24 hours</strong>. You will receive an
            activation email once approved.
          </p>
        </div>

        {/* Amber info box */}
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-left">
          <p className="text-xs font-semibold text-amber-700 mb-1">While you wait</p>
          <p className="text-xs text-amber-600 leading-relaxed">
            You can explore the MyoGuard assessment as a patient to see what your future
            patients will experience.
          </p>
        </div>

        {/* CTA */}
        <a
          href="/"
          className="w-full bg-teal-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors text-center"
        >
          Try the assessment
        </a>

        {/* Contact */}
        <p className="text-xs text-slate-400">
          Questions?{" "}
          <a href="mailto:docb@myoguard.health" className="text-teal-600 hover:underline">
            docb@myoguard.health
          </a>
        </p>

      </div>
    </div>
  );
}
