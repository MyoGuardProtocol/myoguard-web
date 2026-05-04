import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import Link from 'next/link';
import { SignOutButton } from '@clerk/nextjs';
import PhysicianAvatar from '@/src/components/ui/PhysicianAvatar';

/**
 * /doctor/dashboard — Physician command hub.
 *
 * Role routing:
 *   PHYSICIAN         → renders dashboard (command center)
 *   PHYSICIAN_PENDING → renders "Account under review" holding screen
 *   ADMIN             → /admin/physicians
 *   PATIENT           → /dashboard
 *
 * clerkId-fallback (same pattern as /dashboard):
 *   If no DB row is found by clerkId, we look up by email and stamp the new
 *   clerkId onto the existing row. This handles the case where a Clerk account
 *   is deleted+recreated (new userId, same email) without losing role data.
 */

const PHYSICIAN_SELECT = {
  id:       true,
  role:     true,
  fullName: true,
  email:    true,
  physicianOnboarding: {
    select: { country: true, specialty: true, submittedAt: true },
  },
} as const;

type PhysicianRow = Awaited<ReturnType<typeof fetchByClerkId>>;

function fetchByClerkId(clerkId: string) {
  return prisma.user.findUnique({ where: { clerkId }, select: PHYSICIAN_SELECT });
}

