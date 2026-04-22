import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/src/lib/prisma";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Not signed in" });

  // Check if user already exists
  const existing = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true }
  });
  if (existing) return NextResponse.json({
    status: "already exists", id: existing.id
  });

  // Get Clerk user details
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);

  // Check for referral cookie
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(/mgReferredBy=([^;]+)/);
  const referredBy = match?.[1] ?? null;

  // Find physician if referral exists
  let physicianId: string | null = null;
  if (referredBy) {
    const physician = await prisma.user.findFirst({
      where: { id: referredBy, role: "PHYSICIAN" },
      select: { id: true }
    });
    physicianId = physician?.id ?? null;
  }

  // Create user row
  const newUser = await prisma.user.create({
    data: {
      clerkId:            userId,
      email:              clerkUser.emailAddresses[0]?.emailAddress ?? "",
      fullName:           `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim(),
      role:               "PATIENT",
      subscriptionStatus: "FREE",
      physicianId:        physicianId,
    },
    select: { id: true, email: true, physicianId: true }
  });

  return NextResponse.json({
    status: "created",
    user: newUser,
    referredBy,
    physicianLinked: !!physicianId
  });
}
