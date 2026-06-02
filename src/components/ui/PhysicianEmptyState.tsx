'use client';

// MyoGuard — Physician Empty CCC Experience
//
// Renders when a physician has zero onboarded patients.
// Replaces the default PatientCommandCenter for the 0-patient state.
//
// Structure:
//   1. Welcome header
//   2. Simple 3-step workflow
//   3. Primary + Secondary actions (Invite Patient / Preview Journey)
//   4. Patient Invitation Tools (referral link + QR)
//   5. Micro trust block
//
// Client component: copy state + journey preview modal only.
// No data fetching. No Prisma.

import { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import Link  from 'next/link';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  doctorName:    string;
  doctorId:      string;
  referralCode?: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const QR_BASE = 'https://myoguard.health';

const WORKFLOW_STEPS = [
  {
    number: '①',
    title:  'Invite a patient',
    body:   'Share your physician access link.',
  },
  {
    number: '②',
    title:  'Patient completes first SRI',
    body:   'Patient receives initial summary.',
  },
  {
    number: '③',
    title:  'Review and monitor',
    body:   'Track trends through your Clinical Command Center.',
  },
] as const;

const JOURNEY_STEPS = [
  { label: 'Patient',    desc: 'Patient registers via your invitation link.' },
  { label: 'SRI',        desc: 'Completes Sarcopenia Risk Index (SRI) assessment.' },
  { label: 'Share',      desc: 'Protocol summary delivered to patient instantly.' },
  { label: 'CCC',        desc: 'Assessment appears in your Clinical Command Center.' },
  { label: 'Monitoring', desc: 'Longitudinal tracking begins across visits.' },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function PhysicianEmptyState({ doctorName, doctorId, referralCode }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copied,      setCopied]      = useState(false);

  const inviteUrl = referralCode
    ? `${QR_BASE}/join?ref=${referralCode}`
    : `${QR_BASE}/invite/${doctorId}`;

  // Strip "Dr." prefix, take first name only
  const firstName = doctorName.replace(/^Dr\.?\s*/i, '').split(' ')[0] ?? doctorName;

  // Escape key closes preview
  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreviewOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [previewOpen]);

  function handleCopy() {
    navigator.clipboard.writeText(inviteUrl)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => {});
  }

  return (
    <>

      {/* ── Journey Preview Modal ────────────────────────────────────────────── */}
      {previewOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Physician Journey Preview"
          onClick={() => setPreviewOpen(false)}
          style={{
            position:       'fixed',
            inset:          0,
            zIndex:         200,
            background:     'rgba(8,12,20,0.88)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            padding:        '24px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background:   '#0D1421',
              border:       '1px solid #1A2744',
              borderRadius: '20px',
              padding:      '28px',
              maxWidth:     '400px',
              width:        '100%',
            }}
          >

            {/* Modal header */}
            <div style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              marginBottom:   '24px',
            }}>
              <p style={{
                fontFamily: 'Georgia, serif',
                fontSize:   '16px',
                fontWeight: '600',
                color:      '#F1F5F9',
                margin:     0,
              }}>
                Physician Journey
              </p>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                style={{
                  background: 'transparent',
                  border:     'none',
                  cursor:     'pointer',
                  color:      '#94A3B8',
                  fontSize:   '22px',
                  lineHeight: '1',
                  padding:    '4px 8px',
                  minHeight:  '44px',
                  display:    'flex',
                  alignItems: 'center',
                }}
              >
                ×
              </button>
            </div>

            {/* Journey steps */}
            {JOURNEY_STEPS.map((step, i) => (
              <div key={step.label}>
                <div style={{
                  display:     'flex',
                  alignItems:  'flex-start',
                  gap:         '14px',
                  padding:     '12px 0',
                }}>
                  <div style={{
                    width:          '32px',
                    height:         '32px',
                    borderRadius:   '50%',
                    background:     'rgba(45,212,191,0.10)',
                    border:         '1px solid rgba(45,212,191,0.22)',
                    color:          '#2DD4BF',
                    fontSize:       '11px',
                    fontWeight:     '700',
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    flexShrink:     0,
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ paddingTop: '4px' }}>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: '#F1F5F9', margin: 0 }}>
                      {step.label}
                    </p>
                    <p style={{ fontSize: '12px', color: '#94A3B8', margin: '2px 0 0', lineHeight: '1.5' }}>
                      {step.desc}
                    </p>
                  </div>
                </div>
                {i < JOURNEY_STEPS.length - 1 && (
                  <div style={{ borderTop: '1px solid #1A2744', marginLeft: '46px' }} />
                )}
              </div>
            ))}

            {/* Modal footer note */}
            <p style={{
              fontSize:   '11px',
              color:      '#334155',
              marginTop:  '20px',
              textAlign:  'center',
              lineHeight: '1.6',
            }}>
              Physician-led Clinical Decision Support ·{' '}
              All clinical decisions remain with the treating physician.
            </p>

          </div>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div style={{
        maxWidth:      '640px',
        margin:        '0 auto',
        padding:       '56px 24px 64px',
        display:       'flex',
        flexDirection: 'column',
        gap:           '36px',
      }}>

        {/* ── SECTION 1 — Welcome ─────────────────────────────────────────────── */}
        <div>
          <p style={{
            fontSize:      '11px',
            fontWeight:    '600',
            color:         '#475569',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom:  '12px',
          }}>
            Clinical Command Center
          </p>
          <h1 style={{
            fontFamily:   'Georgia, serif',
            fontSize:     '28px',
            fontWeight:   '400',
            color:        '#F1F5F9',
            marginBottom: '10px',
            lineHeight:   '1.3',
          }}>
            Welcome back, Dr. {firstName}
          </h1>
          <p style={{
            fontSize:     '15px',
            fontWeight:   '500',
            color:        '#F1F5F9',
            margin:       '0 0 6px',
          }}>
            Your Clinical Command Center is ready.
          </p>
          <p style={{
            fontSize:   '14px',
            color:      '#94A3B8',
            lineHeight: '1.6',
            margin:     0,
          }}>
            Begin longitudinal muscle-preservation monitoring by inviting your first patient.
          </p>
        </div>

        {/* ── SECTION 2 — Simple Workflow ─────────────────────────────────────── */}
        <div style={{
          background:   '#0D1421',
          border:       '1px solid #1A2744',
          borderRadius: '16px',
          padding:      '24px',
        }}>
          <p style={{
            fontSize:      '11px',
            fontWeight:    '600',
            color:         '#475569',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom:  '20px',
          }}>
            How it works
          </p>

          {WORKFLOW_STEPS.map((step, i) => (
            <div key={step.title}>
              <div style={{
                display:    'flex',
                alignItems: 'flex-start',
                gap:        '16px',
                padding:    i === 0
                  ? '0 0 16px'
                  : i === WORKFLOW_STEPS.length - 1
                  ? '16px 0 0'
                  : '16px 0',
              }}>
                <span style={{
                  fontSize:   '20px',
                  color:      '#2DD4BF',
                  flexShrink: 0,
                  lineHeight: '1.2',
                  marginTop:  '1px',
                }}>
                  {step.number}
                </span>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: '600', color: '#F1F5F9', margin: 0 }}>
                    {step.title}
                  </p>
                  <p style={{ fontSize: '13px', color: '#94A3B8', margin: '3px 0 0', lineHeight: '1.5' }}>
                    {step.body}
                  </p>
                </div>
              </div>
              {i < WORKFLOW_STEPS.length - 1 && (
                <div style={{ borderTop: '1px solid #1A2744' }} />
              )}
            </div>
          ))}
        </div>

        {/* ── SECTION 3 — Primary Action ──────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Primary CTA */}
          <Link
            href="/doctor/start"
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              background:     '#2DD4BF',
              color:          '#080C14',
              fontSize:       '15px',
              fontWeight:     '700',
              fontFamily:     'Georgia, serif',
              padding:        '16px 24px',
              borderRadius:   '12px',
              textDecoration: 'none',
              minHeight:      '52px',
              letterSpacing:  '-0.01em',
            }}
          >
            Invite Patient
          </Link>

          {/* Secondary CTA */}
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              background:     'transparent',
              border:         '1px solid #1A2744',
              borderRadius:   '12px',
              color:          '#94A3B8',
              fontSize:       '14px',
              fontWeight:     '500',
              padding:        '14px 24px',
              cursor:         'pointer',
              minHeight:      '48px',
            }}
          >
            Preview Physician Journey
          </button>

        </div>

        {/* ── SECTION 4 — Patient Invitation Tools ────────────────────────────── */}
        <div style={{
          background:   '#0D1421',
          border:       '1px solid #1A2744',
          borderRadius: '16px',
          padding:      '24px',
        }}>
          <p style={{
            fontSize:      '11px',
            fontWeight:    '600',
            color:         '#475569',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom:  '20px',
          }}>
            Patient Invitation Tools
          </p>

          {/* Referral link + copy */}
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px' }}>
              Your referral link
            </p>
            <div style={{
              display:      'flex',
              alignItems:   'center',
              gap:          '10px',
              background:   '#060D1E',
              border:       '1px solid #1A2744',
              borderRadius: '10px',
              padding:      '10px 14px',
            }}>
              <code style={{
                fontSize:     '12px',
                color:        '#94A3B8',
                flex:         1,
                wordBreak:    'break-all',
                lineHeight:   '1.5',
              }}>
                {inviteUrl}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  flexShrink:   0,
                  background:   copied ? 'rgba(45,212,191,0.14)' : 'rgba(45,212,191,0.06)',
                  border:       '1px solid rgba(45,212,191,0.2)',
                  borderRadius: '8px',
                  color:        '#2DD4BF',
                  fontSize:     '12px',
                  fontWeight:   '600',
                  padding:      '6px 14px',
                  cursor:       'pointer',
                  minHeight:    '36px',
                  whiteSpace:   'nowrap',
                  transition:   'background 0.15s',
                }}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* QR code — secondary, not dominant */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <div style={{
              background:   '#ffffff',
              padding:      '8px',
              borderRadius: '8px',
              display:      'inline-block',
              flexShrink:   0,
            }}>
              <QRCode value={inviteUrl} size={80} fgColor="#0f172a" bgColor="#ffffff" level="M" />
            </div>
            <div style={{ paddingTop: '4px' }}>
              <p style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.6', margin: 0 }}>
                Display or print for in-practice onboarding.
              </p>
              <Link
                href="/doctor/invite/print"
                style={{
                  display:     'inline-block',
                  marginTop:   '8px',
                  fontSize:    '12px',
                  fontWeight:  '600',
                  color:       '#2DD4BF',
                  textDecoration: 'none',
                }}
              >
                Print patient handout →
              </Link>
            </div>
          </div>

        </div>

        {/* ── SECTION 5 — Micro Trust Block ───────────────────────────────────── */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '11px', color: '#334155', lineHeight: '2', margin: 0 }}>
            Physician-led Clinical Decision Support
            <span style={{ margin: '0 8px', color: '#1E2A3A' }}>·</span>
            Secure patient linkage
            <span style={{ margin: '0 8px', color: '#1E2A3A' }}>·</span>
            Longitudinal monitoring
          </p>
        </div>

      </div>
    </>
  );
}
