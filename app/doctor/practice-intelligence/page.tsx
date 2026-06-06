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
 *   A. Clinical Practice Updates — emerging developments in obesity medicine and longitudinal care
 *   B. Monitoring Frameworks    — RPM, RTM, CCC (placeholder descriptions; no CPT numbers)
 *   C. Research Infrastructure  — link to /research
 *   D. Practice Intelligence    — placeholder for future CMS / documentation resources
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
            Clinical updates, monitoring frameworks, and research resources for the MyoGuard physician community.
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

        {/* ── Section C — Research Infrastructure ────────────────────────── */}
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
              Research Infrastructure
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

        {/* ── Section D — Practice Intelligence (placeholder) ─────────────── */}
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
              Practice Intelligence
            </h2>

            <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: 1.7, marginBottom: '16px' }}>
              Documentation standards, monitoring guidance, and practice resources for physicians
              managing patients on GLP-1 therapy.
            </p>

            <p style={{ fontSize: '13px', color: '#475569', fontStyle: 'italic', lineHeight: 1.6 }}>
              Practice intelligence resources will be expanded in future releases.
            </p>
          </div>
        </section>

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
