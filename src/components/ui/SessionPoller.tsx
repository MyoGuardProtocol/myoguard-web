"use client"
import { useEffect } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"

export default function SessionPoller() {
  const { isSignedIn } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isSignedIn) {
      router.push("/doctor/dashboard")
      return
    }
    const interval = setInterval(() => {
      router.refresh()
    }, 2000)
    return () => clearInterval(interval)
  }, [isSignedIn, router])

  return null
}
