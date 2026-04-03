import Header from '@/src/components/ui/Header';

/**
 * Auth layout — wraps /sign-in and /sign-up.
 *
 * Uses the shared Header (trust strip + shield lockup, no nav links).
 * Footer is provided by the root layout (app/layout.tsx) so it renders
 * below the auth card on every auth page without duplication.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      <Header />

      {/* Centred auth card */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        {children}
      </div>
    </div>
  );
}
