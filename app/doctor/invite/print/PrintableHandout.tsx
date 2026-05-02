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
      <div className="no-print" style={{ maxWidth: '720px', margin: '0 auto 24px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => window.print()}
          style={{
            background: '#2DD4BF', color: '#080C14',
            padding: '8px 24px', borderRadius: '999px',
            fontSize: '13px', fontWeight: 700,
            border: 'none', cursor: 'pointer',
          }}
        >
          Print Document
        </button>
      </div>

      {/* Paper */}
      <div
        className="paper bg-white mx-auto"
        style={{ maxWidth: '720px', padding: '40px 36px', background: '#ffffff' }}
      >

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          paddingBottom: '18px', borderBottom: '2px solid #2DD4BF', marginBottom: '28px',
        }}>
          <div>
            <p style={{
              fontFamily: 'Georgia, serif', fontSize: '22px',
              fontWeight: 900, color: '#0D1421', margin: 0,
            }}>
              Myo<span style={{ color: '#0d9488' }}>Guard</span> Protocol
            </p>
            <p style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
              Clinical Decision Support System
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#0D1421', margin: 0 }}>
              Prescribed by: {doctorName}
            </p>
            <p style={{ fontSize: '11px', color: '#64748B', marginTop: '3px' }}>
              Date: {formattedDate}
            </p>
          </div>
        </div>

        {/* Document title */}
        <div style={{ marginBottom: '22px' }}>
          <h1 style={{
            fontFamily: 'Georgia, serif', fontSize: '26px',
            fontWeight: 700, color: '#0D1421', margin: 0, lineHeight: 1.2,
          }}>
            Patient Activation Sheet
          </h1>
          <p style={{ fontSize: '14px', color: '#2DD4BF', fontWeight: 600, marginTop: '6px' }}>
            GLP-1 Muscle Protection Program
          </p>
        </div>

        {/* Patient Protocol Snapshot */}
        <div style={{
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderLeft: '3px solid #2DD4BF',
          borderRadius: '8px',
          padding: '16px 20px',
          marginBottom: '24px',
        }}>
          <p style={{
            fontSize: '10px', fontWeight: 700, color: '#64748B',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px',
          }}>
            Patient Protocol Snapshot
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 32px' }}>
            {([
              { label: 'Patient',           value: 'Assigned Patient' },
              { label: 'Clinical Focus',    value: 'Muscle preservation during GLP-1 therapy' },
              { label: 'Activation Pathway', value: 'Sarcopenia Risk Index (SRI) + weekly monitoring' },
              { label: 'Physician',         value: doctorName },
            ] as const).map(({ label, value }) => (
              <div key={label}>
                <p style={{
                  fontSize: '9px', fontWeight: 700, color: '#94A3B8',
                  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px',
                }}>
                  {label}
                </p>
                <p style={{ fontSize: '12px', color: '#0D1421', fontWeight: 500, margin: 0 }}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Body copy */}
        <div style={{ marginBottom: '22px' }}>
          <p style={{ fontSize: '14px', lineHeight: 1.75, color: '#334155', marginBottom: '10px' }}>
            This physician-guided protocol supports muscle preservation during GLP-1 therapy by activating
            structured SRI monitoring, protein target guidance, and weekly clinical check-ins.
          </p>
          <p style={{ fontSize: '14px', lineHeight: 1.75, color: '#334155', margin: 0 }}>
            Activation takes less than 2 minutes and links your progress with your treating physician.
          </p>
        </div>

        {/* Your Plan Includes */}
        <div style={{ marginBottom: '28px' }}>
          <p style={{
            fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: '#64748B', marginBottom: '12px',
          }}>
            Your Plan Includes
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {[
              'Personalised Sarcopenia Risk Index (SRI)',
              'Daily protein and hydration targets',
              'Muscle-preserving support strategy',
              'Weekly progress monitoring',
            ].map((item, i, arr) => (
              <li key={item} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '7px 0',
                borderBottom: i < arr.length - 1 ? '1px solid #F1F5F9' : 'none',
                fontSize: '14px', color: '#334155',
              }}>
                <span style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: '#2DD4BF', flexShrink: 0,
                }} />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* QR section */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <p style={{
            fontFamily: 'Georgia, serif', fontSize: '16px',
            fontWeight: 700, color: '#0D1421', marginBottom: '16px',
          }}>
            Activate Your Protocol
          </p>
          <div style={{ display: 'inline-block', padding: '16px', border: '2px solid #2DD4BF', borderRadius: '14px' }}>
            <QRCodeSVG value={inviteUrl} size={220} level="H" />
          </div>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginTop: '14px' }}>
            Scan with your phone to begin
          </p>
          <p style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
            Estimated time: less than 2 minutes
          </p>
          <div style={{ marginTop: '14px' }}>
            <p style={{
              fontSize: '10px', color: '#94A3B8',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px',
            }}>
              Secure activation link
            </p>
            <p style={{ fontSize: '10px', fontFamily: 'monospace', color: '#475569', wordBreak: 'break-all', margin: 0 }}>
              {inviteUrl}
            </p>
          </div>
        </div>

        {/* Clinical trust disclaimer */}
        <div style={{
          background: '#F8FAFC', border: '1px solid #E2E8F0',
          borderRadius: '8px', padding: '14px 18px', marginBottom: '24px',
        }}>
          <p style={{ fontSize: '11px', lineHeight: 1.65, color: '#64748B', margin: 0 }}>
            This is a physician-guided clinical decision support pathway. It does not replace clinical
            judgment. Follow all recommendations under the direction of your treating physician.
          </p>
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px', textAlign: 'center' }}>
          <p style={{ fontSize: '9px', color: '#94A3B8', lineHeight: 1.8, margin: 0 }}>
            MyoGuard Protocol · Clinical Decision Support System
          </p>
          <p style={{ fontSize: '9px', color: '#94A3B8', lineHeight: 1.8, margin: 0 }}>
            © 2026 Meridian Wellness Systems LLC
          </p>
          <p style={{ fontSize: '9px', color: '#94A3B8', lineHeight: 1.8, margin: 0 }}>
            myoguard.health
          </p>
        </div>

      </div>
    </div>
  );
}
