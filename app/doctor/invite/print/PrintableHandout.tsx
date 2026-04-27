'use client';

import { QRCodeSVG } from 'qrcode.react';

type Props = {
  inviteUrl:  string;
  doctorName: string;
};

export default function PrintableHandout({ inviteUrl, doctorName }: Props) {
  const formattedDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', padding: '40px 20px' }}>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; }
          .paper { box-shadow: none !important; margin: 0 !important; }
        }
        @page { size: A4; margin: 2cm }
      `}</style>

      {/* Print button */}
      <div className="no-print flex justify-end mb-6" style={{ maxWidth: '720px', margin: '0 auto 24px' }}>
        <button
          onClick={() => window.print()}
          className="bg-[#2DD4BF] text-[#080C14] px-6 py-2 rounded-full font-bold text-[13px]"
        >
          Print Document
        </button>
      </div>

      {/* Paper */}
      <div
        className="paper bg-white mx-auto"
        style={{ maxWidth: '720px', padding: '40px 32px' }}
      >

        {/* Header */}
        <div className="flex justify-between items-start pb-5" style={{ borderBottom: '1px solid #E2E8F0' }}>
          <div>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Myo<span style={{ color: '#0d9488' }}>Guard</span> Protocol
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Clinical Decision Support System</p>
          </div>
          <div className="text-right">
            <p className="text-[13px] font-semibold text-slate-700">Prescribed by: {doctorName}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Date: {formattedDate}</p>
          </div>
        </div>

        {/* Title + body */}
        <div className="mt-7">
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontWeight: 700, color: '#0f172a', marginBottom: '14px', lineHeight: 1.3 }}>
            Your Muscle Protection Protocol Has Been Activated
          </h2>
          <p className="text-[14px] leading-6 text-slate-700 mb-3">
            You have been enrolled in a physician-guided muscle protection protocol as part of
            your GLP-1 treatment.
          </p>
          <p className="text-[14px] leading-6 text-slate-700">
            This protocol is designed to preserve lean muscle mass, optimize protein intake,
            and monitor your progress throughout therapy.
          </p>

          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mt-5 mb-2">
            Your Protocol Includes:
          </p>
          <ul className="text-[14px] text-slate-700 list-none p-0 m-0" style={{ lineHeight: 1 }}>
            <li style={{ padding: '5px 0' }}>• Sarcopenia Risk Index (SRI) Assessment</li>
            <li style={{ padding: '5px 0' }}>• Daily Protein &amp; Hydration Targets</li>
            <li style={{ padding: '5px 0' }}>• Evidence-Based Supplement Strategy</li>
            <li style={{ padding: '5px 0' }}>• Weekly Clinical Check-ins</li>
          </ul>
        </div>

        {/* QR section */}
        <div className="mt-8 text-center">
          <p className="text-[12px] font-semibold text-slate-600 mb-4">
            Scan to activate your clinical protocol
          </p>
          <div className="inline-block p-4 rounded-xl" style={{ border: '2px solid #2DD4BF' }}>
            <QRCodeSVG value={inviteUrl} size={220} level="H" />
          </div>
          <p className="text-[12px] text-slate-500 mt-3">This will take less than 2 minutes</p>
          <p className="text-[10px] text-slate-400 font-mono mt-2">{inviteUrl}</p>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center" style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
          <p className="text-[9px] text-slate-400 leading-5">
            MyoGuard Protocol · Clinical Decision Support System
          </p>
          <p className="text-[9px] text-slate-400 leading-5">
            © 2026 Meridian Wellness Systems LLC
          </p>
        </div>

      </div>
    </div>
  );
}
