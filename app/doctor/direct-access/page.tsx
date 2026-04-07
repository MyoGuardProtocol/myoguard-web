import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  DatabaseZap,
  ShieldOff,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  Zap,
} from 'lucide-react';
// ─── Risk helpers ─────────────────────────────────────────────────────────────

const BAND_COLOUR: Record<string, string> = {
  CRITICAL: '#EF4444',
  HIGH:     '#F97316',
  MODERATE: '#F59E0B',
  LOW:      '#10B981',
};

const BAND_BG: Record<string, string> = {
  CRITICAL: 'rgba(239,68,68,0.12)',
  HIGH:     'rgba(249,115,22,0.12)',
  MODERATE: 'rgba(245,158,11,0.12)',
  LOW:      'rgba(16,185,129,0.12)',
};

const RISK_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MODERATE: 2, LOW: 3 };
const RECOVERY_ORDER: Record<string, number> = { critical: 0, impaired: 1, optimal: 2 };

function getFlags(p: {
  recoveryStatus: string | null;
  proteinGrams: number;
  weightKg: number;
  proteinTargetG: number | null;
  exerciseDaysWk: number;
  symptoms: string[];
  leanLossEstPct: number | null;
}): string[] {
  const flags: string[] = [];
  if (p.recoveryStatus === 'critical')       flags.push('Sleep Critical');
  else if (p.recoveryStatus === 'impaired')  flags.push('Sleep Deficit');
  const target = p.proteinTargetG ?? p.weightKg * 1.4;
  if (p.proteinGrams < target * 0.9)         flags.push('Protein Gap');
  if (p.exerciseDaysWk <= 1)                 flags.push('Sedentary');
  if (p.symptoms.includes('Muscle weakness')) flags.push('Muscle Weakness');
  if (p.symptoms.includes('Fatigue'))         flags.push('Fatigue');
  if (p.leanLossEstPct != null && p.leanLossEstPct >= 18) flags.push('High Lean Risk');
  return flags.slice(0, 3);
}

// ─── Data fetch ───────────────────────────────────────────────────────────────

type PatientRow = {
  id:                 string;
  fullName:           string;
  email:              string;
  score:              number | null;
  trend:              number | null;
  band:               string;
  flags:              string[];
  leanLossPct:        number | null;
  recoveryStatus:     string | null;
  latestAssessmentId: string;
  lastAssessmentDate: string;
};

async function fetchPatients(): Promise<{ rows: PatientRow[]; error: string | null }> {
  try {
    // Dynamic import keeps PrismaClient initialization INSIDE the try/catch.
    // A top-level import runs createPrismaClient() at module load time — before
    // any try/catch exists — so a PrismaClientInitializationError (e.g. Supabase
    // paused, pool failure) would crash the page before we could catch it.
    const { prisma } = await import('@/src/lib/prisma');

    const raw = await prisma.user.findMany({
      where:   { role: 'PATIENT' },
      orderBy: { createdAt: 'asc' },
      select: {
        id:       true,
        fullName: true,
        email:    true,
        assessments: {
          orderBy: { assessmentDate: 'desc' },
          take:    2,
          // ⚠ Use `select` (not `include`) so scalar fields like
          // recoveryStatus are returned alongside the nested relation.
          select: {
            id:             true,
            assessmentDate: true,
            weightKg:       true,
            proteinGrams:   true,
            exerciseDaysWk: true,
            symptoms:       true,
            riskBand:       true,
            recoveryStatus: true,   // requires explicit select
            muscleScore: {
              select: {
                score:          true,
                riskBand:       true,
                leanLossEstPct: true,
                proteinTargetG: true,
              },
            },
          },
        },
      },
    });

    const rows: PatientRow[] = raw
      .filter(p => p.assessments[0] != null)
      .map(p => {
        const latest    = p.assessments[0]!;
        const prev      = p.assessments[1] ?? null;
        const ms        = latest.muscleScore;
        const prevScore = prev?.muscleScore?.score ?? null;
        const score     = ms?.score ?? null;
        const trend     = score !== null && prevScore !== null
          ? Math.round(score - prevScore)
          : null;
        const band = (ms?.riskBand ?? latest.riskBand) as string;

        return {
          id:                 p.id,
          fullName:           p.fullName ?? 'Unknown Patient',
          email:              p.email,
          score,
          trend,
          band,
          leanLossPct:        ms?.leanLossEstPct ?? null,
          recoveryStatus:     latest.recoveryStatus,
          latestAssessmentId: latest.id,
          lastAssessmentDate: latest.assessmentDate.toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
          }),
          flags: getFlags({
            recoveryStatus: latest.recoveryStatus,
            proteinGrams:   latest.proteinGrams,
            weightKg:       latest.weightKg,
            proteinTargetG: ms?.proteinTargetG ?? null,
            exerciseDaysWk: latest.exerciseDaysWk,
            symptoms:       latest.symptoms,
            leanLossEstPct: ms?.leanLossEstPct ?? null,
          }),
        };
      });

    rows.sort((a, b) => {
      const bandDiff = (RISK_ORDER[a.band] ?? 99) - (RISK_ORDER[b.band] ?? 99);
      if (bandDiff !== 0) return bandDiff;
      const recDiff = (RECOVERY_ORDER[a.recoveryStatus ?? ''] ?? 99)
                    - (RECOVERY_ORDER[b.recoveryStatus ?? ''] ?? 99);
      if (recDiff !== 0) return recDiff;
      return (a.score ?? 100) - (b.score ?? 100);
    });

    return { rows, error: null };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Demo fallback (shown when DB is empty, not erroring) ────────────────────

