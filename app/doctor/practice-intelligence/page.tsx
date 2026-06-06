import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import Link             from 'next/link';
import PhysicianAvatar   from '@/src/components/ui/PhysicianAvatar';
import PhysicianNavLinks from '@/src/components/doctor/PhysicianNavLinks';

/**
 * /doctor/practice-intelligence — Physician knowledge and practice intelligence destination.
 *
 * Sections:
 *   A. Clinical Practice Updates       — emerging developments in obesity medicine and longitudinal care
 *   B. Monitoring Frameworks           — RPM, RTM, CCC educational descriptions
 *   C. Documentation & Reimbursement   — 4 informational cards: RPM, RTM, Documentation, Reimbursement Ed.
 *   D. Practice Resources              — links to Start Sheet, Patient Handout, Invite Patients
 *   E. Research Network (conditional)  — suppressed when no ACTIVE studies exist (Build 7B)
 *
 * Access: PHYSICIAN role only.
 * PHYSICIAN_PENDING → /doctor/dashboard
 * Others             → /dashboard
 */

export default async function PracticeIntelligencePage() {
  const { userId } = await auth();
  if (!userId) redirect('/doctor/sign-in');

  const user = await prisma.user.findUnique({
    where:  { clerkId: userId },
    select: { id: true, role: true, fullName: true, email: true, subscriptionStatus: true },
  });

  if (!user)                              redirect('/dashboard');
  if (user.role === 'PHYSICIAN_PENDING') redirect('/doctor/dashboard');
  if (user.role !== 'PHYSICIAN')         redirect('/dashboard');

  // Subscription enforcement
  if (user.subscriptionStatus !== 'ACTIVE') {
    redirect('/doctor/billing?status=access_required');
  }

  // Research visibility gate — Section E renders only when at least one Study is ACTIVE.
  // Suppressed silently on DB error; physicians see no empty placeholder.
  let activeStudyCount = 0;
  try {
    activeStudyCount = await prisma.study.count({ where: { status: 'ACTIVE' } });
  } catch {
    // Research infrastructure unavailable — Section E suppressed
  }

  return (
    <main style={{
      background:  '#080C14',
      minHeight:   '100vh',
      fontFamily:  "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>

      {/* ── Sticky nav ─────────────────────────────────────────────────────── */}
      <header style={{
        position:     'sticky',
        top:          0,
        zIndex:       50,
        background:   '#060D1E',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{
          maxWidth:       '1200px',
          margin:         '0 auto',
          padding:        '0 24px',
          height:         '56px',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          gap:            '24px',
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'baseline', gap: '2px', textDecoration: 'none', flexShrink: 0 }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em' }}>Myo</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#2DD4BF', letterSpacing: '-0.02em' }}>Guard</span>
          </Link>

          <PhysicianNavLinks />

          <PhysicianAvatar fullName={user.fullName ?? ''} email={user.email} role={user.role} />
        </div>
      </header>

      {/* ── Page body ──────────────────────────────────────────────────────── */}
      <div style={{
        maxWidth:       '720px',
        margin:         '0 auto',
        padding:        '48px 24px',
        display:        'flex',
        flexDirection:  'column',
        gap:            '40px',
      }}>

        {/* Page header */}
        <div>
          <h1 style={{
            fontFamily:    'Georgia, serif',
            fontSize:      '28px',
            fontWeight:    '400',
            color:         '#F1F5F9',
            marginBottom:  '8px',
            letterSpacing: '-0.01em',
          }}>
            Practice Intelligence
          </h1>
          <p style={{ fontSize: '14px', color: '#64748B', lineHeight: 1.6 }}>
            Clinical updates, monitoring frameworks, and practice resources for the MyoGuard physician community.
          </p>
        </div>

        {/* ── Section A — Clinical Practice Updates ──────────────────────── */}
        <section>
          <div style={{
            background:    '#0D1421',
            border:        '1px solid #1A2744',
            borderRadius:  '16px',
            padding:       '28px',
          }}>
            <p style={{
              fontSize:       '10px',
              fontWeight:     700,
              color:          '#64748B',
              textTransform:  'uppercase',
              letterSpacing:  '0.10em',
              marginBottom:   '16px',
            }}>
              Section A
            </p>

            <h2 style={{
              fontFamily:    'Georgia, serif',
              fontSize:      '20px',
              fontWeight:    '400',
              color:         '#F1F5F9',
              marginBottom:  '8px',
            }}>
              Clinical Practice Updates
            </h2>

            <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: 1.7, marginBottom: '20px' }}>
              Emerging developments in obesity medicine, muscle preservation, and longitudinal care.
            </p>

            <div style={{
              background:    'rgba(45,212,191,0.04)',
              border:        '1px solid rgba(45,212,191,0.12)',
              borderRadius:  '10px',
              padding:       '16px 20px',
            }}>
              <p style={{
                fontSize:      '11px',
                fontWeight:    600,
                color:         '#2DD4BF',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom:  '6px',
              }}>
                Institutional Bulletin
              </p>
              <p style={{ fontSize: '13px', color: '#64748B', fontStyle: 'italic', lineHeight: 1.6 }}>
                Clinical practice bulletins will appear here as they are published.
                Check back for updates relevant to GLP-1 prescribing, sarcopenia assessment, and longitudinal muscle-preservation protocols.
              </p>
            </div>
          </div>
        </section>

        {/* ── Section B — Monitoring Frameworks ──────────────────────────── */}
        <section>
          <div style={{
            background:    '#0D1421',
            border:        '1px solid #1A2744',
            borderRadius:  '16px',
            padding:       '28px',
          }}>
            <p style={{
              fontSize:      '10px',
              fontWeight:    700,
              color:         '#64748B',
              textTransform: 'uppercase',
              letterSpacing: '0.10em',
              marginBottom:  '16px',
            }}>
              Section B
            </p>

            <h2 style={{
              fontFamily:    'Georgia, serif',
              fontSize:      '20px',
              fontWeight:    '400',
              color:         '#F1F5F9',
              marginBottom:  '8px',
            }}>
              Monitoring Frameworks
            </h2>

            <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: 1.7, marginBottom: '24px' }}>
              MyoGuard is designed to support structured longitudinal monitoring of GLP-1 patients.
              The following frameworks describe the monitoring infrastructure available to physicians on this platform.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* RPM */}
              <div style={{
                background:    'rgba(255,255,255,0.02)',
                border:        '1px solid #1A2744',
                borderRadius:  '12px',
                padding:       '18px 20px',
                display:       'flex',
                gap:           '16px',
                alignItems:    'flex-start',
              }}>
                <div style={{
                  width:          '36px',
                  height:         '36px',
                  borderRadius:   '8px',
                  background:     'rgba(45,212,191,0.08)',
                  border:         '1px solid rgba(45,212,191,0.18)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  flexShrink:     0,
                }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#2DD4BF" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
                  </svg>
                </div>
                <div>
                  <p style={{
                    fontSize:      '14px',
                    fontWeight:    600,
                    color:         '#F1F5F9',
                    marginBottom:  '4px',
                    fontFamily:    'Georgia, serif',
                  }}>
                    Remote Patient Monitoring (RPM)
                  </p>
                  <p style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.6 }}>
                    Structured longitudinal data collection from enrolled patients.
                    Supports physician review of patient-reported outcomes and physiological trends over time.
                  </p>
                </div>
              </div>

              {/* RTM */}
              <div style={{
                background:    'rgba(255,255,255,0.02)',
                border:        '1px solid #1A2744',
                borderRadius:  '12px',
                padding:       '18px 20px',
                display:       'flex',
                gap:           '16px',
                alignItems:    'flex-start',
              }}>
                <div style={{
                  width:          '36px',
                  height:         '36px',
                  borderRadius:   '8px',
                  background:     'rgba(45,212,191,0.08)',
                  border:         '1px solid rgba(45,212,191,0.18)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  flexShrink:     0,
                }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#2DD4BF" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6.75v6.75" />
                  </svg>
                </div>
                <div>
                  <p style={{
                    fontSize:      '14px',
                    fontWeight:    600,
                    color:         '#F1F5F9',
                    marginBottom:  '4px',
                    fontFamily:    'Georgia, serif',
                  }}>
                    Remote Therapeutic Monitoring (RTM)
                  </p>
                  <p style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.6 }}>
                    Physician-led monitoring of therapeutic adherence to nutritional and lifestyle protocols.
                    Designed to support documented clinical oversight of GLP-1 patients between in-person visits.
                  </p>
                </div>
              </div>

              {/* CCC */}
              <div style={{
                background:    'rgba(255,255,255,0.02)',
                border:        '1px solid #1A2744',
                borderRadius:  '12px',
                padding:       '18px 20px',
                display:       'flex',
                gap:           '16px',
                alignItems:    'flex-start',
              }}>
                <div style={{
                  width:          '36px',
                  height:         '36px',
                  borderRadius:   '8px',
                  background:     'rgba(45,212,191,0.08)',
                  border:         '1px solid rgba(45,212,191,0.18)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  flexShrink:     0,
                }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#2DD4BF" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  </svg>
                </div>
                <div>
                  <p style={{
                    fontSize:      '14px',
                    fontWeight:    600,
                    color:         '#F1F5F9',
                    marginBottom:  '4px',
                    fontFamily:    'Georgia, serif',
                  }}>
                    Clinical Command Center (CCC)
                  </p>
                  <p style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.6 }}>
                    Physician-facing intelligence dashboard aggregating continuity signals, review observations,
                    and patient activity across the enrolled panel. The Clinical Command Center is the primary
                    physician oversight interface within MyoGuard Protocol.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── Section C — Documentation & Reimbursement ──────────────────── */}
        <section>
          <div style={{
            background:    '#0D1421',
            border:        '1px solid #1A2744',
            borderRadius:  '16px',
            padding:       '28px',
          }}>
            <p style={{
              fontSize:      '10px',
              fontWeight:    700,
              color:         '#64748B',
              textTransform: 'uppercase',
              letterSpacing: '0.10em',
              marginBottom:  '16px',
            }}>
              Section C
            </p>

            <h2 style={{
              fontFamily:    'Georgia, serif',
              fontSize:      '20px',
              fontWeight:    '400',
              color:         '#F1F5F9',
              marginBottom:  '8px',
            }}>
              Documentation &amp; Reimbursement
            </h2>

            <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: 1.7, marginBottom: '24px' }}>
              Operational intelligence for physicians managing GLP-1 patients under RPM, RTM,
              and Clinical Command Center monitoring frameworks.
              Educational overview — not billing, coding, or compliance guidance.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Card 1 — RPM Monitoring Framework */}
              <div style={{
                background:  'rgba(255,255,255,0.02)',
                border:      '1px solid #1A2744',
                borderRadius:'12px',
                padding:     '18px 20px',
                display:     'flex',
                gap:         '16px',
                alignItems:  'flex-start',
              }}>
                <div style={{
                  width:          '36px',
                  height:         '36px',
                  borderRadius:   '8px',
                  background:     'rgba(45,212,191,0.08)',
                  border:         '1px solid rgba(45,212,191,0.18)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  flexShrink:     0,
                }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#2DD4BF" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                </div>
                <div>
                  <p style={{
                    fontSize:     '14px',
                    fontWeight:   600,
                    color:        '#F1F5F9',
                    marginBottom: '4px',
                    fontFamily:   'Georgia, serif',
                  }}>
                    RPM Monitoring Framework
                  </p>
                  <p style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.6 }}>
                    Remote Patient Monitoring within MyoGuard supports structured longitudinal observation
                    of enrolled patients. Physicians review patient-reported physiological data — including
                    weight trends, grip assessments, and recovery indicators — on a defined cadence.
                    Consistent data collection enables meaningful trend analysis over time.
                  </p>
                </div>
              </div>

              {/* Card 2 — RTM Monitoring Framework */}
              <div style={{
                background:  'rgba(255,255,255,0.02)',
                border:      '1px solid #1A2744',
                borderRadius:'12px',
                padding:     '18px 20px',
                display:     'flex',
                gap:         '16px',
                alignItems:  'flex-start',
              }}>
                <div style={{
                  width:          '36px',
                  height:         '36px',
                  borderRadius:   '8px',
                  background:     'rgba(45,212,191,0.08)',
                  border:         '1px solid rgba(45,212,191,0.18)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  flexShrink:     0,
                }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#2DD4BF" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p style={{
                    fontSize:     '14px',
                    fontWeight:   600,
                    color:        '#F1F5F9',
                    marginBottom: '4px',
                    fontFamily:   'Georgia, serif',
                  }}>
                    RTM Monitoring Framework
                  </p>
                  <p style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.6 }}>
                    Remote Therapeutic Monitoring supports physician-led oversight of therapeutic adherence
                    between in-person visits. MyoGuard tracks adherence to nutritional protocols, symptom
                    reporting, and recovery engagement. RTM-style monitoring creates a documented record of
                    ongoing clinical oversight across the enrolled patient panel.
                  </p>
                </div>
              </div>

              {/* Card 3 — Documentation Standards */}
              <div style={{
                background:  'rgba(255,255,255,0.02)',
                border:      '1px solid #1A2744',
                borderRadius:'12px',
                padding:     '18px 20px',
                display:     'flex',
                gap:         '16px',
                alignItems:  'flex-start',
              }}>
                <div style={{
                  width:          '36px',
                  height:         '36px',
                  borderRadius:   '8px',
                  background:     'rgba(45,212,191,0.08)',
                  border:         '1px solid rgba(45,212,191,0.18)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  flexShrink:     0,
                }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#2DD4BF" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div>
                  <p style={{
                    fontSize:     '14px',
                    fontWeight:   600,
                    color:        '#F1F5F9',
                    marginBottom: '4px',
                    fontFamily:   'Georgia, serif',
                  }}>
                    Documentation Standards
                  </p>
                  <p style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.6 }}>
                    Physician review and documented patient communication are the foundation of defensible
                    longitudinal care. MyoGuard generates timestamped SRI assessments, recovery indicators,
                    and panel-level continuity signals to support clinical records. Consistent documentation
                    practices — including review notation and patient communication logs — support audit
                    readiness and continuity across the care episode.
                  </p>
                </div>
              </div>

              {/* Card 4 — Reimbursement Education */}
              <div style={{
                background:  'rgba(255,255,255,0.02)',
                border:      '1px solid #1A2744',
                borderRadius:'12px',
                padding:     '18px 20px',
                display:     'flex',
                gap:         '16px',
                alignItems:  'flex-start',
              }}>
                <div style={{
                  width:          '36px',
                  height:         '36px',
                  borderRadius:   '8px',
                  background:     'rgba(45,212,191,0.08)',
                  border:         '1px solid rgba(45,212,191,0.18)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  flexShrink:     0,
                }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#2DD4BF" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                  </svg>
                </div>
                <div>
                  <p style={{
                    fontSize:     '14px',
                    fontWeight:   600,
                    color:        '#F1F5F9',
                    marginBottom: '4px',
                    fontFamily:   'Georgia, serif',
                  }}>
                    Reimbursement Education
                  </p>
                  <p style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.6 }}>
                    Reimbursement pathways for remote monitoring and chronic disease management continue
                    to evolve as payer policies adapt to GLP-1 prescribing patterns. Requirements vary
                    across payers and jurisdictions. Documentation quality is consistently the governing
                    factor in reimbursement outcomes — structured, timestamped records of physician review
                    and patient engagement represent the foundation of a defensible billing position.
                    Consult your billing team or compliance advisor for coding guidance specific to your practice.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── Section D — Practice Resources ──────────────────────────────── */}
        <section>
          <div style={{
            background:    '#0D1421',
            border:        '1px solid #1A2744',
            borderRadius:  '16px',
            padding:       '28px',
          }}>
            <p style={{
              fontSize:      '10px',
              fontWeight:    700,
              color:         '#64748B',
              textTransform: 'uppercase',
              letterSpacing: '0.10em',
              marginBottom:  '16px',
            }}>
              Section D
            </p>

            <h2 style={{
              fontFamily:    'Georgia, serif',
              fontSize:      '20px',
              fontWeight:    '400',
              color:         '#F1F5F9',
              marginBottom:  '8px',
            }}>
              Practice Resources
            </h2>

            <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: 1.7, marginBottom: '24px' }}>
              Physician tools, patient activation materials, and workflow resources for managing
              GLP-1 patients on the MyoGuard Protocol.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Start Sheet */}
              <Link href="/doctor/start-sheet" style={{
                display:        'flex',
                alignItems:     'center',
                gap:            '14px',
                background:     'rgba(255,255,255,0.02)',
                border:         '1px solid #1A2744',
                borderRadius:   '12px',
                padding:        '16px 20px',
                textDecoration: 'none',
              }}>
                <div style={{
                  width:          '36px',
                  height:         '36px',
                  borderRadius:   '8px',
                  background:     'rgba(45,212,191,0.08)',
                  border:         '1px solid rgba(45,212,191,0.18)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  flexShrink:     0,
                }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#2DD4BF" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{
                    fontSize:     '14px',
                    fontWeight:   600,
                    color:        '#F1F5F9',
                    marginBottom: '3px',
                    fontFamily:   'Georgia, serif',
                  }}>
                    Patient Activation Sheet
                  </p>
                  <p style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.5 }}>
                    Create a structured start sheet for new GLP-1 patients entering the MyoGuard Protocol.
                  </p>
                </div>
                <svg style={{ flexShrink: 0 }} width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#94A3B8" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>

              {/* Patient Handout */}
              <Link href="/doctor/invite/print" style={{
                display:        'flex',
                alignItems:     'center',
                gap:            '14px',
                background:     'rgba(255,255,255,0.02)',
                border:         '1px solid #1A2744',
                borderRadius:   '12px',
                padding:        '16px 20px',
                textDecoration: 'none',
              }}>
                <div style={{
                  width:          '36px',
                  height:         '36px',
                  borderRadius:   '8px',
                  background:     'rgba(45,212,191,0.08)',
                  border:         '1px solid rgba(45,212,191,0.18)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  flexShrink:     0,
                }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#2DD4BF" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{
                    fontSize:     '14px',
                    fontWeight:   600,
                    color:        '#F1F5F9',
                    marginBottom: '3px',
                    fontFamily:   'Georgia, serif',
                  }}>
                    Printable Patient Handout
                  </p>
                  <p style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.5 }}>
                    Generate a QR-code referral handout for distributing your enrollment link in clinic.
                  </p>
                </div>
                <svg style={{ flexShrink: 0 }} width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#94A3B8" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>

              {/* Invite Patients */}
              <Link href="/doctor/start" style={{
                display:        'flex',
                alignItems:     'center',
                gap:            '14px',
                background:     'rgba(255,255,255,0.02)',
                border:         '1px solid #1A2744',
                borderRadius:   '12px',
                padding:        '16px 20px',
                textDecoration: 'none',
              }}>
                <div style={{
                  width:          '36px',
                  height:         '36px',
                  borderRadius:   '8px',
                  background:     'rgba(45,212,191,0.08)',
                  border:         '1px solid rgba(45,212,191,0.18)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  flexShrink:     0,
                }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#2DD4BF" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{
                    fontSize:     '14px',
                    fontWeight:   600,
                    color:        '#F1F5F9',
                    marginBottom: '3px',
                    fontFamily:   'Georgia, serif',
                  }}>
                    Invite Patients
                  </p>
                  <p style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.5 }}>
                    Send a direct enrollment invitation to new patients via your referral link.
                  </p>
                </div>
                <svg style={{ flexShrink: 0 }} width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#94A3B8" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>

            </div>
          </div>
        </section>

        {/* ── Section E — Research Network (conditional: active studies only) ─
            Suppressed entirely when no ACTIVE studies exist.
            Per design rule: no empty state, no "no studies" message.          */}
        {activeStudyCount > 0 && (
          <section>
            <div style={{
              background:    '#0D1421',
              border:        '1px solid #1A2744',
              borderRadius:  '16px',
              padding:       '28px',
            }}>
              <p style={{
                fontSize:      '10px',
                fontWeight:    700,
                color:         '#64748B',
                textTransform: 'uppercase',
                letterSpacing: '0.10em',
                marginBottom:  '16px',
              }}>
                Section E
              </p>

              <h2 style={{
                fontFamily:    'Georgia, serif',
                fontSize:      '20px',
                fontWeight:    '400',
                color:         '#F1F5F9',
                marginBottom:  '8px',
              }}>
                Research Network
              </h2>

              <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: 1.7, marginBottom: '24px' }}>
                MyoGuard maintains an observational research infrastructure designed to support
                evidence development in GLP-1 muscle preservation and sarcopenia risk detection.
              </p>

              <Link href="/research" style={{
                display:        'flex',
                alignItems:     'center',
                gap:            '14px',
                background:     'rgba(255,255,255,0.02)',
                border:         '1px solid #1A2744',
                borderRadius:   '12px',
                padding:        '18px 20px',
                textDecoration: 'none',
              }}>
                <div style={{
                  width:          '36px',
                  height:         '36px',
                  borderRadius:   '8px',
                  background:     'rgba(45,212,191,0.08)',
                  border:         '1px solid rgba(45,212,191,0.18)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  flexShrink:     0,
                }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#2DD4BF" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{
                    fontSize:      '14px',
                    fontWeight:    600,
                    color:         '#F1F5F9',
                    marginBottom:  '3px',
                    fontFamily:    'Georgia, serif',
                  }}>
                    MyoGuard Research
                  </p>
                  <p style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.5 }}>
                    Learn about the MyoGuard observational research infrastructure.
                  </p>
                </div>
                <svg style={{ flexShrink: 0 }} width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#94A3B8" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </section>
        )}

        {/* Footer note */}
        <p style={{
          fontSize:   '11px',
          color:      '#334155',
          textAlign:  'center',
          lineHeight: 1.6,
        }}>
          MyoGuard Protocol · Physician-led Clinical Decision Support<br />
          © 2026 Meridian Wellness Systems LLC · myoguard.health<br />
          Built for the global GLP-1 prescribing community
        </p>

      </div>
    </main>
  );
}
