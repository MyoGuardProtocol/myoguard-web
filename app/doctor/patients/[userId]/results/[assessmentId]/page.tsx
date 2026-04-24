import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import Link from 'next/link';

// ─── Risk meta ────────────────────────────────────────────────────────────────

const RISK_META: Record<string, {
  label:  string;
  color:  string;
  bg:     string;
  border: string;
}> = {
  LOW:      { label: 'Low Risk',      color: '#10B981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.35)'  },
  MODERATE: { label: 'Moderate Risk', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)'  },
  HIGH:     { label: 'High Risk',     color: '#F97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.35)'  },
  CRITICAL: { label: 'Critical Risk', color: '#EF4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)'   },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PhysicianAssessmentResultPage({
  params,
}: {
  params: Promise<{ userId: string; assessmentId: string }>;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect('/sign-in');

  // Physician guard
  const physician = await prisma.user.findUnique({
    where:  { clerkId },
    select: { id: true, role: true, referralSlug: true },
  });
  if (!physician)                            redirect('/dashboard');
  if (physician.role === 'PHYSICIAN_PENDING') redirect('/doctor/dashboard');
  if (physician.role !== 'PHYSICIAN')         redirect('/dashboard');

  const { userId: patientId, assessmentId } = await params;

  // Security: verify physician → patient ownership (IDOR prevention)
  const ownershipCheck = await prisma.user.findFirst({
    where: {
      id:   patientId,
      role: 'PATIENT',
      OR: [
        { physicianId: physician.id },
        ...(physician.referralSlug ? [{ referralSlug: physician.referralSlug }] : []),
      ],
    },
    select: { id: true, fullName: true, email: true },
  });
  if (!ownershipCheck) redirect('/doctor/patients');

  // Fetch assessment scoped to this patient (prevents cross-patient IDOR)
  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, userId: patientId },
    include: {
      muscleScore: {
        select: {
          score:          true,
          riskBand:       true,
          leanLossEstPct: true,
          proteinTargetG: true,
          explanation:    true,
        },
      },
    },
  });
  if (!assessment) notFound();

  const ms   = assessment.muscleScore;
  const band = (ms?.riskBand ?? 'LOW') as string;
  const rm   = RISK_META[band] ?? RISK_META.LOW;

  const scoreColor =
    band === 'LOW'      ? '#10B981' :
    band === 'MODERATE' ? '#F59E0B' :
    band === 'HIGH'     ? '#F97316' : '#EF4444';

  const assessmentDate = new Date(assessment.assessmentDate).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const patientName = ownershipCheck.fullName || 'Unknown Patient';

  return (
    <main style={{ background: '#080C14', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>

      {/* Nav */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: '#060D1E',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{
          maxWidth: '800px', margin: '0 auto', padding: '0 24px',
          height: '56px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'baseline', gap: '2px', textDecoration: 'none' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em' }}>Myo</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#2DD4BF', letterSpacing: '-0.02em' }}>Guard</span>
          </Link>
          <Link
            href={`/doctor/patients/${patientId}`}
            style={{ fontSize: '13px', color: '#2DD4BF', textDecoration: 'none', fontWeight: 500 }}
          >
            ← Back to {patientName}
          </Link>
        </div>
      </header>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Patient + date header */}
        <div>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
            Clinical Assessment Report
          </p>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#F1F5F9', marginBottom: '4px' }}>
            {patientName}
          </h1>
          <p style={{ fontSize: '13px', color: '#64748B' }}>
            {ownershipCheck.email} · {assessmentDate}
          </p>
        </div>

        {/* Score hero */}
        <div style={{
          background: '#0D1421', border: '1px solid #1A2744',
          borderRadius: '16px', padding: '28px 32px',
        }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '20px' }}>
            MyoGuard Score
          </p>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '24px', marginBottom: '20px' }}>
            <div>
              <p style={{
                fontSize: '72px', fontWeight: 900, lineHeight: 1,
                fontFamily: 'Georgia, serif', color: scoreColor,
              }}>
                {ms?.score != null ? Math.round(ms.score) : '—'}
              </p>
              <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>/100</p>
            </div>

            {/* Risk band pill */}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              fontSize: '12px', fontWeight: 700,
              padding: '6px 14px', borderRadius: '99px',
              background: rm.bg, color: rm.color,
              border: `1px solid ${rm.border}`,
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: rm.color, flexShrink: 0 }} />
              {rm.label}
            </span>
          </div>

          {/* Score bar */}
          {ms?.score != null && (
            <div style={{ height: '6px', borderRadius: '99px', background: '#1E2D45', overflow: 'hidden', marginBottom: '24px' }}>
              <div style={{ height: '100%', borderRadius: '99px', background: scoreColor, width: `${Math.round(ms.score)}%` }} />
            </div>
          )}

          {/* Key stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
            {[
              { label: 'Protein Target', value: ms?.proteinTargetG != null ? `${Math.round(ms.proteinTargetG)}g/day` : '—' },
              { label: 'Lean Loss Risk', value: ms?.leanLossEstPct != null ? `${ms.leanLossEstPct.toFixed(1)}%` : '—' },
              { label: 'Body Weight',    value: `${assessment.weightKg}kg` },
            ].map(stat => (
              <div key={stat.label} style={{ background: '#111927', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                <p style={{ fontSize: '15px', fontWeight: 700, color: '#F1F5F9', fontVariantNumeric: 'tabular-nums' }}>{stat.value}</p>
                <p style={{ fontSize: '10px', color: '#64748B', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Assessment inputs */}
        <div style={{
          background: '#0D1421', border: '1px solid #1A2744',
          borderRadius: '16px', padding: '24px 28px',
        }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '20px' }}>
            Assessment Inputs
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '20px' }}>
            {[
              { label: 'Daily Protein',  value: `${Math.round(assessment.proteinGrams)}g` },
              { label: 'Exercise Days',  value: `${assessment.exerciseDaysWk} day${assessment.exerciseDaysWk !== 1 ? 's' : ''}/week` },
              { label: 'Daily Hydration', value: `${assessment.hydrationLitres.toFixed(1)}L` },
              { label: 'Symptoms',       value: assessment.symptoms.length ? `${assessment.symptoms.length} reported` : 'None' },
            ].map(item => (
              <div key={item.label}>
                <p style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</p>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#CBD5E1', fontVariantNumeric: 'tabular-nums' }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Symptoms chips */}
          {assessment.symptoms.length > 0 && (
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #1A2744' }}>
              <p style={{ fontSize: '11px', color: '#64748B', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reported Symptoms</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {assessment.symptoms.map((sym: string) => (
                  <span key={sym} style={{
                    fontSize: '12px', fontWeight: 500,
                    background: 'rgba(148,163,184,0.1)',
                    color: '#94A3B8',
                    border: '1px solid rgba(148,163,184,0.2)',
                    borderRadius: '99px', padding: '4px 12px',
                  }}>
                    {sym}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* MuscleScore explanation + lean loss */}
        {(ms?.explanation || ms?.leanLossEstPct != null) && (
          <div style={{
            background: '#0D1421', border: '1px solid #1A2744',
            borderRadius: '16px', padding: '24px 28px',
            display: 'flex', flexDirection: 'column', gap: '20px',
          }}>
            {ms?.leanLossEstPct != null && (
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                  Lean Mass Loss Estimate
                </p>
                <p style={{
                  fontSize: '28px', fontWeight: 900,
                  fontFamily: 'Georgia, serif',
                  color: ms.leanLossEstPct >= 25 ? '#EF4444' : ms.leanLossEstPct >= 15 ? '#F97316' : '#F59E0B',
                }}>
                  {ms.leanLossEstPct.toFixed(1)}%
                </p>
                <p style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                  Estimated lean mass at risk during current GLP-1 protocol
                </p>
              </div>
            )}

            {ms?.explanation && (
              <div style={{ paddingTop: ms?.leanLossEstPct != null ? '20px' : 0, borderTop: ms?.leanLossEstPct != null ? '1px solid #1A2744' : 'none' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                  Score Explanation
                </p>
                <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: '1.65' }}>
                  {ms.explanation}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Back link */}
        <div style={{ paddingTop: '8px' }}>
          <Link
            href={`/doctor/patients/${patientId}`}
            style={{ fontSize: '13px', color: '#2DD4BF', textDecoration: 'none', fontWeight: 500 }}
          >
            ← Back to {patientName}
          </Link>
        </div>

      </div>
    </main>
  );
}
