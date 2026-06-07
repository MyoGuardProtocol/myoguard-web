/**
 * /doctor/billing — Physician Clinical Access & Billing
 *
 * Displays subscription status, plan options, and subscription management.
 * Billing is for software access and clinical decision support infrastructure only.
 *
 * Auth: PHYSICIAN and ADMIN only.
 * PHYSICIAN_PENDING → redirect /doctor/dashboard (not yet approved)
 * PATIENT            → redirect /dashboard
 */

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import { getStripeClient } from '@/src/lib/stripe';
import Link from 'next/link';
import PhysicianAvatar from '@/src/components/ui/PhysicianAvatar';
import CheckoutButton from '@/src/components/billing/CheckoutButton';
import PortalButton from '@/src/components/billing/PortalButton';

// ─── Plan feature lists ────────────────────────────────────────────────────────

const SOLO_FEATURES = [
  'Clinical Command Center (CCC)',
  'Sarcopenia Risk Index generation',
  'Patient intelligence signals (4-axis)',
  'Clinical evidence records and documentation support',
  'Physician priority review alerts',
  'Start Sheet workflow',
  'Patient referral engine + QR code',
  'Email & SMS patient invites',
  'Weekly Pulse and Longitudinal Summary emails',
];

const PRACTICE_FEATURES = [
  'Everything in CDS Solo',
  'Multiple physician accounts',
  'Practice-wide panel intelligence',
  'Expanded patient panel capacity',
  'Research infrastructure access',
  'Cohort analytics',
  'Priority clinical support',
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; session_id?: string }>;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect('/sign-in-new');

  const user = await prisma.user.findUnique({
    where:  { clerkId },
    select: {
      id:                 true,
      role:               true,
      fullName:           true,
      email:              true,
      subscriptionStatus: true,
      stripeCustomerId:   true,
    },
  });

  if (!user)                             redirect('/doctor/dashboard');
  if (user.role === 'PHYSICIAN_PENDING') redirect('/doctor/dashboard');
  if (user.role === 'PATIENT')           redirect('/dashboard');
  if (user.role !== 'PHYSICIAN' && user.role !== 'ADMIN') redirect('/doctor/dashboard');

  const { status: returnStatus, session_id: sessionId } = await searchParams;

  // ── Session recovery — activate subscription directly on success redirect ──
  //
  // Stripe redirects to /doctor/billing?status=success&session_id=cs_xxx before
  // the webhook fires. Without session recovery, the physician sees "Payment
  // received" but the DB still shows FREE, causing a redirect loop on the
  // dashboard.
  //
  // On the success redirect, we retrieve the Stripe session server-side and
  // activate immediately — no webhook dependency for the initial activation.
  // The webhook remains authoritative for renewals, dunning, and cancellations.
  //
  // Security: session.metadata.userId is verified against the authenticated
  // physician's DB id. A physician cannot activate another physician's account.
  if (
    returnStatus === 'success' &&
    sessionId &&
    user.subscriptionStatus !== 'ACTIVE'
  ) {
    const stripe = getStripeClient();
    if (stripe) {
      let shouldActivate = false;
      let newCustomerId: string | null = null;
      let newSubId: string | null = null;

      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        const isPaymentOk =
          session.payment_status === 'paid' ||
          session.payment_status === 'no_payment_required';

        if (
          session.status === 'complete' &&
          isPaymentOk &&
          session.metadata?.userId === user.id
        ) {
          shouldActivate  = true;
          newCustomerId   = typeof session.customer     === 'string' ? session.customer     : null;
          newSubId        = typeof session.subscription === 'string' ? session.subscription : null;
        }
      } catch (err) {
        console.error('[billing/session-recovery] Stripe session retrieval failed', err);
        // Fail silently — webhook will handle activation asynchronously
      }

      if (shouldActivate) {
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              subscriptionStatus: 'ACTIVE',
              ...(newCustomerId ? { stripeCustomerId: newCustomerId } : {}),
              ...(newSubId      ? { stripeSubId: newSubId }          : {}),
            },
          });
          console.log(
            `[billing/session-recovery] Activated userId=${user.id} ` +
            `sessionId=${sessionId} subId=${newSubId ?? 'none'}`,
          );
        } catch (err) {
          console.error('[billing/session-recovery] DB update failed', err);
        }
        // Redirect to clean URL — fresh DB read will reflect ACTIVE status
        redirect('/doctor/billing?status=activated');
      }
    }
  }

  const isActive    = user.subscriptionStatus === 'ACTIVE';
  const isPastDue   = user.subscriptionStatus === 'PAST_DUE';
  const isCancelled = user.subscriptionStatus === 'CANCELLED';

  // These checks are server-only — env vars are never exposed to the client
  const soloConfigured     = !!(process.env.STRIPE_PHYSICIAN_PRICE_ID ?? process.env.STRIPE_PRICE_ID);
  const practiceConfigured = !!process.env.STRIPE_PRACTICE_PRICE_ID;

  const navLinks = [
    { label: 'Dashboard',   href: '/doctor/dashboard' },
    { label: 'Patients',    href: '/doctor/patients' },
    { label: 'Start Sheet', href: '/doctor/start-sheet' },
    { label: 'Invite',      href: '/doctor/start' },
    { label: 'Billing',     href: '/doctor/billing' },
  ];

  return (
    <main style={{
      background:  '#080C14',
      minHeight:   '100vh',
      fontFamily:  "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>

      {/* ── Sticky nav ──────────────────────────────────────────────────────── */}
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
            <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ffffff',  letterSpacing: '-0.02em' }}>Myo</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#2DD4BF', letterSpacing: '-0.02em' }}>Guard</span>
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, justifyContent: 'center' }}>
            {navLinks.map(({ label, href }) => {
              const active = href === '/doctor/billing';
              return (
                <Link key={href} href={href} style={{
                  padding:    '6px 14px',
                  borderRadius: '8px',
                  fontSize:   '0.8125rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                  color:      active ? '#2DD4BF' : 'rgba(255,255,255,0.55)',
                  background: active ? 'rgba(45,212,191,0.08)' : 'transparent',
                  transition: 'color 0.15s, background 0.15s',
                }}>
                  {label}
                </Link>
              );
            })}
          </nav>

          <PhysicianAvatar
            fullName={user.fullName}
            email={user.email}
            role={user.role}
          />
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 24px' }}>

        {/* Page heading */}
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{
            fontFamily:    'Georgia, serif',
            fontSize:      '28px',
            fontWeight:    400,
            color:         '#F1F5F9',
            marginBottom:  '8px',
            letterSpacing: '-0.01em',
          }}>
            Clinical Access &amp; Billing
          </h1>
          <p style={{ fontSize: '14px', color: '#64748B', lineHeight: 1.6 }}>
            Software access and clinical decision support infrastructure for physician-led GLP-1 monitoring.
          </p>
        </div>

        {/* ── Subscription-required gate banner ────────────────────────────── */}
        {returnStatus === 'access_required' && !isActive && (
          <div style={{
            background:    'rgba(45,212,191,0.06)',
            border:        '1px solid rgba(45,212,191,0.22)',
            borderRadius:  '16px',
            padding:       '20px 24px',
            marginBottom:  '32px',
          }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#2DD4BF', marginBottom: '4px' }}>
              Clinical access requires an active subscription.
            </p>
            <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.6 }}>
              Choose a plan below to activate your Clinical Command Center. Founding Clinical Partner
              access is available by invitation only.
            </p>
          </div>
        )}

        {/* ── Post-checkout return banners ──────────────────────────────────── */}
        {returnStatus === 'success' && (
          <div style={{
            background:    'rgba(45,212,191,0.08)',
            border:        '1px solid rgba(45,212,191,0.3)',
            borderRadius:  '16px',
            padding:       '20px 24px',
            marginBottom:  '32px',
          }}>
            <p style={{ fontSize: '14px', fontWeight: 600, color: '#2DD4BF', marginBottom: '4px' }}>
              Payment received — thank you.
            </p>
            <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.6 }}>
              Your subscription is being activated. This page will reflect your updated access status
              within a few seconds. If your status does not update, contact{' '}
              <a href="mailto:admin@myoguard.health" style={{ color: '#2DD4BF', textDecoration: 'none' }}>
                admin@myoguard.health
              </a>.
            </p>
          </div>
        )}

        {/* activated — shown after inline session recovery; DB is now ACTIVE */}
        {returnStatus === 'activated' && (
          <div style={{
            background:    'rgba(45,212,191,0.08)',
            border:        '1px solid rgba(45,212,191,0.3)',
            borderRadius:  '16px',
            padding:       '20px 24px',
            marginBottom:  '32px',
            display:       'flex',
            alignItems:    'center',
            justifyContent: 'space-between',
            gap:           '16px',
            flexWrap:      'wrap',
          }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#2DD4BF', marginBottom: '4px' }}>
                Subscription activated.
              </p>
              <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.6 }}>
                Your clinical access is now active. Welcome to the MyoGuard Protocol.
              </p>
            </div>
            <Link href="/doctor/dashboard" style={{
              display:        'inline-block',
              padding:        '10px 20px',
              background:     '#2DD4BF',
              color:          '#080C14',
              borderRadius:   '10px',
              fontSize:       '13px',
              fontWeight:     700,
              textDecoration: 'none',
              whiteSpace:     'nowrap',
            }}>
              Go to Dashboard →
            </Link>
          </div>
        )}

        {returnStatus === 'cancelled' && (
          <div style={{
            background:   'rgba(100,116,139,0.08)',
            border:       '1px solid rgba(100,116,139,0.2)',
            borderRadius: '16px',
            padding:      '20px 24px',
            marginBottom: '32px',
          }}>
            <p style={{ fontSize: '13px', color: '#94A3B8' }}>
              Checkout cancelled — no charge was made. Select a plan below when ready.
            </p>
          </div>
        )}

        {/* ── Subscription status banners ───────────────────────────────────── */}
        {isActive && returnStatus !== 'success' && (
          <div style={{
            background:    'rgba(45,212,191,0.06)',
            border:        '1px solid rgba(45,212,191,0.18)',
            borderRadius:  '16px',
            padding:       '20px 24px',
            marginBottom:  '32px',
            display:       'flex',
            alignItems:    'center',
            justifyContent: 'space-between',
            gap:           '16px',
            flexWrap:      'wrap',
          }}>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#2DD4BF', marginBottom: '4px' }}>
                Subscription Active
              </p>
              <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.6 }}>
                Your clinical access is active. Manage your subscription or update payment details below.
              </p>
            </div>
            {user.stripeCustomerId && (
              <PortalButton label="Manage Subscription →" />
            )}
          </div>
        )}

        {isPastDue && (
          <div style={{
            background:    'rgba(245,158,11,0.06)',
            border:        '1px solid rgba(245,158,11,0.22)',
            borderRadius:  '16px',
            padding:       '20px 24px',
            marginBottom:  '32px',
            display:       'flex',
            alignItems:    'center',
            justifyContent: 'space-between',
            gap:           '16px',
            flexWrap:      'wrap',
          }}>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#F59E0B', marginBottom: '4px' }}>
                Payment Required
              </p>
              <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.6 }}>
                Your last payment could not be processed. Update your payment method to restore full access.
              </p>
            </div>
            {user.stripeCustomerId && (
              <PortalButton label="Update Payment →" />
            )}
          </div>
        )}

        {isCancelled && (
          <div style={{
            background:   'rgba(239,68,68,0.06)',
            border:       '1px solid rgba(239,68,68,0.18)',
            borderRadius: '16px',
            padding:      '20px 24px',
            marginBottom: '32px',
          }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#EF4444', marginBottom: '4px' }}>
              Subscription Cancelled
            </p>
            <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.6 }}>
              Your subscription has ended. Select a plan below to reactivate clinical access.
            </p>
          </div>
        )}

        {/* ── Plan cards — shown when not active ────────────────────────────── */}
        {(!isActive || isPastDue || isCancelled) && returnStatus !== 'success' && (
          <>
            <h2 style={{
              fontFamily:   'Georgia, serif',
              fontSize:     '18px',
              fontWeight:   400,
              color:        '#F1F5F9',
              marginBottom: '20px',
            }}>
              {isCancelled ? 'Reactivate Access' : 'Choose a Plan'}
            </h2>

            <div style={{
              display:             'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap:                 '20px',
              marginBottom:        '48px',
            }}>

              {/* ── CDS Solo ──────────────────────────────────────────────── */}
              <div style={{
                background:     '#0D1421',
                border:         '1px solid #1A2744',
                borderRadius:   '20px',
                padding:        '32px',
                display:        'flex',
                flexDirection:  'column',
                gap:            '24px',
              }}>
                <div>
                  <p style={{
                    fontSize:      '10px',
                    fontWeight:    700,
                    color:         '#2DD4BF',
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    marginBottom:  '10px',
                  }}>
                    Individual Physician
                  </p>
                  <h3 style={{
                    fontFamily:   'Georgia, serif',
                    fontSize:     '22px',
                    fontWeight:   400,
                    color:        '#F1F5F9',
                    marginBottom: '8px',
                  }}>
                    CDS Solo
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.6 }}>
                    Full clinical decision support access for individual physician practices.
                  </p>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {SOLO_FEATURES.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#94A3B8' }}>
                      <span style={{ color: '#2DD4BF', flexShrink: 0, marginTop: '1px' }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {soloConfigured ? (
                  <CheckoutButton planType="physician" label="Subscribe — CDS Solo" />
                ) : (
                  <div style={{ padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', textAlign: 'center' }}>
                    <p style={{ fontSize: '12px', color: '#475569' }}>Payments not yet configured</p>
                  </div>
                )}
              </div>

              {/* ── CDS Practice ──────────────────────────────────────────── */}
              <div style={{
                background:    '#0D1421',
                border:        '1px solid #2DD4BF',
                borderRadius:  '20px',
                padding:       '32px',
                display:       'flex',
                flexDirection: 'column',
                gap:           '24px',
                position:      'relative',
              }}>
                {/* Best value badge */}
                <div style={{
                  position:    'absolute',
                  top:         '-13px',
                  left:        '50%',
                  transform:   'translateX(-50%)',
                  background:  '#2DD4BF',
                  color:       '#080C14',
                  fontSize:    '10px',
                  fontWeight:  800,
                  padding:     '4px 14px',
                  borderRadius: '99px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  whiteSpace:  'nowrap',
                }}>
                  Best Value
                </div>

                <div>
                  <p style={{
                    fontSize:      '10px',
                    fontWeight:    700,
                    color:         '#2DD4BF',
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    marginBottom:  '10px',
                  }}>
                    Multi-Physician Practice
                  </p>
                  <h3 style={{
                    fontFamily:   'Georgia, serif',
                    fontSize:     '22px',
                    fontWeight:   400,
                    color:        '#F1F5F9',
                    marginBottom: '8px',
                  }}>
                    CDS Practice
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.6 }}>
                    Expanded access for group practices and multi-physician clinical teams.
                  </p>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {PRACTICE_FEATURES.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#94A3B8' }}>
                      <span style={{ color: '#2DD4BF', flexShrink: 0, marginTop: '1px' }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {practiceConfigured ? (
                  <CheckoutButton
                    planType="practice"
                    label="Subscribe — CDS Practice"
                    variant="primary"
                  />
                ) : (
                  <div style={{
                    padding:      '16px',
                    background:   'rgba(45,212,191,0.04)',
                    borderRadius: '10px',
                    textAlign:    'center',
                    display:      'flex',
                    flexDirection: 'column',
                    gap:          '6px',
                  }}>
                    <p style={{ fontSize: '12px', color: '#64748B' }}>Practice plan — enquire for pricing</p>
                    <a
                      href="mailto:hello@myoguard.health?subject=CDS%20Practice%20Plan%20Enquiry"
                      style={{ fontSize: '13px', color: '#2DD4BF', textDecoration: 'none', fontWeight: 600 }}
                    >
                      hello@myoguard.health →
                    </a>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── Active subscription management panel ──────────────────────────── */}
        {isActive && !isPastDue && returnStatus !== 'success' && (
          <div style={{
            background:    '#0D1421',
            border:        '1px solid #1A2744',
            borderRadius:  '20px',
            padding:       '32px',
            marginBottom:  '32px',
          }}>
            <h2 style={{
              fontFamily:   'Georgia, serif',
              fontSize:     '18px',
              fontWeight:   400,
              color:        '#F1F5F9',
              marginBottom: '12px',
            }}>
              Subscription Management
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '24px', lineHeight: 1.6 }}>
              Update your payment method, view invoices, change your billing details, or cancel
              your subscription through the secure Stripe customer portal.
            </p>

            {user.stripeCustomerId ? (
              <PortalButton label="Open Billing Portal →" />
            ) : (
              <p style={{ fontSize: '12px', color: '#475569' }}>
                Billing portal unavailable — contact{' '}
                <a href="mailto:support@myoguard.health" style={{ color: '#2DD4BF', textDecoration: 'none' }}>
                  support@myoguard.health
                </a>
              </p>
            )}
          </div>
        )}

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid #1A2744' }}>
          <p style={{ fontSize: '11px', color: '#334155', lineHeight: 1.8, textAlign: 'center' }}>
            MyoGuard Protocol · Physician-led Clinical Decision Support<br />
            © 2026 Meridian Wellness Systems LLC · myoguard.health<br />
            Billing is for software access and clinical decision support infrastructure only.<br />
            Questions?{' '}
            <a href="mailto:admin@myoguard.health" style={{ color: '#2DD4BF', textDecoration: 'none' }}>
              admin@myoguard.health
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
