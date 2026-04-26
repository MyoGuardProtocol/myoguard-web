import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div style={{ background: "#080C14", minHeight: "100vh" }} className="flex flex-col items-center justify-center px-4 gap-6 relative">

      <a href="/" className="absolute top-4 left-4 min-h-[44px] flex items-center text-[13px] text-slate-400 hover:text-white transition-colors">
        ← Back to Home
      </a>

      <div className="text-center flex flex-col gap-2">
        <a href="/" className="no-underline">
          <div className="font-[Georgia,serif] text-[22px] font-black tracking-tight">
            <span className="text-slate-100">Myo</span>
            <span className="text-teal-400">Guard</span>
          </div>
        </a>
        <p className="text-base font-semibold text-slate-100">
          Welcome back to MyoGuard Protocol
        </p>
        <p className="text-sm text-slate-400">
          Secure access to your SRI dashboard and muscle protection pathway.
        </p>
      </div>

      <div className="bg-[#0D1421] border border-[#1A2744] rounded-xl px-5 py-3 flex items-center justify-between gap-4 w-full max-w-sm">
        <div>
          <p className="text-xs font-medium text-slate-200">Clinician pathway</p>
          <p className="text-xs text-slate-400">Physician registration includes credential review.</p>
        </div>
        <a
          href="/sign-up/physician"
          className="text-xs bg-teal-400 text-[#080C14] px-3 py-1.5 rounded-full font-semibold whitespace-nowrap"
        >
          Register your practice →
        </a>
      </div>

      <SignIn
        signUpUrl="/sign-up-new"
        fallbackRedirectUrl="/dashboard"
        appearance={{
          variables: {
            colorBackground: "#0D1421",
            colorInputBackground: "#0D1421",
            colorInputText: "#F1F5F9",
            colorText: "#F1F5F9",
            colorTextSecondary: "#94A3B8",
            colorPrimary: "#2DD4BF",
            borderRadius: "12px",
          },
          elements: {
            card: {
              background: "#0D1421",
              border: "1px solid #1A2744",
              boxShadow: "none",
            },
            formButtonPrimary: {
              background: "#2DD4BF",
              color: "#080C14",
              fontWeight: "700",
            },
            footerActionLink: {
              color: "#2DD4BF",
            },
          },
        }}
      />
    </div>
  );
}
