/**
 * /doctor/patients/[userId]/print
 *
 * Physician-facing Clinical Protocol Export page.
 * Renders a complete, print-optimised patient protocol with MyoGuard branding.
 * Designed for A4/Letter paper — use browser "Print" → "Save as PDF".
 *
 * Auth: PHYSICIAN only. IDOR check ensures patient is linked to this physician.
 * Not linked to nav — opened via the PatientDrawer "Generate Protocol PDF" button.
 *
 * Print CSS: backgrounds are stripped by browsers by default.
 * All sections use black text on white with teal accent borders — readable in
 * both screen preview and printed output.
 */

import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import Link from 'next/link';
import PrintButton from './PrintButton';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function longDate(d: Date) {
  return d.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function shortDate(d: Date) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const BAND_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  LOW:      { label: 'Low Risk',      color: '#065F46', bg: '#ECFDF5', border: '#6EE7B7' },
  MODERATE: { label: 'Moderate Risk', color: '#92400E', bg: '#FFFBEB', border: '#FCD34D' },
  HIGH:     { label: 'High Risk',     color: '#9A3412', bg: '#FFF7ED', border: '#FDBA74' },
  CRITICAL: { label: 'Critical Risk', color: '#9F1239', bg: '#FFF1F2', border: '#FDA4AF' },
};

