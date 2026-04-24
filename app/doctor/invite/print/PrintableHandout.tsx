'use client';

import { QRCodeSVG } from 'qrcode.react';

type Props = {
  inviteUrl:  string;
  doctorName: string;
};

export default function PrintableHandout({ inviteUrl, doctorName }: Props) {
  return (
    <div style={{ background: '#080C14', minHeight: '100vh', padding: '40px 20px' }}>

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
        className="paper bg-white mx-auto p-12 shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
        style={{ maxWidth: '720px' }}
      >

        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-black pb-5">
          <div>
            <div>
              <span className="font-serif text-2xl font-black text-black">Myo</span>
              <span className="font-serif text-2xl font-black" style={{ color: '#0d9488' }}>Guard</span>
            </div>
            <p className="text-[10px] tracking-[2px] uppercase text-slate-500 mt-1">Protocol Platform</p>
          </div>
          <div className="text-right">
            <p className="font-serif text-base font-bold text-black">{doctorName}</p>
            <p className="text-[11px] text-emerald-800 font-semibold mt-0.5">MyoGuard Certified Physician</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Clinical Invitation */}
        <div className="mt-7">
          <h2 className="font-serif text-xl font-bold mb-3">
            Muscle Protection Protocol — Patient Invitation
          </h2>
          <p className="text-[14px] leading-7 text-slate-800">
            {doctorName} has prescribed the MyoGuard Protocol as part of your GLP-1 therapy
            management plan. This evidence-based programme is designed to protect your muscle
            mass, optimise your nutritional targets, and monitor your progress throughout
            treatment.
          </p>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mt-4">
            Your Protocol Includes:
          </p>
          <ul className="mt-2 space-y-0 text-[14px] text-slate-800 leading-8 list-none p-0">
            <li>• Personalised Sarcopenia Risk Assessment</li>
            <li>• Daily Metabolic Protein &amp; Hydration Targets</li>
            <li>• Evidence-based Supplementation Guidance</li>
            <li>• Weekly Vitality Check-ins</li>
          </ul>
        </div>

        {/* Activation Hub */}
        <div className="mt-7 text-center">
          <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-3">
            Scan to activate your protocol
          </p>
          <div className="border border-slate-200 p-4 inline-block rounded-lg">
            <QRCodeSVG value={inviteUrl} size={180} level="H" />
          </div>
          <p className="text-[11px] text-slate-400 font-mono mt-2">{inviteUrl}</p>
        </div>

        {/* Sign-off */}
        <div className="mt-10 pt-5 border-t border-slate-200 flex justify-between items-end">
          <div>
            <p className="text-slate-400 text-[13px] mb-1">X__________________________</p>
            <p className="text-[13px] font-semibold text-black">{doctorName}</p>
            <p className="text-[11px] text-emerald-800">MyoGuard Certified Physician</p>
          </div>
          <div>
            <p className="text-right text-[13px] text-slate-400">Date: _______________</p>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-6 text-center text-[9px] text-slate-400 leading-5">
          <p>
            This invitation is issued under the clinical oversight of {doctorName}.
            MyoGuard Protocol provides evidence-based clinical decision support for GLP-1
            muscle preservation. This document does not constitute individualised medical
            advice.
          </p>
          <p>
            © 2026 Meridian Wellness Systems LLC · Clinical Decision Support Only · myoguard.health
          </p>
        </div>

      </div>
    </div>
  );
}
