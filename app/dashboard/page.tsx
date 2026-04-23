import { auth }        from '@clerk/nextjs/server';
import { redirect }    from 'next/navigation';
import { prisma }      from '@/src/lib/prisma';
import SanctuaryScoreOrb from '@/src/components/ui/SanctuaryScoreOrb';

function longDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export default async function PatientDashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // ── Role check + data fetch ───────────────────────────────────────────────
  const user = await prisma.user.findUnique({
    where:  { clerkId: userId },
    select: {
      role:       true,
      fullName:   true,
      physicianId: true,
      assessments: {
        select: {
          score:    true,
          riskBand: true,
          protocolPlan: {
            select: { proteinTargetG: true },
          },
          muscleScore: {
            select: {
              score:          true,
              riskBand:       true,
              proteinTargetG: true,
            },
          },
        },
        orderBy: { assessmentDate: 'desc' },
        take: 1,
      },
    },
  }).catch(() => null);

  if (user?.role === 'PHYSICIAN')         redirect('/doctor/dashboard');
  if (user?.role === 'PHYSICIAN_PENDING') redirect('/doctor/onboarding/pending');
  if (user?.role === 'ADMIN')             redirect('/admin/physicians');

  // ── Physician name lookup ────────────────────────────────────────────────
  let physicianName: string | null = null;
  if (user?.physicianId) {
    const physician = await prisma.user.findUnique({
      where:  { id: user.physicianId },
      select: { fullName: true },
    });
    physicianName = physician?.fullName ?? null;
  }

  // ── Derived display values ───────────────────────────────────────────────
  const ms           = user?.assessments?.[0]?.muscleScore ?? null;
  const latestScore  = ms ? Math.round(ms.score) : 0;
  const latestRisk   = ms?.riskBand ?? 'LOW';
  const proteinTarget = ms?.proteinTargetG ? Math.round(ms.proteinTargetG) : 0;
  const hasAssessment = !!(latestScore && latestScore > 0);
  const firstName    = user?.fullName?.split(' ')[0] ?? 'there';

  const hour      = new Date().getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  return (
    <main style={{ background: "#080C14", minHeight: "100vh",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* NAV BAR */}
      <nav style={{
        background: "#060D1E",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        position: "sticky", top: 0, zIndex: 50,
        padding: "0 20px"
      }}>
        <div style={{ maxWidth: "640px", margin: "0 auto",
          display: "flex", alignItems: "center",
          justifyContent: "space-between", height: "56px" }}>
          <span style={{ fontSize: "18px", fontWeight: "900",
            letterSpacing: "-0.03em", color: "#F8FAFC" }}>
            Myo<span style={{ color: "#2DD4BF" }}>Guard</span>
          </span>
          <div style={{
            width: "34px", height: "34px", borderRadius: "50%",
            background: "#1A2744", border: "1px solid #2DD4BF",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "12px", fontWeight: "700", color: "#2DD4BF"
          }}>
            {user?.fullName?.split(" ").map((n: string) => n[0]).join("").slice(0,2).toUpperCase() ?? "P"}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ maxWidth: "640px", margin: "0 auto",
        padding: "32px 20px 0" }}>

        {/* Greeting */}
        <p style={{
          fontFamily: "Georgia, serif",
          fontSize: "22px", color: "#F1F5F9",
          fontWeight: "400", fontStyle: "italic",
          marginBottom: "4px"
        }}>
          Good {timeOfDay}, {firstName}.
        </p>
        <p style={{ fontSize: "13px", color: "#94A3B8",
          marginBottom: "32px" }}>
          Your muscle-protection status · {longDate(new Date())}
        </p>

        {/* Vitality Orb */}
        <div style={{ display: "flex", flexDirection: "column",
          alignItems: "center", marginBottom: "16px" }}>
          {hasAssessment ? (
            <SanctuaryScoreOrb
              score={latestScore}
              riskBand={latestRisk}
            />
          ) : (
            <div style={{
              width: "180px", height: "180px", borderRadius: "50%",
              background: "#0D1421", border: "2px dashed #1A2744",
              display: "flex", alignItems: "center",
              justifyContent: "center"
            }}>
              <span style={{ fontSize: "13px", color: "#475569",
                textAlign: "center", padding: "20px" }}>
                No score yet
              </span>
            </div>
          )}

          {/* Physician care line */}
          {physicianName && (
            <p style={{ fontSize: "12px", color: "#94A3B8",
              fontStyle: "italic", marginTop: "12px",
              textAlign: "center" }}>
              Under the care of{" "}
              <span style={{ color: "#2DD4BF", fontStyle: "normal",
                fontWeight: "600" }}>
                {physicianName.trim().match(/^Dr\.?\s/i)
                  ? physicianName.replace(/^Dr\.?\s*/i, "Dr. ")
                  : `Dr. ${physicianName}`}
              </span>
              {" "}
              <span style={{ color: "#2DD4BF" }}>✓</span>
            </p>
          )}
        </div>

        {/* Empty state */}
        {!hasAssessment && (
          <div style={{
            background: "rgba(13,20,33,0.8)",
            border: "1px solid #1A2744",
            borderRadius: "16px", padding: "24px",
            textAlign: "center", marginBottom: "24px",
            backdropFilter: "blur(12px)"
          }}>
            <p style={{ fontFamily: "Georgia, serif",
              fontSize: "16px", color: "#F1F5F9",
              marginBottom: "8px" }}>
              Your journey begins with your first reflection.
            </p>
            <p style={{ fontSize: "13px", color: "#94A3B8",
              marginBottom: "16px" }}>
              Complete your first assessment to activate your
              personalised muscle-protection protocol.
            </p>
            <a href="/dashboard/assessment" style={{
              display: "inline-block",
              background: "#2DD4BF", color: "#080C14",
              padding: "10px 24px", borderRadius: "99px",
              fontSize: "13px", fontWeight: "700",
              textDecoration: "none"
            }}>
              Begin Assessment →
            </a>
          </div>
        )}

        {/* THREE ACTION TILES */}
        <div style={{ display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "12px", marginBottom: "24px" }}>
          {[
            { label: "Log Today's Pulse", sub: "Weekly check-in",
              href: "/dashboard/checkin", primary: true },
            { label: "View My Protocol", sub: "Targets & supplements",
              href: "/dashboard/report", primary: false },
            { label: "The Odyssey", sub: "Your progress story",
              href: "/dashboard/journey", primary: false },
          ].map((card) => (
            <a key={card.href} href={card.href} style={{
              display: "block", textDecoration: "none",
              background: card.primary
                ? "rgba(45,212,191,0.08)"
                : "rgba(13,20,33,0.8)",
              border: `1px solid ${card.primary ? "#2DD4BF" : "#1A2744"}`,
              borderRadius: "16px", padding: "16px 12px",
              backdropFilter: "blur(12px)",
            }}>
              <p style={{ fontSize: "13px", fontWeight: "600",
                color: card.primary ? "#2DD4BF" : "#F1F5F9",
                marginBottom: "4px",
                fontFamily: "Georgia, serif" }}>
                {card.label}
              </p>
              <p style={{ fontSize: "11px", color: "#94A3B8" }}>
                {card.sub}
              </p>
            </a>
          ))}
        </div>

        {/* STATS STRIP */}
        {hasAssessment && (
          <div style={{
            background: "#0D1421", border: "1px solid #1A2744",
            borderRadius: "12px", padding: "14px 20px",
            display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: "32px"
          }}>
            <div>
              <p style={{ fontSize: "10px", color: "#94A3B8",
                textTransform: "uppercase", letterSpacing: "0.06em",
                marginBottom: "2px" }}>Protein Target</p>
              <p style={{ fontSize: "14px", fontWeight: "600",
                color: "#F1F5F9", fontFamily: "Georgia, serif" }}>
                {proteinTarget ? `${proteinTarget}g/day` : "—"}
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "10px", color: "#94A3B8",
                textTransform: "uppercase", letterSpacing: "0.06em",
                marginBottom: "2px" }}>Score</p>
              <p style={{ fontSize: "14px", fontWeight: "600",
                color: "#2DD4BF", fontFamily: "Georgia, serif" }}>
                {latestScore}
              </p>
            </div>
            {physicianName && (
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: "10px", color: "#94A3B8",
                  textTransform: "uppercase", letterSpacing: "0.06em",
                  marginBottom: "2px" }}>Care Team</p>
                <p style={{ fontSize: "13px", fontWeight: "600",
                  color: "#2DD4BF" }}>
                  {physicianName.trim().match(/^Dr\.?\s/i)
                    ? physicianName.replace(/^Dr\.?\s*/i, "Dr. ")
                    : `Dr. ${physicianName}`} ✓
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
