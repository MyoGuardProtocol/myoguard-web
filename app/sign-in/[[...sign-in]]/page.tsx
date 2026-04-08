import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 gap-6">
      <div className="text-center flex flex-col gap-1">
        <div className="flex items-center justify-center gap-1 mb-2">
          <span className="text-xl font-bold text-slate-900">Myo</span>
          <span className="text-xl font-bold text-teal-600">Guard</span>
        </div>
        <p className="text-sm text-slate-500">
          Sign in to access your protocol and progress
        </p>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 flex items-center justify-between gap-4 w-full max-w-sm">
        <div>
          <p className="text-xs font-medium text-slate-700">Are you a physician?</p>
          <p className="text-xs text-slate-400">Clinician registration is separate</p>
        </div>
        <a
          href="/sign-up/physician"
          className="text-xs bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
        >
          Physician sign-up →
        </a>
      </div>

      <SignIn />
    </div>
  );
}
