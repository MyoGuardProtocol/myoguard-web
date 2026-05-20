import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';

/**
 * /doctor — Physician portal landing page (Midnight Silk).
 *
 * Signed-in physicians are routed directly to their portal.
 * Signed-in patients see the page with a sign-up CTA (no patient data exposed).
 * Unauthenticated visitors see the full landing.
 */
export default async function DoctorLandingPage() {
  const { userId } = await auth();

  let ctaHref = '/doctor/sign-in';

  if (userId) {
    const user = await prisma.user.findUnique({
      where:  { clerkId: userId },
      select: { role: true },
    });
    if (user?.role === 'PHYSICIAN')         redirect('/doctor/patients');
    if (user?.role === 'PHYSICIAN_PENDING') redirect('/doctor/dashboard');
    if (user?.role === 'PATIENT')           ctaHref = '/doctor/sign-up';
  }

  const features = [
    { label: 'MyoGuard Score',  detail: 'Per-patient muscle risk 0–100' },
    { label: 'Clinical Flags',  detail: 'Protein deficit, fatigue, weakness' },
    { label: 'Risk Bands',      detail: 'Low → Critical prioritisation' },
  ];

  const trust = ['Physician-Formulated', 'Evidence-Based', 'GLP-1 Specialist Tool'];

  return (
    <main style={{ minHeight: '100vh', background: '#080C14', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <header style={{ background: '#060D1E', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 24px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: '2px' }}>
            <span style={{ fontSize: '18px', fontWeight: 900, color: '#F8FAFC', letterSpacing: '-0.02em' }}>Myo</span>
            <span style={{ fontSize: '18px', fontWeight: 900, color: '#2DD4BF', letterSpacing: '-0.02em' }}>Guard</span>
            <span style={{ color: '#475569', fontWeight: 300, fontSize: '12px', marginLeft: '4px' }}>Protocol</span>
          </Link>
          <Link
            href="/sign-in-new"
            style={{ fontSize: '12px', color: '#475569', textDecoration: 'none', fontWeight: 500 }}
          >
            Patient login →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '72px 24px 56px', textAlign: 'center' }}>

        {/* Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.2)', borderRadius: '99px', padding: '5px 14px', marginBottom: '32px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2DD4BF', display: 'inline-block' }} />
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#2DD4BF', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Physician Portal</span>
        </div>

        {/* Headline */}
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(32px, 6vw, 44px)', fontWeight: 400, color: '#F1F5F9', lineHeight: '1.2', marginBottom: '20px' }}>
          Built for Physicians.<br />Designed for Speed.
        </h1>
        <p style={{ fontSize: '16px', color: '#64748B', lineHeight: '1.7', marginBottom: '40px', maxWidth: '460px', margin: '0 auto 40px' }}>
          Monitor your GLP-1 patients&apos; muscle health in real-time. Clinical-grade risk
          scores, personalised protocols, and flag-based prioritisation — in under 60 seconds.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '360px', margin: '0 auto 48px' }}>
          <Link
            href={ctaHref}
            style={{
              display: 'block',
              background: '#2DD4BF',
              color: '#080C14',
              padding: '15px 24px',
              borderRadius: '14px',
              fontSize: '15px',
              fontWeight: 700,
              textDecoration: 'none',
              textAlign: 'center',
            }}
          >
            Continue as Physician →
          </Link>
          <Link
            href="/doctor/sign-up"
            style={{
              display: 'block',
              background: 'transparent',
              color: '#94A3B8',
              padding: '13px 24px',
              borderRadius: '14px',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
              textAlign: 'center',
              border: '1px solid #1A2744',
            }}
          >
            New to MyoGuard? Create account
          </Link>
          <p style={{ fontSize: '12px', color: '#334155', marginTop: '4px' }}>
            Sign in with email — no password required
          </p>
        </div>

        {/* Trust badges */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', marginBottom: '52px' }}>
          {trust.map(tag => (
            <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569' }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 12 12" stroke="#2DD4BF" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 6l3 3 5-5" />
              </svg>
              {tag}
            </span>
          ))}
        </div>

        {/* Feature grid — 1 col mobile, 3 col sm+ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10 text-left">
          {features.map(f => (
            <div
              key={f.label}
              style={{
                background: '#0D1421',
                border: '1px solid #1A2744',
                borderRadius: '14px',
                padding: '16px',
              }}
            >
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#F1F5F9', marginBottom: '4px' }}>{f.label}</p>
              <p style={{ fontSize: '12px', color: '#475569', lineHeight: '1.4', margin: 0 }}>{f.detail}</p>
            </div>
          ))}
        </div>

        {/* Patient link */}
        <p style={{ fontSize: '13px', color: '#334155' }}>
          Are you a patient?{' '}
          <Link href="/" style={{ color: '#2DD4BF', fontWeight: 500, textDecoration: 'none' }}>
            Take the assessment →
          </Link>
        </p>
      </div>
    </main>
  );
}
