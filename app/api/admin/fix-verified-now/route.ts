import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export async function GET() {
  const result = await prisma.user.updateMany({
    where: { role: "PHYSICIAN" },
    data: { isVerified: true }
  });
  return NextResponse.json({ updated: result.count });
}
