/**
 * /admin/founders — Founder Pilot Monitoring Dashboard
 *
 * Operational visibility for the first Founding Clinical Partner cohort.
 * Displays physician subscription status, Stripe identifiers, and start-sheet
 * completion counts for manual pilot management.
 *
 * NO automation. NO conversion logic. Read-only.
 *
 * Access: ADMIN only (requireAdmin).
 */

import { redirect }     from 'next/navigation';
import { requireAdmin } from '@/src/lib/requireAdmin';
import { prisma }       from '@/src/lib/prisma';
import Link             from 'next/link';

export const dynamic = 'force-dynamic';

// ── Status badge colour map ──────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; text: string; border: string; label: string }> = {
  ACTIVE:    { bg: 'rgba(45,212,191,0.08)',  text: '#2DD4BF', border: 'rgba(45,212,191,0.25)', label: 'Active'     },
  FREE:      { bg: 'rgba(100,116,139,0.08)', text: '#94A3B8', border: 'rgba(100,116,139,0.2)', label: 'Free'       },
  PAST_DUE:  { bg: 'rgba(245,158,11,0.08)',  text: '#F59E0B', border: 'rgba(245,158,11,0.25)', label: 'Past Due'   },
  CANCELLED: { bg: 'rgba(239,68,68,0.06)',   text: '#EF4444', border: 'rgba(239,68,68,0.2)',   label: 'Cancelled'  },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.FREE;
  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      padding:       '3px 10px',
      borderRadius:  '99px',
      fontSize:      '11px',
      fontWeight:    600,
      background:    s.bg,
      color:         s.text,
      border:        `1px solid ${s.border}`,
      letterSpacing: '0.02em',
    }}>
      {s.label}
    </span>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function FoundersDashboardPage() {
  const { error } = await requireAdmin();
  if (error) redirect('/');

  // 1. All PHYSICIAN users (approved only — PHYSICIAN_PENDING excluded)
  const physicians = await prisma.user.findMany({
    where:   { role: 'PHYSICIAN' },
    select: {
      id:                 true,
      clerkId:            true,
      fullName:           true,
      email:              true,
      subscriptionStatus: true,
      stripeCustomerId:   true,
      stripeSubId:        true,
      createdAt:          true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // 2. Start-sheet counts — grouped by physicianClerkId (one query, no N+1)
  const sheetGroups = await prisma.startSheetProtocol.groupBy({
    by:    ['physicianClerkId'],
    _count: { id: true },
    where: {
      physicianClerkId: { in: physicians.map(p => p.clerkId) },
    },
  });
  const sheetCountMap = new Map(
    sheetGroups.map(g => [g.physicianClerkId, g._count.id]),
  );

  // 3. Approval dates from AuditLog (UPGRADE_PHYSICIAN actions)
  const auditEntries = await prisma.auditLog.findMany({
    where: {
      action:   'UPGRADE_PHYSICIAN',
      targetId: { in: physicians.map(p => p.id) },
    },
    orderBy: { createdAt: 'asc' },
    select:  { targetId: true, createdAt: true },
  });
  // Use the FIRST approval entry per physician (idempotent re-approvals are rare)
  const approvalDateMap = new Map<string, Date>();
  for (const entry of auditEntries) {
    if (entry.targetId && !approvalDateMap.has(entry.targetId)) {
      approvalDateMap.set(entry.targetId, entry.createdAt);
    }
  }

  // ── Summary counters ──────────────────────────────────────────────────────
  const activeCount     = physicians.filter(p => p.subscriptionStatus === 'ACTIVE').length;
  const totalSheets     = sheetGroups.reduce((sum, g) => sum + g._count.id, 0);

  const DATE_FMT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

  return (
    <div style={{
      minHeight:   '100vh',
      background:  '#080C14',
      color:       '#F1F5F9',
      fontFamily:  "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{
        background:    '#060D1E',
        borderBottom:  '1px solid #1A2744',
        position:      'sticky',
        top:           0,
        zIndex:        50,
        padding:       '0 24px',
      }}>
        <div style={{
          maxWidth:       '1100px',
          margin:         '0 auto',
          height:         '56px',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'baseline', gap: '2px', textDecoration: 'none' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em' }}>Myo</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#2DD4BF', letterSpacing: '-0.02em' }}>Guard</span>
            </Link>
            <nav style={{ display: 'flex', gap: '4px' }}>
              <Link href="/admin/physicians" style={{
                padding:        '5px 12px',
                borderRadius:   '8px',
                fontSize:       '0.8125rem',
                fontWeight:     500,
                textDecoration: 'none',
                color:          'rgba(255,255,255,0.5)',
                background:     'transparent',
              }}>
                Applications
              </Link>
              <Link href="/admin/founders" style={{
                padding:        '5px 12px',
                borderRadius:   '8px',
                fontSize:       '0.8125rem',
                fontWeight:     500,
                textDecoration: 'none',
                color:          '#2DD4BF',
                background:     'rgba(45,212,191,0.08)',
              }}>
                Founder Pilot
              </Link>
            </nav>
          </div>
          <span style={{ fontSize: '11px', color: '#475569', letterSpacing: '0.05em' }}>ADMIN</span>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px' }}>

        {/* Page heading */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{
            fontFamily:    'Georgia, serif',
            fontSize:      '26px',
            fontWeight:    400,
            color:         '#F1F5F9',
            marginBottom:  '6px',
            letterSpacing: '-0.01em',
          }}>
            Founder Pilot Monitoring
          </h1>
          <p style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.6 }}>
            Manual operational dashboard for the Founding Clinical Partner cohort.
            No automation — this view is read-only.
          </p>
        </div>

        {/* Pilot context card */}
        <div style={{
          background:    'rgba(45,212,191,0.04)',
          border:        '1px solid rgba(45,212,191,0.15)',
          borderRadius:  '14px',
          padding:       '18px 22px',
          marginBottom:  '28px',
          display:       'flex',
          flexWrap:      'wrap',
          gap:           '24px',
          alignItems:    'flex-start',
        }}>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Promo Code</p>
            <p style={{ fontSize: '14px', color: '#F1F5F9', fontFamily: 'monospace', fontWeight: 700 }}>FOUNDER2026</p>
          </div>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Cohort Limit</p>
            <p style={{ fontSize: '14px', color: '#F1F5F9', fontWeight: 600 }}>10 founders</p>
          </div>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Code Expires</p>
            <p style={{ fontSize: '14px', color: '#F1F5F9', fontWeight: 600 }}>31 Dec 2026</p>
          </div>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Benefit Threshold</p>
            <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: 1.5 }}>5 Start Sheets <em>or</em> 6 months — whichever comes first</p>
          </div>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Post-Threshold</p>
            <p style={{ fontSize: '14px', color: '#94A3B8' }}>Manual conversion to CDS Solo ($49/mo)</p>
          </div>
        </div>

        {/* Summary row */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap:                 '16px',
          marginBottom:        '32px',
        }}>
          {[
            { label: 'Physicians Approved', value: String(physicians.length) },
            { label: 'Active Subscriptions', value: String(activeCount) },
            { label: 'Total Start Sheets',   value: String(totalSheets) },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background:    '#0D1421',
              border:        '1px solid #1A2744',
              borderRadius:  '14px',
              padding:       '20px 22px',
            }}>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                {label}
              </p>
              <p style={{ fontSize: '28px', fontWeight: 300, color: '#F1F5F9', fontFamily: 'Georgia, serif' }}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Physician roster */}
        {physicians.length === 0 ? (
          <div style={{
            background:    '#0D1421',
            border:        '1px solid #1A2744',
            borderRadius:  '16px',
            padding:       '48px',
            textAlign:     'center',
          }}>
            <p style={{ fontSize: '14px', color: '#475569' }}>
              No approved physicians yet. Approve applications via the{' '}
              <Link href="/admin/physicians" style={{ color: '#2DD4BF', textDecoration: 'none' }}>
                Applications panel
              </Link>.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {physicians.map((physician, idx) => {
              const sheetCount   = sheetCountMap.get(physician.clerkId) ?? 0;
              const approvalDate = approvalDateMap.get(physician.id);
              const sheetLabel   = `${sheetCount} / 5`;
              const sheetColor   = sheetCount >= 5 ? '#F59E0B' : sheetCount >= 3 ? '#2DD4BF' : '#94A3B8';

              return (
                <div key={physician.id} style={{
                  background:    '#0D1421',
                  border:        '1px solid #1A2744',
                  borderRadius:  '16px',
                  padding:       '22px 24px',
                }}>
                  {/* Row top: name + status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{
                        width:          '28px',
                        height:         '28px',
                        borderRadius:   '50%',
                        background:     'rgba(45,212,191,0.1)',
                        border:         '1px solid rgba(45,212,191,0.2)',
                        display:        'inline-flex',
                        alignItems:     'center',
                        justifyContent: 'center',
                        fontSize:       '11px',
                        fontWeight:     700,
                        color:          '#2DD4BF',
                        flexShrink:     0,
                      }}>
                        {idx + 1}
                      </span>
                      <div>
                        <p style={{ fontSize: '15px', fontWeight: 600, color: '#F1F5F9', fontFamily: 'Georgia, serif', marginBottom: '2px' }}>
                          {physician.fullName}
                        </p>
                        <p style={{ fontSize: '12px', color: '#64748B' }}>{physician.email}</p>
                      </div>
                    </div>
                    <StatusPill status={physician.subscriptionStatus} />
                  </div>

                  {/* Data grid */}
                  <div style={{
                    display:             'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap:                 '14px',
                    borderTop:           '1px solid #1A2744',
                    paddingTop:          '16px',
                  }}>

                    {/* Start Sheets */}
                    <div>
                      <p style={{ fontSize: '10px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                        Start Sheets
                      </p>
                      <p style={{ fontSize: '18px', fontWeight: 300, color: sheetColor, fontFamily: 'Georgia, serif' }}>
                        {sheetLabel}
                      </p>
                      {sheetCount >= 5 && (
                        <p style={{ fontSize: '11px', color: '#F59E0B', marginTop: '2px' }}>
                          ⚠ Threshold reached — manual conversion required
                        </p>
                      )}
                    </div>

                    {/* Activation date */}
                    <div>
                      <p style={{ fontSize: '10px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                        Approved
                      </p>
                      <p style={{ fontSize: '13px', color: '#94A3B8' }}>
                        {approvalDate
                          ? approvalDate.toLocaleDateString('en-GB', DATE_FMT)
                          : <em style={{ color: '#334155' }}>via email link</em>}
                      </p>
                    </div>

                    {/* Registered */}
                    <div>
                      <p style={{ fontSize: '10px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                        Registered
                      </p>
                      <p style={{ fontSize: '13px', color: '#94A3B8' }}>
                        {physician.createdAt.toLocaleDateString('en-GB', DATE_FMT)}
                      </p>
                    </div>

                    {/* Stripe Customer ID */}
                    <div>
                      <p style={{ fontSize: '10px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                        Stripe Customer
                      </p>
                      <p style={{ fontSize: '12px', color: '#64748B', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        {physician.stripeCustomerId ?? <em style={{ fontStyle: 'italic', fontFamily: 'sans-serif', color: '#334155' }}>not yet subscribed</em>}
                      </p>
                    </div>

                    {/* Stripe Subscription ID */}
                    <div>
                      <p style={{ fontSize: '10px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                        Stripe Subscription
                      </p>
                      <p style={{ fontSize: '12px', color: '#64748B', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        {physician.stripeSubId ?? <em style={{ fontStyle: 'italic', fontFamily: 'sans-serif', color: '#334155' }}>—</em>}
                      </p>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Manual action notes */}
        <div style={{
          marginTop:     '40px',
          background:    'rgba(245,158,11,0.04)',
          border:        '1px solid rgba(245,158,11,0.15)',
          borderRadius:  '14px',
          padding:       '18px 22px',
        }}>
          <p style={{ fontSize: '12px', fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Manual Conversion Checklist
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              'When a founder reaches 5 Start Sheets OR 6 months from approval date: notify them by email',
              'Cancel the $0 subscription in Stripe Dashboard (or let the coupon expire)',
              'Have the founder re-subscribe at standard CDS Solo pricing ($49/month)',
              'Update the Stripe subscription ID and customer ID here by monitoring this page',
              'Log the manual conversion with a note in the Stripe customer notes field',
            ].map((item, i) => (
              <li key={i} style={{ display: 'flex', gap: '10px', fontSize: '12px', color: '#94A3B8', lineHeight: 1.5 }}>
                <span style={{ color: '#F59E0B', flexShrink: 0, marginTop: '1px' }}>→</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p style={{ marginTop: '48px', fontSize: '11px', color: '#334155', textAlign: 'center', lineHeight: 1.8 }}>
          MyoGuard Protocol · Physician-led Clinical Decision Support<br />
          © 2026 Meridian Wellness Systems LLC · myoguard.health
        </p>

      </div>
    </div>
  );
}
