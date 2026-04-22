import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import Link from 'next/link';
import CopyButton from './CopyButton';
import PhysicianAvatar from '@/src/components/ui/PhysicianAvatar';
import PhysicianQRCode from '@/src/components/ui/PhysicianQRCode';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myoguard.health';

export default async function DoctorStartPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // Look up the physician profile linked to this user
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { role: true, referralSlug: true, fullName: true, email: true },
  });

  // Role routing — PHYSICIAN_PENDING gets the holding screen
  if (!user) redirect('/dashboard');
  if (user.role === 'PHYSICIAN_PENDING') redirect('/doctor/dashboard');
  if (user.role !== 'PHYSICIAN') redirect('/dashboard');

  const slug = user.referralSlug;
  const referralUrl = slug ? `${APP_URL}/?ref=${slug}` : null;

  let physician = null;
  if (slug) {
    physician = await prisma.physicianProfile.findUnique({
      where: { slug },
      select: { displayName: true, clinicName: true, specialty: true, slug: true, referralCode: true },
    });
  }

  const displayName = physician?.displayName ?? user.fullName ?? 'Physician';

  const navLinks = [
    { label: 'Dashboard',   href: '/doctor/dashboard' },
    { label: 'Patients',    href: '/doctor/patients' },
    { label: 'Start Sheet', href: '/doctor/start-sheet' },
    { label: 'Invite',      href: '/doctor/start' },
  ];

  return (
    <main style={{ background: '#080C14', minHeight: '100vh' }}>

      {/* Sticky nav */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: '#060D1E',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'baseline', gap: '2px', textDecoration: 'none', flexShrink: 0 }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em' }}>Myo</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#2DD4BF', letterSpacing: '-0.02em' }}>Guard</span>
          </Link>
          <nav style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, justifyContent: 'center' }}>
            {navLinks.map(({ label, href }) => {
              const active = href === '/doctor/start';
              return (
                <Link key={href} href={href} style={{
                  padding: '6px 14px', borderRadius: '8px', fontSize: '0.8125rem', fontWeight: 500, textDecoration: 'none',
                  color:      active ? '#2DD4BF' : 'rgba(255,255,255,0.55)',
                  background: active ? 'rgba(45,212,191,0.08)' : 'transparent',
                  transition: 'color 0.15s, background 0.15s',
                }}>
                  {label}
                </Link>
              );
            })}
          </nav>
          <PhysicianAvatar fullName={user.fullName ?? ''} email={user.email} role={user.role} />
        </div>
      </header>

      <div style={{ maxWidth: '768px', margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>Invite Patients</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '4px' }}>
            Everything you need to refer patients to the MyoGuard Protocol.
          </p>
        </div>

        {/* Referral Link */}
        <div style={{ background: '#0f1729', border: '1px solid #1e293b', borderRadius: '16px', padding: '20px' }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#2DD4BF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Your Referral Link</p>
          {referralUrl ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: '8px', padding: '12px 16px' }}>
                <code style={{ fontSize: '0.875rem', color: '#cbd5e1', flex: 1, wordBreak: 'break-all' }}>{referralUrl}</code>
                <CopyButton text={referralUrl} />
              </div>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '8px' }}>
                Share this link with patients. Their assessments will be attributed to your profile.
              </p>
            </>
          ) : (
            <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '8px', padding: '12px 16px' }}>
              <p style={{ fontSize: '0.875rem', color: '#fbbf24', fontWeight: 500, margin: 0 }}>No referral slug assigned</p>
              <p style={{ fontSize: '0.75rem', color: '#d97706', marginTop: '4px' }}>
                Contact <a href="mailto:hello@myoguard.health" style={{ color: '#2DD4BF' }}>hello@myoguard.health</a> to have a referral slug created for your account.
              </p>
            </div>
          )}
        </div>

        {/* QR Code */}
        {(() => {
          const inviteUrl = physician?.slug
            ? `${APP_URL}/invite/${physician.slug}`
            : null;
          return inviteUrl ? (
            <div style={{
              background: '#0f1729',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
            }}>
              <p style={{
                fontSize: '11px',
                color: 'rgba(255,255,255,0.35)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 600,
                margin: 0,
              }}>
                Patient QR Code
              </p>
              <PhysicianQRCode
                url={inviteUrl}
                physicianName={physician!.displayName}
              />
              <p style={{
                fontSize: '12px',
                color: 'rgba(255,255,255,0.5)',
                textAlign: 'center',
                margin: 0,
              }}>
                Print or display for patients to scan in your clinic
              </p>
            </div>
          ) : null;
        })()}

        {/* Patient Code + Join Link */}
        {physician?.referralCode ? (
          <div style={{ background: '#0f1729', border: '1px solid #1e293b', borderRadius: '16px', padding: '20px' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#2DD4BF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Patient Access Code</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(45,212,191,0.06)', border: '1px solid rgba(45,212,191,0.15)', borderRadius: '12px', padding: '12px 16px', marginBottom: '12px' }}>
              <code style={{ fontSize: '1.25rem', fontWeight: 900, color: '#2DD4BF', letterSpacing: '0.1em', flex: 1 }}>
                {physician.referralCode}
              </code>
              <CopyButton text={physician.referralCode} />
            </div>
            <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '16px' }}>
              Share this code with patients. They enter it during MyoGuard sign-up to automatically link their account to yours.
            </p>
            <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Or share the direct join link</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: '8px', padding: '10px 16px' }}>
              <code style={{ fontSize: '0.75rem', color: '#94a3b8', flex: 1, wordBreak: 'break-all' }}>
                {APP_URL}/join?ref={physician.referralCode}
              </code>
              <CopyButton text={`${APP_URL}/join?ref=${physician.referralCode}`} />
            </div>
            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '8px' }}>
              Patients who click this link will see your name and be guided through sign-up automatically.
            </p>
          </div>
        ) : slug ? (
          <div style={{ background: '#0f1729', border: '1px solid #1e293b', borderRadius: '16px', padding: '20px' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#2DD4BF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Patient Access Code</p>
            <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '8px', padding: '12px 16px' }}>
              <p style={{ fontSize: '0.875rem', color: '#fbbf24', fontWeight: 500, margin: 0 }}>Code not yet generated</p>
              <p style={{ fontSize: '0.75rem', color: '#d97706', marginTop: '4px' }}>
                Your patient access code will appear here after your account is fully activated.
                Contact <a href="mailto:hello@myoguard.health" style={{ color: '#2DD4BF' }}>hello@myoguard.health</a> if this persists.
              </p>
            </div>
          </div>
        ) : null}

        {/* How It Works */}
        <div style={{ background: '#0f1729', border: '1px solid #1e293b', borderRadius: '16px', padding: '20px' }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#2DD4BF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>How It Works</p>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { n: '1', head: 'Share your link', body: `Send patients ${referralUrl ?? 'your personalised referral URL'} via email, WhatsApp, or your patient portal.` },
              { n: '2', head: 'Patients complete the assessment', body: 'They enter their GLP-1 medication, dose, weight, activity level, and current symptoms. No account required.' },
              { n: '3', head: 'Protocol generated instantly', body: 'A personalised protein, fibre, and hydration protocol plus a MyoGuard Score are calculated and displayed in seconds.' },
            ].map(step => (
              <li key={step.n} style={{ display: 'flex', gap: '16px' }}>
                <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#0d9488', color: '#ffffff', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {step.n}
                </span>
                <div>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>{step.head}</p>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px', lineHeight: 1.6 }}>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Profile Summary */}
        {physician && (
          <div style={{ background: '#0f1729', border: '1px solid #1e293b', borderRadius: '16px', padding: '20px' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#2DD4BF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Your Profile</p>
            <dl style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <dt style={{ color: '#64748b', width: '128px', flexShrink: 0 }}>Display name</dt>
                <dd style={{ color: '#ffffff', fontWeight: 500, margin: 0 }}>{physician.displayName}</dd>
              </div>
              {physician.clinicName && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <dt style={{ color: '#64748b', width: '128px', flexShrink: 0 }}>Clinic</dt>
                  <dd style={{ color: '#e2e8f0', margin: 0 }}>{physician.clinicName}</dd>
                </div>
              )}
              {physician.specialty && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <dt style={{ color: '#64748b', width: '128px', flexShrink: 0 }}>Specialty</dt>
                  <dd style={{ color: '#e2e8f0', margin: 0 }}>{physician.specialty}</dd>
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <dt style={{ color: '#64748b', width: '128px', flexShrink: 0 }}>Slug</dt>
                <dd style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.75rem', margin: 0 }}>{physician.slug}</dd>
              </div>
            </dl>
            <p style={{ marginTop: '12px', fontSize: '0.75rem', color: '#64748b' }}>
              To update your profile details, contact <a href="mailto:hello@myoguard.health" style={{ color: '#2DD4BF' }}>hello@myoguard.health</a>.
            </p>
          </div>
        )}

        {/* Patient Panel */}
        <div style={{ background: '#0f1729', border: '1px solid #1e293b', borderRadius: '16px', padding: '20px' }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#2DD4BF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Patient Overview</p>
          <p style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.6, marginBottom: '16px' }}>
            View all your attributed patients, sorted by highest muscle-protection risk. Each patient card shows their latest MyoGuard Score, risk band, and key clinical flags.
          </p>
          <Link
            href="/doctor/patients"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#0d9488', color: '#ffffff', fontSize: '0.875rem', fontWeight: 600, padding: '10px 20px', borderRadius: '10px', textDecoration: 'none' }}
          >
            View Patient List →
          </Link>
        </div>

      </div>
    </main>
  );
}
