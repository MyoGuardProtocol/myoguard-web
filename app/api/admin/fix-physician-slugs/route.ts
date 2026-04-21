import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export async function GET() {
  const approved = await prisma.physicianApplication.findMany({
    where:  { status: "APPROVED" },
    select: { id: true, name: true, email: true, clerkUserId: true, specialty: true },
  });

  const results = [];

  for (const app of approved) {
    const existing = await prisma.physicianProfile.findFirst({
      where: { displayName: app.name },
    });
    if (existing) {
      results.push({ name: app.name, status: "already exists" });
      continue;
    }

    const nameParts    = app.name.replace(/^Dr\.?\s*/i, "").trim().split(/\s+/);
    const lastName     = nameParts[nameParts.length - 1] ?? "physician";
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const referralSlug = `dr-${lastName.toLowerCase()}-${randomSuffix}`;
    const referralCode = `DR-${lastName.toUpperCase()}-${randomSuffix}`;

    await prisma.physicianProfile.create({
      data: {
        slug:        referralSlug,
        displayName: app.name,
        specialty:   app.specialty ?? undefined,
        referralCode,
        isActive:    true,
      },
    }).catch(() => null);

    if (app.clerkUserId) {
      await prisma.user.update({
        where: { clerkId: app.clerkUserId },
        data:  { referralSlug },
      }).catch(() => null);
    }

    results.push({ name: app.name, slug: referralSlug, code: referralCode, status: "created" });
  }

  return NextResponse.json({ results });
}
