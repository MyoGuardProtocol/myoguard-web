import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.DATABASE_URL ?? "NOT SET";
  const match = url.match(/:([^@]+)@/);
  const password = match ? match[1] : "NOT FOUND";
  const masked = url.replace(/:([^@]+)@/, ":***@");
  return NextResponse.json({
    url: masked,
    passwordLength: password.length,
    firstChar: password[0],
    lastChar: password[password.length - 1],
  });
}
