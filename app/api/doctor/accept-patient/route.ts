export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/src/lib/prisma";

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const physician = await prisma.user.findUnique({
      where:  { clerkId },
      select: { id: true, role: true },
    });

    if (!physician || physician.role !== "PHYSICIAN") {
      return NextResponse.json(
        { ok: false, error: "Verified physician access required" },
        { status: 403 },
      );
    }

    const body = await req.json() as { shareToken?: string };
    const { shareToken } = body;

    if (!shareToken) {
      return NextResponse.json({ ok: false, error: "shareToken required" }, { status: 422 });
    }

    const shareCard = await prisma.shareCard.findUnique({
      where:  { shareToken },
      select: { userId: true },
    });

    if (!shareCard) {
      return NextResponse.json({ ok: false, error: "Invalid invitation token" }, { status: 404 });
    }

    const patient = await prisma.user.findUnique({
      where:  { id: shareCard.userId },
      select: { id: true, physicianId: true, role: true },
    });

    if (!patient || patient.role !== "PATIENT") {
      return NextResponse.json({ ok: false, error: "Patient not found" }, { status: 404 });
    }

    // Idempotent — already linked
    if (patient.physicianId === physician.id) {
      return NextResponse.json({ ok: true, alreadyLinked: true });
    }

    await prisma.user.update({
      where: { id: patient.id },
      data:  { physicianId: physician.id },
    });

    // Upsert invitation record — create if absent, mark accepted if found
    const existing = await prisma.physicianPatientInvitation.findFirst({
      where: { shareToken, claimedByUserId: physician.id },
      select: { id: true },
    });

    if (existing) {
      await prisma.physicianPatientInvitation.update({
        where: { id: existing.id },
        data:  { status: "ACCEPTED" },
      });
    } else {
      await prisma.physicianPatientInvitation.create({
        data: {
          shareToken,
          patientUserId:   patient.id,
          status:          "ACCEPTED",
          claimedByUserId: physician.id,
          expiresAt:       new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }

    return NextResponse.json({ ok: true });

  } catch (err: unknown) {
    console.error("[accept-patient] error:", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