const RECOVERY_META: Record<string, { label: string; color: string }> = {
  optimal:  { label: 'Optimal',  color: '#065F46' },
  impaired: { label: 'Impaired', color: '#92400E' },
  critical: { label: 'Critical', color: '#9F1239' },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PrintPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect('/sign-in');

  // Physician auth guard
  const physician = await prisma.user.findUnique({
    where:  { clerkId },
    select: { id: true, role: true, referralSlug: true, fullName: true },
  });
  if (!physician) redirect('/dashboard');
  if (physician.role === 'PHYSICIAN_PENDING') redirect('/doctor/dashboard');
  if (physician.role !== 'PHYSICIAN') redirect('/dashboard');

  const { userId: patientId } = await params;

  // IDOR guard
  const orClauses: Record<string, unknown>[] = [{ physicianId: physician.id }];
  if (physician.referralSlug) {
    orClauses.push({ referralSlug: physician.referralSlug });
  }
  const ownership = await prisma.user.findFirst({
    where: { id: patientId, role: 'PATIENT', OR: orClauses },
    select: { id: true },
  });
  if (!ownership) redirect('/doctor/patients');

  // Fetch patient + latest assessment with full protocol
  const patient = await prisma.user.findUnique({
    where:  { id: patientId },
    select: {
      fullName: true,
      email:    true,
      assessments: {
        orderBy: { assessmentDate: 'desc' },
        take:    1,
        include: {
          muscleScore:  { select: { score: true, riskBand: true, leanLossEstPct: true, proteinTargetG: true, explanation: true } },
          protocolPlan: { select: { proteinTargetG: true, proteinSources: true, supplementation: true, trainingPlan: true, hydrationTarget: true, electrolyteNotes: true, giGuidance: true } },
          physicianReview: { select: { overallImpression: true, followUpDays: true, note: true, reviewedAt: true } },
        },
      },
    },
  });

  if (!patient) notFound();

  const latest     = patient.assessments[0];
  const ms         = latest?.muscleScore;
  const plan       = latest?.protocolPlan;
  const review     = latest?.physicianReview;
  const band       = ms?.riskBand ?? 'LOW';
  const bm         = BAND_META[band] ?? BAND_META.LOW;
  const score      = ms?.score != null ? Math.round(ms.score) : null;
  const recStatus  = latest?.recoveryStatus;
  const recMeta    = recStatus ? (RECOVERY_META[recStatus] ?? null) : null;
  const today      = new Date();

  // Physician display name
  let physicianDisplayName = physician.fullName ?? 'Physician';
  if (physician.referralSlug) {
    const profile = await prisma.physicianProfile.findUnique({
      where:  { slug: physician.referralSlug },
      select: { displayName: true },
    });
    if (profile?.displayName) physicianDisplayName = profile.displayName;
  }

  return (
    <html lang="en">
      <head>
        <title>MyoGuard Protocol — {patient.fullName}</title>
        <style>{`
          @page { size: A4; margin: 18mm 15mm; }
          * { box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0F172A; background: #fff; font-size: 11pt; line-height: 1.5; }
          @media print { .no-print { display: none !important; } }
          .mono { font-family: 'Courier New', Courier, monospace; }
          .section-rule { border: none; border-top: 1px solid #E2E8F0; margin: 16px 0; }
          .thick-rule { border: none; border-top: 2px solid #0D9488; margin: 20px 0; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 5px 8px; text-align: left; font-size: 10pt; }
          th { background: #F8FAFC; color: #64748B; font-weight: 600; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #E2E8F0; }
          td { border-bottom: 1px solid #F1F5F9; }
          .badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 99px; font-size: 9.5pt; font-weight: 700; border: 1px solid; }
        `}</style>
      </head>
      <body>
        {/* ── Screen-only toolbar ──────────────────────────────────────────── */}
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', marginBottom: 0 }}>
          <Link href={`/doctor/patients/${patientId}`} style={{ fontSize: 12, color: '#0D9488', fontWeight: 600, textDecoration: 'none' }}>
            ← Back to Patient
          </Link>
          <span style={{ flex: 1 }} />
          <PrintButton />
        </div>

        {/* ── Document body ────────────────────────────────────────────────── */}
        <div style={{ maxWidth: 740, margin: '0 auto', padding: '24px 20px' }}>

          {/* ── Header ───────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', color: '#0F172A' }}>
                  Myo<span style={{ color: '#0D9488' }}>Guard</span>
                </span>
                <span style={{ fontSize: 11, fontWeight: 300, color: '#94A3B8' }}>Protocol</span>
              </div>
              <p style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>
                Clinical Decision Support · myoguard.health
              </p>
            </div>
            <div style={{ textAlign: 'right', fontSize: 9.5, color: '#64748B' }}>
              <p style={{ fontWeight: 600, color: '#0F172A', fontSize: 11 }}>CLINICAL PROTOCOL REPORT</p>
              <p>Generated: {longDate(today)}</p>
              <p>Prepared by: {physicianDisplayName}</p>
            </div>
          </div>

          <div style={{ height: 3, background: 'linear-gradient(to right, #0D9488, #14B8A6, #5EEAD4)', borderRadius: 2, marginBottom: 20 }} />

          {/* ── Patient identity ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Patient</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>{patient.fullName}</p>
              <p style={{ fontSize: 10, color: '#64748B' }}>{patient.email}</p>
              {latest && (
                <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                  Assessment: {shortDate(latest.assessmentDate)} · {latest.weightKg}kg · {latest.exerciseDaysWk}d/wk exercise
                </p>
              )}
            </div>

            {score !== null && (
              <div style={{ textAlign: 'center', minWidth: 120 }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>MyoGuard Score</p>
                <p className="mono" style={{ fontSize: 48, fontWeight: 900, lineHeight: 1, color: '#0F172A' }}>
                  {score}
                </p>
                <p style={{ fontSize: 9.5, color: '#94A3B8', marginTop: 2 }}>/100</p>
                <span
                  className="badge"
                  style={{
                    background: bm.bg,
                    color:      bm.color,
                    borderColor: bm.border,
                    marginTop: 6,
                    fontSize: 8.5,
                  }}
                >
                  {bm.label}
                </span>
              </div>
            )}
          </div>

          <hr className="section-rule" />

          {/* ── Score explanation ────────────────────────────────────────── */}
          {ms?.explanation && (
            <>
              <p style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Clinical Rationale</p>
              <p style={{ fontSize: 10.5, color: '#334155', lineHeight: 1.6, marginBottom: 16 }}>
                {ms.explanation}
              </p>
              <hr className="section-rule" />
            </>
          )}

          {/* ── Assessment metrics ───────────────────────────────────────── */}
          {latest && (
            <>
              <p style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Assessment Metrics</p>
              <table>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Reported Value</th>
                    <th>Target / Reference</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Protein */}
                  <tr>
                    <td>Protein Intake</td>
                    <td className="mono" style={{ fontWeight: 700 }}>{Math.round(latest.proteinGrams)}g / day</td>
                    <td className="mono">{ms?.proteinTargetG ? `≥ ${Math.round(ms.proteinTargetG)}g` : `≥ ${Math.round(latest.weightKg * 1.4)}g`}</td>
                    <td>
                      {latest.proteinGrams >= latest.weightKg * 1.4
                        ? <span style={{ color: '#065F46', fontWeight: 600 }}>✓ Meeting target</span>
                        : <span style={{ color: '#9A3412', fontWeight: 600 }}>✗ Below target</span>
                      }
                    </td>
                  </tr>
                  {/* Lean loss */}
                  {ms?.leanLossEstPct != null && (
                    <tr>
                      <td>Lean Mass Loss Risk</td>
                      <td className="mono" style={{ fontWeight: 700 }}>{ms.leanLossEstPct.toFixed(1)}%</td>
                      <td className="mono">{'< 10%'}</td>
                      <td>
                        {ms.leanLossEstPct < 10
                          ? <span style={{ color: '#065F46', fontWeight: 600 }}>✓ Acceptable</span>
                          : ms.leanLossEstPct < 18
                          ? <span style={{ color: '#92400E', fontWeight: 600 }}>⚠ Elevated</span>
                          : <span style={{ color: '#9F1239', fontWeight: 600 }}>✗ High risk</span>
                        }
                      </td>
                    </tr>
                  )}
                  {/* Activity */}
                  <tr>
                    <td>Exercise Frequency</td>
                    <td className="mono" style={{ fontWeight: 700 }}>{latest.exerciseDaysWk} day{latest.exerciseDaysWk !== 1 ? 's' : ''} / week</td>
                    <td className="mono">≥ 3 days</td>
                    <td>
                      {latest.exerciseDaysWk >= 4
                        ? <span style={{ color: '#065F46', fontWeight: 600 }}>✓ Active</span>
                        : latest.exerciseDaysWk >= 2
                        ? <span style={{ color: '#92400E', fontWeight: 600 }}>⚠ Moderate</span>
                        : <span style={{ color: '#9F1239', fontWeight: 600 }}>✗ Sedentary</span>
                      }
                    </td>
                  </tr>
                  {/* Hydration */}
                  <tr>
                    <td>Hydration</td>
                    <td className="mono" style={{ fontWeight: 700 }}>{latest.hydrationLitres.toFixed(1)}L / day</td>
                    <td className="mono">≥ 2.0L</td>
                    <td>
                      {latest.hydrationLitres >= 2.0
                        ? <span style={{ color: '#065F46', fontWeight: 600 }}>✓ Adequate</span>
                        : <span style={{ color: '#9A3412', fontWeight: 600 }}>✗ Below target</span>
                      }
                    </td>
                  </tr>
                  {/* Sleep */}
                  {(latest.sleepHours != null || latest.sleepQuality != null) && (
                    <tr>
                      <td>Sleep / Recovery</td>
                      <td className="mono" style={{ fontWeight: 700 }}>
                        {latest.sleepHours != null ? `${latest.sleepHours.toFixed(1)} hrs/night` : '—'}
                        {latest.sleepQuality != null ? ` · Quality ${latest.sleepQuality}/5` : ''}
                      </td>
                      <td className="mono">7–9 hrs · ≥ 3/5</td>
                      <td>
                        {recMeta
                          ? <span style={{ color: recMeta.color, fontWeight: 600 }}>{recMeta.label}</span>
                          : '—'
                        }
                      </td>
                    </tr>
                  )}
                  {/* Symptoms */}
                  {latest.symptoms.length > 0 && (
                    <tr>
                      <td>Reported Symptoms</td>
                      <td colSpan={2}>{latest.symptoms.join(' · ')}</td>
                      <td>
                        {latest.symptoms.some(s => ['Muscle weakness', 'Fatigue'].includes(s))
                          ? <span style={{ color: '#9F1239', fontWeight: 600 }}>⚠ Review</span>
                          : <span style={{ color: '#92400E', fontWeight: 600 }}>Monitor</span>
                        }
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <hr className="section-rule" style={{ marginTop: 16 }} />
            </>
          )}

          {/* ── Protocol Plan ────────────────────────────────────────────── */}
          {plan && (
            <>
              <p style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                Protocol Recommendations
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                {/* Protein */}
                <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 12px', borderLeft: '3px solid #0D9488' }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Protein Target</p>
                  <p className="mono" style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                    {Math.round(plan.proteinTargetG)}g<span style={{ fontSize: 10, fontWeight: 400, color: '#64748B' }}> / day (standard)</span>
                  </p>
                  {plan.proteinSources.length > 0 && (
                    <p style={{ fontSize: 9.5, color: '#64748B', marginTop: 4 }}>
                      Sources: {plan.proteinSources.slice(0, 3).join(', ')}
                    </p>
                  )}
                </div>

                {/* Hydration */}
                <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 12px', borderLeft: '3px solid #38BDF8' }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Hydration Target</p>
                  <p className="mono" style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                    {plan.hydrationTarget.toFixed(1)}L<span style={{ fontSize: 10, fontWeight: 400, color: '#64748B' }}> / day</span>
                  </p>
                  {plan.electrolyteNotes && (
                    <p style={{ fontSize: 9.5, color: '#64748B', marginTop: 4 }}>{plan.electrolyteNotes}</p>
                  )}
                </div>
              </div>

              {/* Training */}
              <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 12px', marginBottom: 10, borderLeft: '3px solid #A78BFA' }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Training Plan</p>
                <p style={{ fontSize: 10.5, color: '#334155', lineHeight: 1.5 }}>{plan.trainingPlan}</p>
              </div>

              {/* GI guidance */}
              {plan.giGuidance && (
                <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 12px', marginBottom: 10, borderLeft: '3px solid #FB923C' }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>GI / Tolerability Guidance</p>
                  <p style={{ fontSize: 10.5, color: '#334155', lineHeight: 1.5 }}>{plan.giGuidance}</p>
                </div>
              )}

              {/* Supplementation */}
              {plan.supplementation.length > 0 && (
                <>
                  <p style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Supplementation Protocol</p>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {plan.supplementation.map((s, i) => (
                      <li key={i} style={{ fontSize: 10.5, color: '#334155', marginBottom: 3 }}>{s}</li>
                    ))}
                  </ul>
                </>
              )}

              <hr className="section-rule" style={{ marginTop: 16 }} />
            </>
          )}

          {/* ── Physician review note ────────────────────────────────────── */}
          {review?.note && (
            <>
              <p style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Physician Note</p>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
                <p style={{ fontSize: 10.5, color: '#334155', lineHeight: 1.6, fontStyle: 'italic' }}>
                  &ldquo;{review.note}&rdquo;
                </p>
                {review.overallImpression && (
                  <p style={{ fontSize: 9.5, color: '#64748B', marginTop: 6 }}>
                    Clinical impression: <strong>{review.overallImpression}</strong>
                    {review.followUpDays ? ` · Follow-up in ${review.followUpDays} days` : ''}
                  </p>
                )}
              </div>
              <hr className="section-rule" />
            </>
          )}

          {/* ── Disclaimer footer ────────────────────────────────────────── */}
          <div style={{ marginTop: 24, paddingTop: 14, borderTop: '2px solid #0D9488' }}>
            <p style={{ fontSize: 8.5, color: '#64748B', lineHeight: 1.6, marginBottom: 8 }}>
              <strong style={{ color: '#334155' }}>DISCLAIMER:</strong> MyoGuard is a clinical decision support tool designed to assist healthcare professionals in making nutritional and lifestyle recommendations for patients on GLP-1 receptor agonist therapy. It does not constitute a standalone medical diagnosis, does not replace clinical judgement, and should not be used as the sole basis for treatment decisions. All recommendations must be reviewed and validated by the prescribing physician in the context of the patient&apos;s full clinical picture. MyoGuard assumes no liability for clinical outcomes arising from use of this output.
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8.5, color: '#94A3B8' }}>
              <span>© 2026 MyoGuard Protocol · myoguard.health</span>
              <span>Prepared by: {physicianDisplayName} · {shortDate(today)}</span>
            </div>
          </div>

        </div>
      </body>
    </html>
  );
}
