import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 gap-6">
      <div className="text-center flex flex-col gap-1">
        <div className="flex items-center justify-center gap-1 mb-2">
          <span className="text-xl font-bold text-slate-900">Myo</span>
          <span className="text-xl font-bold text-teal-600">Guard</span>
        </div>
        <p className="text-sm text-slate-500">
          Create your free MyoGuard account
        </p>
      </div>

      <div className="bg-teal-50 border border-teal-100 rounded-xl px-5 py-3 flex items-center justify-between gap-4 w-full max-w-sm">
        <div>
          <p className="text-xs font-medium text-teal-800">Are you a clinician?</p>
          <p className="text-xs text-teal-600">Physician registration requires credential review</p>
        </div>
        <a
          href="/sign-up/physician"
          className="text-xs bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
        >
          Register here →
        </a>
      </div>

      <SignUp />
    </div>
  );
}
