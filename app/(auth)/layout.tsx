export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 font-sans flex flex-col">
      {/* Brand header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <a href="/" className="text-xl font-bold text-slate-800 tracking-tight hover:opacity-80 transition-opacity">
            Myo<span className="text-teal-600">Guard</span> Protocol
          </a>
          <p className="text-xs text-slate-500 mt-0.5">Physician-Formulated · Data-Driven Muscle Protection</p>
        </div>
      </header>

      {/* Centred auth card */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        {children}
      </div>

      <p className="pb-6 text-xs text-slate-400 text-center">
        © 2026 MyoGuard Protocol · <a href="/privacy" className="underline hover:text-slate-600">Privacy Policy</a>
      </p>
    </main>
  );
}
