import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export async function GET() {
  const approved = await prisma.physicianApplication.findMany({
    where: { status: "APPROVED" },
    select: { clerkUserId: true, email: true, name: true }
  });

  const results = [];

  for (const app of approved) {
    if (app.clerkUserId) {
      await prisma.user.update({
        where: { clerkId: app.clerkUserId },
        data: { isVerified: true }
      }).catch(() => null);
      results.push({ name: app.name, method: "clerkId", done: true });
    } else {
      await prisma.user.updateMany({
        where: { email: app.email },
        data: { isVerified: true }
      }).catch(() => null);
      results.push({ name: app.name, method: "email", done: true });
    }
  }

  return NextResponse.json({ results });
}
