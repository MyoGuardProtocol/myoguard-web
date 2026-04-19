/**
 * POST /api/doctor/start-sheet/save
 *
 * Saves a generated Start Sheet protocol to the database.
 * Requires an active Clerk session (physician must be signed in).
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorised." }, { status: 401 });
  }

  try {
    const body = await req.json() as {
      patientName:         string;
      patientEmail:        string;
      weightKg:            number;
      age:                 number;
      glp1Agent:           string;
      riskLevel:           string;
      proteinTarget:       number;
      hydrationTarget:     number;
      resistanceFrequency: string;
      supplements:         string[];
      ermEnabled:          boolean;
      physicianNotes?:     string;
    };

    const {
      patientName,
      patientEmail,
      weightKg,
      age,
      glp1Agent,
      riskLevel,
      proteinTarget,
      hydrationTarget,
      resistanceFrequency,
      supplements,
      ermEnabled,
      physicianNotes,
    } = body;

    // Basic validation
    if (!patientName?.trim())
      return NextResponse.json({ ok: false, error: "Patient name is required." }, { status: 422 });
    if (!patientEmail?.trim() || !patientEmail.includes("@"))
      return NextResponse.json({ ok: false, error: "A valid patient email is required." }, { status: 422 });
    if (!weightKg || weightKg < 20 || weightKg > 300)
      return NextResponse.json({ ok: false, error: "Invalid body weight." }, { status: 422 });
    if (!age || age < 18 || age > 120)
      return NextResponse.json({ ok: false, error: "Invalid age." }, { status: 422 });
    if (!glp1Agent)
      return NextResponse.json({ ok: false, error: "GLP-1 agent is required." }, { status: 422 });
    if (!riskLevel)
      return NextResponse.json({ ok: false, error: "Risk level is required." }, { status: 422 });

    const record = await prisma.startSheetProtocol.create({
      data: {
        physicianClerkId:    userId,
        patientName:         patientName.trim(),
        patientEmail:        patientEmail.trim().toLowerCase(),
        weightKg,
        age,
        glp1Agent,
        riskLevel,
        proteinTarget,
        hydrationTarget,
        resistanceFrequency,
        supplements,
        ermEnabled:          ermEnabled ?? false,
        physicianNotes:      physicianNotes ?? "",
      },
    });

    return NextResponse.json({ ok: true, id: record.id });

  } catch (error: unknown) {
    console.error("[start-sheet/save] error:", error);
    return NextResponse.json(
      { ok: false, error: "Server error. Please try again." },
      { status: 500 }
    );
  }
}
