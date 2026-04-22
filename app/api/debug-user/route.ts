import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/src/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Not signed in" });

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: {
      id: true, role: true, email: true,
      physicianId: true, referralSlug: true
    }
  });

  return NextResponse.json({ clerkId: userId, dbUser: user });
}
