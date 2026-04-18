import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/src/lib/prisma";
import PrintButton from "./PrintButton";

export default async function ProtocolGeneratedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/doctor/sign-in");

  const { id } = await params;

  const protocol = await prisma.startSheetProtocol.findUnique({
    where: { id },
  }).catch(() => null);

  if (!protocol) notFound();

  const generatedDate = protocol.createdAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      {/* Print-only styles — collapse nav/actions, show full content */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; color: #000 !important; }
          .print-card {
            background: #fff !important;
            border: 1px solid #e2e8f0 !important;
            color: #000 !important;
          }
          .print-heading { color: #000 !important; }
          .print-muted { color: #475569 !important; }
          .print-badge {
            background: #f0fdf4 !important;
            border-color: #86efac !important;
            color: #166534 !important;
          }
          .print-amber-badge {
            background: #fffbeb !important;
            border-color: #fcd34d !important;
            color: #92400e !important;
          }
        }
      `}</style>

      <div style={{ background: "#0A0A0A", minHeight: "100vh" }}>
        <div className="max-w-3xl mx-auto px-4 py-8">

          {/* Nav */}
          <div className="flex items-center justify-between mb-8 no-print">
            <Link
              href="/doctor/start-sheet"
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              ← Generate Another
            </Link>
            <PrintButton />
          </div>

          {/* Header card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-5 print-card">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1
                  className="text-xl font-bold text-white print-heading"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  MyoGuard Protocol
                </h1>
                <p className="text-sm text-slate-400 mt-1 print-muted">
                  Generated {generatedDate}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs font-semibold px-3 py-1.5 rounded-full print-badge">
                  {protocol.riskLevel} Risk
                </span>
                {protocol.ermEnabled && (
                  <span className="inline-flex items-center bg-amber-950 border border-amber-800 text-amber-300 text-xs font-semibold px-3 py-1.5 rounded-full print-amber-badge">
                    ERM Flagged
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Patient + clinical data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 print-card">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Patient
              </h2>
              <dl className="space-y-2 text-sm">
                <div className="flex gap-3">
                  <dt className="text-slate-500 w-20 flex-shrink-0 print-muted">Name</dt>
                  <dd className="text-white font-medium print-heading">{protocol.patientName}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="text-slate-500 w-20 flex-shrink-0 print-muted">Email</dt>
                  <dd className="text-slate-300 break-all print-muted">{protocol.patientEmail}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="text-slate-500 w-20 flex-shrink-0 print-muted">Age</dt>
                  <dd className="text-slate-300 print-muted">{protocol.age} years</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="text-slate-500 w-20 flex-shrink-0 print-muted">Weight</dt>
                  <dd className="text-slate-300 print-muted">{protocol.weightKg} kg</dd>
                </div>
              </dl>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 print-card">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                GLP-1 Therapy
              </h2>
              <p className="text-sm text-white font-medium print-heading">{protocol.glp1Agent}</p>
              {protocol.ermEnabled && (
                <div className="mt-3 bg-amber-950 border border-amber-800 rounded-lg px-3 py-2 print-amber-badge">
                  <p className="text-xs text-amber-300 font-medium">
                    ERM — Flagged for billing activation (July 2026)
                  </p>
                </div>
              )}
            </div>

          </div>

          {/* Protocol targets */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-5 print-card">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-5">
              Protocol Targets
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1 print-muted">Daily Protein</p>
                <p
                  className="text-3xl font-bold text-emerald-400"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  {protocol.proteinTarget}g
                </p>
                <p className="text-xs text-slate-500 mt-1 print-muted">/day</p>
              </div>

              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1 print-muted">Daily Hydration</p>
                <p
                  className="text-3xl font-bold text-emerald-400"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  {(protocol.hydrationTarget / 1000).toFixed(1)}L
                </p>
                <p className="text-xs text-slate-500 mt-1 print-muted">/day</p>
              </div>

              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1 print-muted">Resistance Training</p>
                <p className="text-base font-bold text-white mt-2 print-heading">
                  {protocol.resistanceFrequency}
                </p>
              </div>

            </div>
          </div>

          {/* Supplement stack */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-5 print-card">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Supplement Stack
            </h2>
            <div className="flex flex-wrap gap-2">
              {protocol.supplements.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center bg-emerald-950 border border-emerald-800 text-emerald-300 text-sm font-medium px-3 py-1.5 rounded-full print-badge"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Print CTA — visible on print */}
          <div className="hidden print:block mb-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 print-card text-center">
              <p className="text-xs text-slate-400 print-muted">
                MyoGuard Clinical Platform · myoguard.health
              </p>
            </div>
          </div>

          {/* Generate another — no-print */}
          <div className="text-center mt-2 no-print">
            <Link
              href="/doctor/start-sheet"
              className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              ← Generate another protocol
            </Link>
          </div>

          {/* Disclaimer */}
          <div className="mt-8 pt-6 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-500 leading-relaxed">
              Protocol generated based on MyoGuard White Paper v4.2.
              Intended for clinical guidance alongside GLP-1 therapy.<br />
              Adjust based on patient biochemical response and clinical judgement.
              This output does not constitute individualised medical advice.
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