export default async function DoctorDashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/doctor/sign-in');

  // ── Phase 1: fast path — look up by clerkId ──────────────────────────────
  let user: PhysicianRow | null = await fetchByClerkId(userId);

  // ── Phase 2: email-fallback — handles clerkId mismatch after Clerk account
  //    recreation (same email, new Clerk userId) ─────────────────────────────
  if (!user) {
    const clerkUser = await currentUser();
    if (!clerkUser) redirect('/doctor/sign-in');

    const email = clerkUser.emailAddresses[0]?.emailAddress ?? '';

    if (email) {
      const byEmail = await prisma.user.findUnique({
        where:  { email },
        select: { id: true },
      }).catch(() => null);

      if (byEmail) {
        // Attach the new clerkId so Phase 1 hits on the next request.
        user = await prisma.user.update({
          where:  { id: byEmail.id },
          data:   { clerkId: userId },
          select: PHYSICIAN_SELECT,
        }).catch(() => null);
      }
    }
  }

  // Still no row → new physician (webhook hasn't fired yet or first visit)
  if (!user) redirect('/doctor/onboarding');

  // ── Role routing ──────────────────────────────────────────────────────────
  if (user.role === 'ADMIN')   redirect('/admin/physicians');
  if (user.role === 'PATIENT') redirect('/dashboard');
  // PHYSICIAN and PHYSICIAN_PENDING both fall through to JSX below
  return (
    <main style={{ background: '#080C14', minHeight: '100vh',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <header style={{
        background: '#060D1E',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        position: 'sticky', top: 0, zIndex: 50,
        padding: '0 24px',
      }}>
        <div style={{ maxWidth: '720px', margin: '0 auto',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', height: '60px' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: '2px' }}>
            <span style={{ fontSize: '20px', fontWeight: '900',
              letterSpacing: '-0.03em', color: '#F8FAFC' }}>
              Myo<span style={{ color: '#2DD4BF' }}>Guard</span>
            </span>
            <span style={{ color: '#475569', fontWeight: '300',
              fontSize: '13px', marginLeft: '2px' }}>Protocol</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {user.role === 'PHYSICIAN_PENDING' && (
              <span style={{
                fontSize: '11px', fontWeight: '600',
                background: 'rgba(245,158,11,0.12)',
                color: '#F59E0B',
                border: '1px solid rgba(245,158,11,0.3)',
                borderRadius: '99px', padding: '3px 12px',
              }}>
                Pending Verification
              </span>
            )}
            {user.role === 'PHYSICIAN' && (
              <span style={{
                fontSize: '11px', fontWeight: '600',
                background: 'rgba(45,212,191,0.1)',
                color: '#2DD4BF',
                border: '1px solid rgba(45,212,191,0.25)',
                borderRadius: '99px', padding: '3px 12px',
              }}>
                Verified Physician
              </span>
            )}
            <PhysicianAvatar
              fullName={user.fullName}
              email={user.email}
              role={user.role}
            />
          </div>
        </div>
      </header>

      {user.role === 'PHYSICIAN' && (
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '48px 24px' }}>
          <div style={{ marginBottom: '40px' }}>
            <h1 style={{
              fontFamily: 'Georgia, serif',
              fontSize: '28px', fontWeight: '400',
              color: '#F1F5F9', marginBottom: '8px',
              letterSpacing: '-0.01em',
            }}>
              Clinical Command Center
            </h1>
            <p style={{ fontSize: '14px', color: '#64748B' }}>
              Your physician account is verified and active.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '16px',
          }}>
            {[
              { href: '/doctor/patients',    label: 'My Patients',    sub: 'View and manage your patient panel' },
              { href: '/doctor/start-sheet', label: 'Start Sheet',    sub: 'Create a patient activation sheet' },
              { href: '/doctor/start',       label: 'Invite Patients', sub: 'Share referral link or QR code' },
              { href: '/doctor/invite/print',label: 'Print Handout',  sub: 'Generate patient activation handout' },
            ].map((card) => (
              <a
                key={card.href}
                href={card.href}
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  background: '#0D1421',
                  border: '1px solid #1A2744',
                  borderRadius: '20px',
                  padding: '24px',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#2DD4BF')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#1A2744')}
              >
                <p style={{
                  fontSize: '15px', fontWeight: '600',
                  color: '#F1F5F9', marginBottom: '6px',
                  fontFamily: 'Georgia, serif',
                }}>
                  {card.label}
                </p>
                <p style={{ fontSize: '12px', color: '#64748B' }}>
                  {card.sub}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}

      {user.role === 'PHYSICIAN_PENDING' && (
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '48px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Status card */}
        <div style={{
          background: '#0D1421', border: '1px solid #1A2744',
          borderRadius: '20px', padding: '40px 32px',
          textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '24px',
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
          }}>
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#F59E0B" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontWeight: '400', color: '#F1F5F9', marginBottom: '8px' }}>
              Account under review
            </h1>
            <p style={{ fontSize: '14px', color: '#64748B', lineHeight: '1.6' }}>
              {user.fullName ? `Thank you, ${user.fullName}.` : 'Thank you.'}{' '}
              Your physician account has been submitted and is under review.
              We verify all accounts within <strong style={{ color: '#94A3B8' }}>24 hours</strong>.
            </p>
          </div>

          <div style={{
            background: '#060D1E', border: '1px solid #1A2744',
            borderRadius: '12px', padding: '16px', textAlign: 'left',
            display: 'flex', flexDirection: 'column', gap: '12px',
          }}>
            <p style={{ fontSize: '11px', fontWeight: '600', color: '#475569',
              textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              What happens next
            </p>
            {[
              'Our team will verify your credentials',
              'You\'ll receive a confirmation email once approved',
              'Full patient dashboard access will be unlocked',
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{
                  width: '20px', height: '20px', borderRadius: '50%',
                  background: 'rgba(45,212,191,0.15)', border: '1px solid rgba(45,212,191,0.3)',
                  color: '#2DD4BF', fontSize: '10px', fontWeight: '700',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: '1px',
                }}>
                  {i + 1}
                </span>
                <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: '1.5' }}>{item}</p>
              </div>
            ))}
          </div>

          <a
            href="mailto:hello@myoguard.health?subject=Physician%20Account%20Verification"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontSize: '13px', color: '#2DD4BF', textDecoration: 'none',
              justifyContent: 'center' }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            Contact us to expedite verification
          </a>
        </div>

        {/* Submitted profile summary */}
        {user.physicianOnboarding && (
          <div style={{
            background: '#0D1421', border: '1px solid #1A2744',
            borderRadius: '20px', padding: '24px',
          }}>
            <p style={{ fontSize: '11px', fontWeight: '600', color: '#475569',
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>
              Submitted Profile
            </p>
            <dl style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                ['Name', user.fullName],
                ['Email', user.email],
                ['Country', user.physicianOnboarding.country],
                ...(user.physicianOnboarding.specialty ? [['Specialty', user.physicianOnboarding.specialty]] : []),
                ['Submitted', user.physicianOnboarding.submittedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
                  <dt style={{ color: '#475569', width: '100px', flexShrink: 0 }}>{label}</dt>
                  <dd style={{ color: '#94A3B8', wordBreak: 'break-all' }}>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div style={{ textAlign: 'center' }}>
          <SignOutButton redirectUrl="/">
            <button style={{
              fontSize: '13px', color: '#475569', background: 'transparent',
              border: 'none', cursor: 'pointer',
            }}>
              Sign out
            </button>
          </SignOutButton>
        </div>
      </div>
      )}
    </main>
  );
}
