import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export async function GET() {
  const approved = await prisma.physicianApplication.findMany({
    where: { status: "APPROVED" },
    select: { id: true, email: true, clerkUserId: true, name: true }
  });

  const results = [];

  for (const app of approved) {
    if (app.clerkUserId) {
      const updated = await prisma.user.update({
        where: { clerkId: app.clerkUserId },
        data:  { role: "PHYSICIAN" }
      }).catch(() => null);
      results.push({ name: app.name, method: "clerkId", success: !!updated });
    } else {
      const updated = await prisma.user.updateMany({
        where: { email: app.email },
        data:  { role: "PHYSICIAN" }
      }).catch(() => null);
      results.push({ name: app.name, method: "email", success: !!updated });
    }
  }

  return NextResponse.json({ fixed: results });
}
