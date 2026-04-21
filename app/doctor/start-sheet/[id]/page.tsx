import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/src/lib/prisma";
import PrintButton from "./PrintButton";
import { QRCodeSVG } from "qrcode.react";

export default async function ProtocolViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/doctor/sign-in");

  const { id } = await params;

  const protocol = await prisma.startSheetProtocol
    .findUnique({ where: { id } })
    .catch(() => null);

  if (!protocol) notFound();

  // Physician credentials lookup via clerkUserId on PhysicianApplication
  const physician = await prisma.physicianApplication
    .findFirst({
      where:  { clerkUserId: protocol.physicianClerkId },
      select: { name: true, specialty: true, license: true, country: true },
    })
    .catch(() => null);

  const physicianName      = physician?.name      ?? "MyoGuard Physician";
  const physicianSpecialty = physician?.specialty ?? "General Practice";
  const physicianLicense   = physician?.license   ?? null;
  const physicianCountry   = physician?.country   ?? null;

  // Physician notes: not yet in schema — safe cast for forward compatibility
  const physicianNotes = (protocol as unknown as { physicianNotes?: string }).physicianNotes;

  const displayName = physicianName.startsWith("Dr.") ? physicianName : `Dr. ${physicianName}`;

  const generatedDate = protocol.createdAt.toLocaleDateString("en-US", {
    day:   "numeric",
    month: "long",
    year:  "numeric",
  });

  const riskDot: Record<string, string> = {
    Low:      "#10b981",
    Moderate: "#f59e0b",
    High:     "#ef4444",
  };

  return (
    <>
      {/* ── Scoped styles: print transform + screen-only visibility ── */}
      <style>{`
        /* Screen: hide print-only blocks */
        .print-only { display: none; }

        @media print {
          * { -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important; }
          body { background: #ffffff !important;
                 color: #000000 !important; }
          .no-print { display: none !important; }
          .screen-card { display: none !important; }
          .print-only {
            display: block !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          .print-panel {
            width: 100% !important;
            background: #ffffff !important;
          }
          @page { size: A4; margin: 2cm; }

          .print-flex         { display: flex !important; }
          .p-serif            { font-family: Georgia, serif; }
          .p-black            { color: #000000 !important; }
          .p-muted            { color: #475569 !important; }
          .p-large {
            font-family: Georgia, serif;
            font-size: 2.25rem;
            font-weight: 700;
            line-height: 1;
            color: #000000 !important;
          }
          .p-section-heading {
            font-family: Georgia, serif;
            font-size: 1rem;
            font-weight: 700;
            color: #000000;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 0.5rem;
            margin-bottom: 0.75rem;
          }
          .supplement-pill {
            background: transparent !important;
            border: none !important;
            color: #000000 !important;
            padding: 0 !important;
            border-radius: 0 !important;
          }
        }
      `}</style>

      <div className="min-h-screen bg-slate-950 font-sans">
        <div className="max-w-3xl mx-auto px-4 py-8">

          {/* ── Screen nav ── */}
          <div className="no-print flex items-center justify-between mb-8">
            <Link
              href="/doctor/start-sheet"
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              ← Back to Start Sheet
            </Link>
            <div className="flex items-center gap-3">
              <PrintButton />
              <Link
                href="/doctor/start-sheet"
                className="text-xs text-slate-400 hover:text-emerald-400 transition-colors border border-slate-700 rounded-lg px-3 py-1.5"
              >
                Generate Another
              </Link>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              SCREEN VIEW  (all .screen-card divs, hidden on print)
          ══════════════════════════════════════════════════ */}

          {/* Header card */}
          <div className="screen-card bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">
                  MyoGuard Protocol
                </p>
                <h1
                  className="text-2xl font-bold text-white"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  {protocol.patientName}
                </h1>
                <p className="text-sm text-slate-400 mt-1">Generated {generatedDate}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs font-semibold px-3 py-1.5 rounded-full">
                  {protocol.riskLevel} Risk
                </span>
                {protocol.ermEnabled && (
                  <span className="inline-flex items-center bg-amber-950 border border-amber-800 text-amber-300 text-xs font-semibold px-3 py-1.5 rounded-full">
                    ERM Armed
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Patient + GLP-1 row */}
          <div className="screen-card grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Patient
              </h2>
              <dl className="space-y-2 text-sm">
                <div className="flex gap-3">
                  <dt className="text-slate-500 w-20 flex-shrink-0">Name</dt>
                  <dd className="text-white font-medium">{protocol.patientName}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="text-slate-500 w-20 flex-shrink-0">Email</dt>
                  <dd className="text-slate-300 break-all">{protocol.patientEmail}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="text-slate-500 w-20 flex-shrink-0">Age</dt>
                  <dd className="text-slate-300">{protocol.age} years</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="text-slate-500 w-20 flex-shrink-0">Weight</dt>
                  <dd className="text-slate-300">{protocol.weightKg} kg</dd>
                </div>
              </dl>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                GLP-1 Therapy
              </h2>
              <p className="text-sm text-white font-medium mb-3">{protocol.glp1Agent}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Physician:</span>
                <span className="text-xs text-slate-300 font-medium">{displayName}</span>
              </div>
              {physicianSpecialty && (
                <p className="text-xs text-slate-500 mt-1">{physicianSpecialty}</p>
              )}
            </div>
          </div>

          {/* Protocol targets */}
          <div className="screen-card bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-5">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-5">
              Protocol Targets
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">Daily Protein</p>
                <p
                  className="text-3xl font-bold text-emerald-400"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  {protocol.proteinTarget}g
                </p>
                <p className="text-xs text-slate-500 mt-1">/day</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">Daily Hydration</p>
                <p
                  className="text-3xl font-bold text-emerald-400"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  {(protocol.hydrationTarget / 1000).toFixed(1)}L
                </p>
                <p className="text-xs text-slate-500 mt-1">/day</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">Resistance Training</p>
                <p className="text-base font-bold text-white mt-2">
                  {protocol.resistanceFrequency}
                </p>
              </div>
            </div>
          </div>

          {/* Supplement stack */}
          <div className="screen-card bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-5">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Supplement Stack
            </h2>
            <div className="flex flex-wrap gap-2">
              {protocol.supplements.map((s) => (
                <span
                  key={s}
                  className="supplement-pill inline-flex items-center bg-emerald-950 border border-emerald-800 text-emerald-300 text-sm font-medium px-3 py-1.5 rounded-full"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Screen disclaimer */}
          <div className="no-print mt-8 pt-6 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-500 leading-relaxed">
              Protocol generated based on MyoGuard White Paper v4.2.
              Intended for clinical guidance alongside GLP-1 therapy.<br />
              Adjust based on patient biochemical response and clinical judgement.
              This output does not constitute individualised medical advice.
            </p>
          </div>

          {/* ══════════════════════════════════════════════════
              PRINT VIEW  — "The Prescription"
              Hidden on screen, transforms to A4 handout on print.
          ══════════════════════════════════════════════════ */}
          <div className="print-only">

            {/* ── Letterhead ── */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              paddingBottom: "16px",
              marginBottom: "20px",
              borderBottom: "2px solid #000000"
            }}>
              {/* LEFT — MyoGuard brand */}
              <div>
                <div style={{ fontSize: "22px", fontWeight: "900",
                  fontFamily: "Georgia, serif", letterSpacing: "-0.03em" }}>
                  <span style={{ color: "#000000" }}>Myo</span>
                  <span style={{ color: "#0d9488" }}>Guard</span>
                </div>
                <div style={{ fontSize: "10px", color: "#64748b",
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  marginTop: "2px" }}>
                  Protocol Platform
                </div>
                <div style={{ fontSize: "11px", color: "#64748b",
                  marginTop: "2px" }}>
                  myoguard.health
                </div>
              </div>

              {/* RIGHT — Physician credentials */}
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "15px", fontWeight: "700",
                  fontFamily: "Georgia, serif", color: "#000000" }}>
                  {displayName}
                </div>
                {physicianSpecialty && (
                  <div style={{ fontSize: "12px", color: "#475569",
                    marginTop: "2px" }}>
                    {physicianSpecialty}
                  </div>
                )}
                {physician && (
                  <div style={{ fontSize: "11px", color: "#065f46",
                    fontWeight: "500", marginTop: "2px" }}>
                    Certified MyoGuard Specialist
                  </div>
                )}
                {physician?.license && (
                  <div style={{ fontSize: "11px", color: "#64748b",
                    marginTop: "2px" }}>
                    Lic. {physician.license}
                  </div>
                )}
              </div>
            </div>

            {/* ── Patient info bar ── */}
            <div
              className="print-flex"
              style={{
                gap: "2rem",
                padding: "0.75rem 0",
                borderBottom: "1px solid #e2e8f0",
                marginBottom: "1.5rem",
                fontSize: "0.8rem",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div>
                <span style={{ color: "#64748b" }}>Patient: </span>
                <strong style={{ color: "#000000" }}>{protocol.patientName}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b" }}>Date: </span>
                <strong style={{ color: "#000000" }}>{generatedDate}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b" }}>GLP-1 Agent: </span>
                <strong style={{ color: "#000000" }}>{protocol.glp1Agent}</strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span style={{ color: "#64748b" }}>Risk Classification: </span>
                <span
                  style={{
                    display: "inline-block",
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: riskDot[protocol.riskLevel] ?? "#64748b",
                    flexShrink: 0,
                  }}
                />
                <strong style={{ color: "#000000" }}>{protocol.riskLevel}</strong>
              </div>
            </div>

            {/* ── Section 1: Protein Directive ── */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div className="p-section-heading">Daily Protein Target</div>
              <div className="p-large">
                {protocol.proteinTarget}g{" "}
                <span
                  className="p-muted"
                  style={{ fontSize: "1rem", fontWeight: "400" }}
                >
                  / day
                </span>
              </div>
              <p className="p-muted" style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
                Based on {protocol.riskLevel} sarcopenia risk · {protocol.weightKg}kg body weight
              </p>
              <p className="p-muted" style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
                Distribute across 3–4 meals for optimal muscle protein synthesis
              </p>
            </div>

            {/* ── Section 2: Training Prescription ── */}
            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1.5rem", marginBottom: "1.5rem" }}>
              <div className="p-section-heading">Resistance Training Directive</div>
              <div className="p-large">{protocol.resistanceFrequency}</div>
              <p className="p-muted" style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
                Progressive resistance training — compound movements prioritised
              </p>
              <p className="p-muted" style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
                Protein intake within 30 minutes post-session recommended
              </p>
            </div>

            {/* ── Section 3: Hydration & Supplementation ── */}
            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1.5rem", marginBottom: "1.5rem" }}>
              <div className="p-section-heading">Hydration Target</div>
              <div className="p-large">
                {protocol.hydrationTarget}ml{" "}
                <span
                  className="p-muted"
                  style={{ fontSize: "1rem", fontWeight: "400" }}
                >
                  / day
                </span>
              </div>
              <p className="p-muted" style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
                Increase by 200ml on training days
              </p>

              <div style={{ marginTop: "1.25rem" }}>
                <div className="p-section-heading">Supplement Stack</div>
                <ul style={{ listStyle: "disc", paddingLeft: "1.5rem", fontSize: "0.875rem", lineHeight: "2" }}>
                  {protocol.supplements.map((s) => (
                    <li key={s} className="p-black">{s}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* ── Clinical Notes (if present) ── */}
            {physicianNotes && (
              <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1.5rem", marginBottom: "1.5rem" }}>
                <div className="p-section-heading">Clinical Notes</div>
                <p
                  className="p-black"
                  style={{ fontSize: "0.875rem", fontStyle: "italic", lineHeight: "1.7" }}
                >
                  {physicianNotes}
                </p>
              </div>
            )}

            {/* ── ERM status ── */}
            {protocol.ermEnabled && (
              <div
                style={{
                  border: "1px solid #d97706",
                  padding: "0.5rem 1rem",
                  marginBottom: "1.5rem",
                }}
              >
                <p style={{ fontSize: "0.8rem", color: "#92400e" }}>
                  ERM Active — Patient flagged for remote monitoring
                </p>
              </div>
            )}

            {/* ── Physician signature line ── */}
            <div style={{
              marginTop: "32px",
              paddingTop: "16px",
              borderTop: "1px solid #e2e8f0"
            }}>
              <div style={{ display: "flex",
                justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <div style={{ width: "200px", borderBottom: "1px solid #000",
                    marginBottom: "6px" }} />
                  <div style={{ fontSize: "12px", fontWeight: "600",
                    color: "#000000", fontFamily: "Georgia, serif" }}>
                    {displayName}
                  </div>
                  <div style={{ fontSize: "11px", color: "#475569" }}>
                    {physicianSpecialty}
                    {physician?.license ? ` · Lic. ${physician.license}` : ""}
                  </div>
                  <div style={{ fontSize: "11px", color: "#475569",
                    marginTop: "2px" }}>
                    Authorized by attending physician
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>
                    {generatedDate}
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b",
                    marginTop: "2px" }}>
                    MyoGuard Protocol Platform
                  </div>
                </div>
              </div>
            </div>

            {/* ── Footer row: disclaimer + QR ── */}
            <div
              className="print-flex"
              style={{
                borderTop: "1px solid #e2e8f0",
                paddingTop: "1.5rem",
                marginTop: "1.5rem",
                justifyContent: "space-between",
                alignItems: "flex-end",
                gap: "1.5rem",
              }}
            >
              <div style={{ fontSize: "0.7rem", color: "#64748b", lineHeight: "1.7", maxWidth: "70%" }}>
                <p>This metabolic protocol is a clinical recommendation generated by the attending physician using the MyoGuard Protocol Platform. MyoGuard provides the underlying clinical data architecture and does not provide individualised medical advice. Adjust all recommendations based on patient biochemical response and clinical judgement.</p>
                <p style={{ marginTop: "0.4rem" }}>MyoGuard White Paper v4.2 · myoguard.health</p>
              </div>
              <div style={{ flexShrink: 0 }}>
                <QRCodeSVG value="https://myoguard.health" size={80} />
              </div>
            </div>


          </div>
          {/* end print-only */}

        </div>
      </div>
    </>
  );
}
