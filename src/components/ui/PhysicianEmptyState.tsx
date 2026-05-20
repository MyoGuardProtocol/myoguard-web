'use client';

import QRCode from 'react-qr-code';
import Link from 'next/link';

interface Props {
  doctorName:   string;
  doctorId:     string;
  referralCode?: string | null;
}

const QR_BASE = 'https://myoguard.health';

export default function PhysicianEmptyState({ doctorName, doctorId, referralCode }: Props) {
  const inviteUrl = referralCode
    ? `${QR_BASE}/join?ref=${referralCode}`
    : `${QR_BASE}/invite/${doctorId}`;

  // Strip any "Dr." prefix then take first name only
  const firstName = doctorName.replace(/^Dr\.?\s*/i, '').split(' ')[0] ?? doctorName;

  const capabilities = [
    { label: 'Longitudinal SRI Monitoring',   desc: 'Track muscle risk scores across visits' },
    { label: 'Protein Adherence Trends',       desc: 'Daily intake vs individual clinical targets' },
    { label: 'High Priority Patient Flags',    desc: 'Automated alerts for critical findings' },
    { label: 'Upcoming Monitoring Alerts',     desc: 'Scheduled check-ins and review triggers' },
  ];

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '48px 24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* Section 1 — Welcome header */}
      <div>
        <p style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
          Clinical Command Center
        </p>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '28px', fontWeight: 400, color: '#F1F5F9', marginBottom: '8px', lineHeight: '1.3' }}>
          Welcome, Dr. {firstName}
        </h1>
        <p style={{ fontSize: '14px', color: '#64748B', lineHeight: '1.6', margin: 0 }}>
          Your Clinical Command Center is active and ready. Add your first patient to begin longitudinal monitoring.
        </p>
      </div>

      {/* Section 2 — CCC status */}
      <div
        style={{
          background: '#0D1421',
          border: '1px solid rgba(45,212,191,0.2)',
          borderRadius: '16px',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <span
          style={{
            width: '10px', height: '10px', borderRadius: '50%',
            background: '#2DD4BF', flexShrink: 0,
            boxShadow: '0 0 10px rgba(45,212,191,0.45)',
          }}
        />
        <div>
          <p style={{ fontSize: '14px', fontWeight: 600, color: '#F1F5F9', margin: 0 }}>
            Clinical Command Center Active
          </p>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '2px 0 0' }}>
            Awaiting first patient connection
          </p>
        </div>
      </div>

      {/* Section 3 — Onboarding pathways */}
      <div>
        <p style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
          Get started
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              href: '/doctor/start',
              label: 'Invite Existing Patients',
              desc: 'Send an email or SMS invite to your current patients',
              icon: (
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#2DD4BF" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              ),
            },
            {
              href: '#physician-qr',
              label: 'Share Physician QR',
              desc: 'Display or print your QR code for in-practice onboarding',
              icon: (
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#2DD4BF" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75V16.5zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
                </svg>
              ),
            },
            {
              href: '/doctor/start-sheet',
              label: 'Review Workflow',
              desc: 'Generate patient activation sheets for your practice',
              icon: (
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#2DD4BF" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
              ),
            },
          ].map(pathway => (
            <a
              key={pathway.label}
              href={pathway.href}
              style={{
                display: 'block',
                background: '#0D1421',
                border: '1px solid #1A2744',
                borderRadius: '14px',
                padding: '20px',
                textDecoration: 'none',
              }}
            >
              <div style={{ marginBottom: '12px' }}>{pathway.icon}</div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#F1F5F9', marginBottom: '6px', lineHeight: '1.4' }}>
                {pathway.label}
              </p>
              <p style={{ fontSize: '12px', color: '#475569', lineHeight: '1.5', margin: 0 }}>
                {pathway.desc}
              </p>
            </a>
          ))}
        </div>
      </div>

      {/* Section 4 — Capability preview (locked until first patient) */}
      <div>
        <p style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
          Available once patients are connected
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {capabilities.map(card => (
            <div
              key={card.label}
              style={{
                background: '#060D1E',
                border: '1px solid #1A2744',
                borderRadius: '12px',
                padding: '16px',
                opacity: 0.65,
              }}
            >
              <div style={{ width: '28px', height: '3px', background: '#1A2744', borderRadius: '2px', marginBottom: '12px' }} />
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>{card.label}</p>
              <p style={{ fontSize: '12px', color: '#334155', lineHeight: '1.5', margin: 0 }}>{card.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Section 5 — QR code (secondary utility) */}
      <div
        id="physician-qr"
        style={{
          background: '#0D1421',
          border: '1px solid #1A2744',
          borderRadius: '16px',
          padding: '24px',
        }}
      >
        <p style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '20px' }}>
          Your physician QR code
        </p>
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <div style={{ background: '#ffffff', padding: '10px', borderRadius: '10px', display: 'inline-block', flexShrink: 0 }}>
            <QRCode value={inviteUrl} size={120} fgColor="#0f172a" bgColor="#ffffff" level="M" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#F1F5F9', marginBottom: '8px' }}>
              Patient onboarding link
            </p>
            <p style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.6', marginBottom: '12px' }}>
              Patients scan this to register and link their Sarcopenia Risk Index (SRI) assessment
              directly to your Clinical Command Center.
            </p>
            <p style={{ fontSize: '11px', color: '#334155', fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: '12px' }}>
              {inviteUrl}
            </p>
            <Link
              href="/doctor/invite/print"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '12px', fontWeight: 600, color: '#2DD4BF', textDecoration: 'none' }}
            >
              Print patient handout →
            </Link>
          </div>
        </div>
      </div>

    </div>
  );
}