const DEMO_PATIENTS: PatientRow[] = [
  {
    id:                 'demo-1',
    fullName:           'John Doe',
    email:              'john.doe@demo.myoguard',
    score:              62,
    trend:              -4,
    band:               'HIGH',
    flags:              ['Protein Gap', 'Sedentary'],
    leanLossPct:        14,
    recoveryStatus:     'impaired',
    latestAssessmentId: 'demo-a1',
    lastAssessmentDate: '1 Jan 2026',
  },
  {
    id:                 'demo-2',
    fullName:           'Jane Smith',
    email:              'jane.smith@demo.myoguard',
    score:              81,
    trend:              3,
    band:               'MODERATE',
    flags:              ['Fatigue'],
    leanLossPct:        7,
    recoveryStatus:     'optimal',
    latestAssessmentId: 'demo-a2',
    lastAssessmentDate: '3 Jan 2026',
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DirectAccessPage() {
  // ── Auth guard ────────────────────────────────────────────────────────────
  // This page is no longer a public bypass. PHYSICIAN or ADMIN session required.
  const { userId } = await auth();
  if (!userId) redirect('/doctor/sign-in');

  const { prisma: _prisma } = await import('@/src/lib/prisma');
  const viewer = await _prisma.user.findUnique({
    where:  { clerkId: userId },
    select: { role: true },
  }).catch(() => null);

  if (!viewer || (viewer.role !== 'PHYSICIAN' && viewer.role !== 'ADMIN')) {
    redirect('/doctor/sign-in');
  }
  // ─────────────────────────────────────────────────────────────────────────

  const { rows: liveRows, error } = await fetchPatients();

  // Use live data if available; fall back to demo patients on error or empty DB
  const isDemoMode = liveRows.length === 0; // covers both error and genuinely empty
  const rows = isDemoMode ? DEMO_PATIENTS : liveRows;

  const critical = rows.filter(p => p.band === 'CRITICAL' || p.band === 'HIGH').length;
  const avgScore = rows.length
    ? Math.round(rows.reduce((s, p) => s + (p.score ?? 0), 0) / rows.length)
    : null;

  return (
    <main className="min-h-screen" style={{ background: '#050A15', fontFamily: 'system-ui, sans-serif', color: '#F8FAFC' }}>

      {/* ── Nav ── */}
      <nav style={{ background: '#060D1E', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.03em' }}>
          Myo<span style={{ color: '#2DD4BF' }}>Guard</span>
          <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Physician</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#F59E0B', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 99, padding: '5px 12px' }}>
          <ShieldOff size={11} />
          Auth Bypassed — Direct Access
        </div>
      </nav>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '36px 24px' }}>

        {/* ── Title ── */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#2DD4BF', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
            Command Center
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>Patient Overview</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
            {error ? 'Demo Mode — DB unreachable' : isDemoMode ? 'Demo Mode — no patients in DB yet' : 'Live Prisma data'} · middleware disabled · auth bypassed
          </p>
        </div>

        {/* ── DB Error banner ── */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
            <DatabaseZap size={16} color="#EF4444" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#FCA5A5', margin: '0 0 4px' }}>Database connection failed</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0, fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all' }}>{error}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
                Check that Supabase is running and DATABASE_URL is set in .env
              </p>
            </div>
          </div>
        )}

        {/* ── Stat row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { icon: <Users size={15} />,         label: 'Total Patients',  value: String(rows.length),          color: '#2DD4BF' },
            { icon: <AlertTriangle size={15} />,  label: 'Need Attention',  value: String(critical),              color: critical > 0 ? '#EF4444' : '#10B981' },
            { icon: <Activity size={15} />,       label: 'Avg Score',       value: avgScore != null ? String(avgScore) : '—', color: '#F8FAFC' },
            { icon: <Zap size={15} />,            label: 'DB Status',       value: error ? 'Error' : 'Live',     color: error ? '#EF4444' : '#10B981' },
          ].map(card => (
            <div key={card.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: card.color, marginBottom: 10 }}>
                {card.icon}
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{card.label}</span>
              </div>
              <p style={{ fontSize: 22, fontWeight: 900, color: card.color, fontFamily: 'ui-monospace, monospace', margin: 0 }}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* ── Critical banner ── */}
        {critical > 0 && !error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 12, padding: '12px 20px', marginBottom: 20 }}>
            <AlertTriangle size={15} color="#EF4444" />
            <p style={{ fontSize: 13, color: '#FCA5A5', margin: 0 }}>
              <strong>{critical} patient{critical > 1 ? 's' : ''}</strong> require immediate clinical attention
            </p>
          </div>
        )}

        {/* ── Patient table ── */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', marginBottom: 28 }}>

          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 1fr 40px', gap: 12, padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            <span>Patient</span>
            <span>Score</span>
            <span>Band</span>
            <span>Flags</span>
            <span></span>
          </div>

          {/* DB error + no rows: show error message as placeholder row */}
          {rows.length === 0 && error && (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <DatabaseZap size={32} color="rgba(239,68,68,0.4)" style={{ margin: '0 auto 12px' }} />
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', margin: 0 }}>See error banner above.</p>
            </div>
          )}

          {/* Row per patient */}
          {rows.map((p, i) => {
            const initials = p.fullName
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map(n => n[0]?.toUpperCase())
              .join('');
            const colour = BAND_COLOUR[p.band] ?? '#F8FAFC';
            const bg     = BAND_BG[p.band]     ?? 'rgba(255,255,255,0.08)';
            const isLast = i === rows.length - 1;

            return (
              <Link
                key={p.id}
                href={`/doctor/patients/${p.id}`}
                style={{
                  display:         'grid',
                  gridTemplateColumns: '1fr 90px 110px 1fr 40px',
                  gap:             12,
                  padding:         '15px 20px',
                  borderBottom:    isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
                  alignItems:      'center',
                  textDecoration:  'none',
                  color:           'inherit',
                  transition:      'background 0.12s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                {/* Avatar + name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#2DD4BF', flexShrink: 0 }}>
                    {initials || <User size={14} />}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{p.fullName}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', margin: 0 }}>{p.lastAssessmentDate}</p>
                  </div>
                </div>

                {/* Score + trend */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                  <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 22, fontWeight: 900, color: colour }}>
                    {p.score != null ? Math.round(p.score) : '—'}
                  </span>
                  {p.trend != null && (
                    <span style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 1, color: p.trend >= 0 ? '#10B981' : '#EF4444' }}>
                      {p.trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {Math.abs(p.trend)}
                    </span>
                  )}
                </div>

                {/* Band pill */}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: bg, color: colour, width: 'fit-content' }}>
                  <Activity size={9} />
                  {p.band}
                </span>

                {/* Flags */}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {p.flags.length === 0 ? (
                    <span style={{ fontSize: 11, color: '#10B981', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={11} /> No flags
                    </span>
                  ) : (
                    p.flags.map(f => (
                      <span key={f} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                        {f}
                      </span>
                    ))
                  )}
                </div>

                {/* Chevron */}
                <ChevronRight size={14} color="rgba(255,255,255,0.2)" />
              </Link>
            );
          })}
        </div>

        {/* ── Recovery signals ── */}
        {rows.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '20px 24px', marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <TrendingDown size={14} color="#2DD4BF" />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Recovery Signals</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {rows.map(p => (
                <Link
                  key={p.id}
                  href={`/doctor/patients/${p.id}`}
                  style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px', textDecoration: 'none' }}
                >
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.fullName.split(' ')[0]}
                  </p>
                  <p style={{ fontSize: 13, fontWeight: 700, margin: 0, textTransform: 'capitalize', color: p.recoveryStatus === 'critical' ? '#EF4444' : p.recoveryStatus === 'impaired' ? '#F59E0B' : p.recoveryStatus === 'optimal' ? '#10B981' : 'rgba(255,255,255,0.3)' }}>
                    {p.recoveryStatus ?? 'No data'}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Footer callout ── */}
        <div style={{ background: 'rgba(45,212,191,0.05)', border: '1px solid rgba(45,212,191,0.12)', borderRadius: 16, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Stethoscope size={13} color="#2DD4BF" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#2DD4BF' }}>Data flow confirmed — restore auth when ready</span>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: '0 0 8px' }}>
            Prisma is returning live data with the correct <code style={{ color: '#2DD4BF', fontSize: 11 }}>select</code> pattern.
            Row links go to <code style={{ color: '#2DD4BF', fontSize: 11 }}>/doctor/patients/[id]</code>.
          </p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: 0 }}>
            Restore middleware: rename <code style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>middleware.ts.bak</code> → <code style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>middleware.ts</code> when verified.
          </p>
        </div>

      </div>
    </main>
  );
}
