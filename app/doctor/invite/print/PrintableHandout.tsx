'use client';

import QRCode from 'react-qr-code';

interface Props {
  inviteUrl:  string;
  doctorName: string;
}

/**
 * PrintableHandout — clean white PDF-style page.
 *
 * The Print button triggers window.print(). In Chrome/Edge the user can
 * "Save as PDF" from the print dialog. The print:hidden utilities hide
 * browser chrome (the button, padding) so the printed output is clean.
 */
export default function PrintableHandout({ inviteUrl, doctorName }: Props) {
  return (
    <div className="min-h-screen bg-white font-sans flex flex-col items-center justify-center px-6 py-10 print:p-0 print:min-h-0">

      {/* Print / Save PDF button — hidden when printing */}
      <button
        onClick={() => window.print()}
        className="mb-8 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-colors print:hidden"
      >
        Print / Save as PDF
      </button>

      {/* ── Handout sheet ── */}
      <div className="w-full max-w-xs border border-slate-200 rounded-2xl p-8 text-center shadow-sm print:border-0 print:shadow-none print:rounded-none print:max-w-none print:p-10">

        {/* Logo */}
        <p className="text-3xl font-black tracking-tight text-slate-900 mb-0.5">
          Myo<span className="text-teal-600">Guard</span>
        </p>
        <p className="text-[10px] font-semibold tracking-[0.18em] text-slate-400 uppercase mb-8">
          Protocol Platform
        </p>

        {/* QR Code — high-contrast black border for reliable scanning */}
        <div className="flex justify-center mb-6">
          <div
            style={{ border: '5px solid #0f172a', borderRadius: 16, padding: 12, display: 'inline-block', background: '#ffffff' }}
          >
            <QRCode
              value={inviteUrl}
              size={220}
              fgColor="#0f172a"
              bgColor="#ffffff"
              level="H"
            />
          </div>
        </div>

        {/* Instruction */}
        <p className="text-sm font-semibold text-slate-900 mb-2">
          Scan to join your protocol
        </p>
        <p className="text-xs text-slate-500 leading-relaxed mb-5">
          Your physician, <strong className="text-slate-700">{doctorName}</strong>,
          has set up a personalised muscle-protection protocol for you.
          Scan to create your free account and get started.
        </p>

        {/* URL fallback */}
        <div
          style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 14px', marginBottom: 24 }}
        >
          <p style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>Or visit</p>
          <p style={{ fontSize: 11, color: '#0d9488', fontFamily: 'monospace', wordBreak: 'break-all', margin: 0 }}>
            {inviteUrl}
          </p>
        </div>

        {/* Disclaimer */}
        <p style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.7, margin: 0 }}>
          Use requires physician oversight and patient consent.<br />
          This tool provides educational guidance only and does not replace medical advice.<br />
          © 2026 MyoGuard Protocol · MyoGuard Clinical Oversight
        </p>
      </div>

      <p className="mt-6 text-xs text-slate-400 print:hidden">
        Use <strong>Ctrl+P</strong> (or ⌘P on Mac) to open the print dialog.
      </p>
    </div>
  );
}
