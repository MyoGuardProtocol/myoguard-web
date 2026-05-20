export default async function PhysicianPendingPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: '#080C14', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
    >
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <span style={{
            fontSize: '20px', fontWeight: '900',
            letterSpacing: '-0.03em', color: '#F8FAFC',
          }}>
            Myo<span style={{ color: '#2DD4BF' }}>Guard</span>
          </span>
          <span style={{ color: '#475569', fontWeight: '300', fontSize: '13px', marginLeft: '4px' }}>
            Protocol
          </span>
        </div>

        {/* Card */}
        <div
          className="flex flex-col gap-6 text-center p-6 sm:p-10"
          style={{ background: '#0D1421', border: '1px solid #1A2744', borderRadius: '20px' }}
        >

          {/* Clock icon */}
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto flex-shrink-0"
            style={{
              background: 'rgba(45,212,191,0.08)',
              border: '1px solid rgba(45,212,191,0.2)',
            }}
          >
            <svg
              className="w-7 h-7"
              style={{ color: '#2DD4BF' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
            </svg>
          </div>

          {/* Heading + body */}
          <div className="flex flex-col gap-2">
            <h1 style={{
              fontFamily: 'Georgia, serif',
              fontSize: '22px', fontWeight: '400',
              color: '#F1F5F9', lineHeight: '1.3',
            }}>
              Application under review
            </h1>
            <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: '1.7' }}>
              Applications are typically reviewed within{' '}
              <strong style={{ color: '#F1F5F9', fontWeight: '600' }}>24 hours</strong>.
              {' '}Your credentials are reviewed by our clinical team. You will receive an
              activation email once your account is approved.
            </p>
          </div>

          {/* Info box — dark surface, consistent with dashboard pattern */}
          <div
            className="text-left"
            style={{
              background: '#060D1E',
              border: '1px solid #1A2744',
              borderRadius: '12px',
              padding: '16px',
            }}
          >
            <p style={{
              fontSize: '11px', fontWeight: '600',
              color: '#475569', textTransform: 'uppercase',
              letterSpacing: '0.08em', marginBottom: '8px',
            }}>
              While you wait
            </p>
            <p style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.6' }}>
              You can explore the Sarcopenia Risk Index (SRI) assessment as a patient to see
              what your future patients will experience. MyoGuard Protocol is a Physician-led
              Clinical Decision Support (CDS) platform — all clinical decisions remain with
              the treating physician.
            </p>
          </div>

          {/* Pending patient invitation context */}
          {invite && (
            <div
              style={{
                background: 'rgba(45,212,191,0.05)',
                border: '1px solid rgba(45,212,191,0.2)',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'left',
              }}
            >
              <p style={{
                fontSize: '11px', fontWeight: '600',
                color: '#2DD4BF', textTransform: 'uppercase',
                letterSpacing: '0.08em', marginBottom: '8px',
              }}>
                Patient invitation saved
              </p>
              <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: '1.6' }}>
                A patient has invited you to view their Sarcopenia Risk Index (SRI) report.
                Once your account is approved, sign in to accept the patient and add them
                to your Clinical Command Center.
              </p>
            </div>
          )}

          {/* CTA */}
          <a
            href="/"
            className="w-full bg-teal-500 hover:bg-teal-400 text-white py-3 rounded-xl text-sm font-semibold transition-colors text-center block"
          >
            Try the assessment
          </a>

          {/* Support contact */}
          <p style={{ fontSize: '12px', color: '#64748B' }}>
            Questions? Contact us at{' '}
            <a
              href="mailto:support@myoguard.health"
              className="hover:underline"
              style={{ color: '#2DD4BF' }}
            >
              support@myoguard.health
            </a>
          </p>

        </div>
      </div>
    </div>
  );
}
