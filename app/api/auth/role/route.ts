export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/src/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ role: null });

  const user = await prisma.user.findUnique({
    where:  { clerkId: userId },
    select: { role: true },
  }).catch(() => null);

  return NextResponse.json({ role: user?.role ?? null });
}
