import { NextRequest, NextResponse } from "next/server"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, firstName } = body
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Dr. B, MBBS <docb@myoguard.health>",
        to: email,
        subject: "Welcome to MyoGuard Protocol",
        html: "<h2>Welcome to MyoGuard Protocol, " + firstName + "</h2><p>Your muscle protection journey starts now. Complete your weekly assessment every 7 days to track your progress.</p><p>To your health,<br>Dr. B, MBBS<br>MyoGuard Protocol</p>",
      }),
    })
    if (!res.ok) throw new Error("Email failed")
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: "Email failed" }, { status: 500 })
  }
}
