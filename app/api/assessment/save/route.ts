export const dynamic = 'force-dynamic';

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      composite, leanScore, recoveryScore,
      risk, weight, protein, drug,
      giSymptoms, sleepHours
    } = body;

    // Suppress unused-var warnings — fields captured for future use
    void leanScore; void recoveryScore; void drug;

    // Try database write
    try {
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();

      // Resolve DB user from Clerk userId — create row if webhook hasn't fired yet
      let dbUser = await prisma.user.findUnique({
        where:  { clerkId: userId },
        select: { id: true },
      });

      if (!dbUser) {
        const { clerkClient } = await import("@clerk/nextjs/server");
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(userId);
        dbUser = await prisma.user.create({
          data: {
            clerkId:            userId,
            email:              clerkUser.emailAddresses[0]?.emailAddress ?? "",
            fullName:           `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim(),
            role:               "PATIENT",
            subscriptionStatus: "FREE",
          },
          select: { id: true },
        });
      }

      if (!dbUser) {
        return NextResponse.json(
          { ok: false, error: "User record not found and could not be created" },
          { status: 500 },
        );
      }

      await prisma.assessment.create({
          data: {
            userId:          dbUser.id,
            score:           composite ?? 0,
            riskBand:        risk ?? 'LOW',
            weightKg:        weight ?? 0,
            proteinGrams:    protein ?? 0,
            exerciseDaysWk:  1,
            hydrationLitres: Math.round((weight ?? 70) * 0.033 * 10) / 10,
            symptoms: Array.isArray(giSymptoms)
              ? giSymptoms
              : giSymptoms && giSymptoms !== 'None'
                ? [giSymptoms]
                : [],
            fatigue:        0,
            nausea:         0,
            muscleWeakness: 0,
            sleepHours:     sleepHours ?? null,
          },
        });

      await prisma.$disconnect();
      return NextResponse.json({ ok: true, saved: true });

    } catch (dbError: unknown) {
      console.error("[assessment/save] DB write failed:", dbError);
      return NextResponse.json(
        { ok: false, error: "Assessment could not be saved", detail: String(dbError) },
        { status: 500 },
      );
    }

  } catch (error: unknown) {
    console.error("Assessment save error:", error);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
