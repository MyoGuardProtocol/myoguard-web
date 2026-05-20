export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/src/lib/prisma";

export async function GET(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const physician = await prisma.user.findUnique({
    where:  { clerkId },
    select: { id: true, role: true },
  });

  if (!physician || (physician.role !== "PHYSICIAN" && physician.role !== "PHYSICIAN_PENDING")) {
    return NextResponse.json({ ok: false, error: "Physician access required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const invite = searchParams.get("invite");
  if (!invite) return NextResponse.json({ ok: false, error: "invite required" }, { status: 422 });

  const shareCard = await prisma.shareCard.findUnique({
    where:  { shareToken: invite },
    select: { userId: true },
  });

  if (!shareCard) return NextResponse.json({ ok: false, error: "Invalid invitation" }, { status: 404 });

  const patient = await prisma.user.findUnique({
    where:  { id: shareCard.userId },
    select: {
      id:          true,
      fullName:    true,
      physicianId: true,
      assessments: {
        orderBy: { assessmentDate: "desc" },
        take:    1,
        select: {
          assessmentDate: true,
          muscleScore:    { select: { score: true, riskBand: true } },
        },
      },
    },
  });

  if (!patient) return NextResponse.json({ ok: false, error: "Patient not found" }, { status: 404 });

  const latest = patient.assessments[0];

  return NextResponse.json({
    ok: true,
    patient: {
      id:             patient.id,
      fullName:       patient.fullName,
      band:           latest?.muscleScore?.riskBand ?? null,
      score:          latest?.muscleScore?.score ?? null,
      assessmentDate: latest?.assessmentDate?.toISOString() ?? null,
      alreadyLinked:  patient.physicianId === physician.id,
    },
  });
}
