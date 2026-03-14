'use client'
import { useUser } from "@clerk/nextjs"
import { useEffect, useState } from "react"
import Link from "next/link"

export default function DashboardPage() {
  const { user } = useUser()
  const [latest, setLatest] = useState<any>(null)

  useEffect(() => {
    fetch("/api/assessment?latest=true")
      .then(r => r.json())
      .then(d => setLatest(d.assessment))
      .catch(() => {})
  }, [])

  const score = latest?.muscleScore
  const band = score?.riskBand || null
  const COLORS: any = { LOW:"#16a34a", MODERATE:"#d97706", HIGH:"#ea580c", CRITICAL:"#dc2626" }
  const LABELS: any = { LOW:"Low Risk", MODERATE:"Moderate Risk", HIGH:"High Risk", CRITICAL:"Critical Risk" }

  return (
    <div style={{ minHeight:"100vh", backgroundColor:"#f9fafb", padding:"40px 20px" }}>
      <div style={{ maxWidth:"640px", margin:"0 auto", display:"flex", flexDirection:"column", gap:"20px" }}>
        <div style={{ backgroundColor:"white", borderRadius:"16px", padding:"32px", boxShadow:"0 1px 3px rgba(0,0,0,0.1)" }}>
          <h1 style={{ color:"#0d9488", fontSize:"22px", fontWeight:"bold", marginBottom:"4px" }}>Welcome back{user?.firstName ? ", " + user.firstName : ""}</h1>
          <p style={{ color:"#6b7280", fontSize:"14px" }}>Your muscle protection dashboard</p>
        </div>
        {score ? (
          <div style={{ backgroundColor:"white", borderRadius:"16px", padding:"32px", boxShadow:"0 1px 3px rgba(0,0,0,0.1)" }}>
            <h2 style={{ color:"#111827", fontSize:"16px", fontWeight:"600", marginBottom:"16px" }}>Your Latest Score</h2>
            <div style={{ display:"flex", alignItems:"center", gap:"24px" }}>
              <div style={{ width:"80px", height:"80px", borderRadius:"50%", border:"6px solid", borderColor:COLORS[band], display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <span style={{ fontSize:"24px", fontWeight:"bold", color:COLORS[band] }}>{Math.round(score.score)}</span>
              </div>
              <div>
                <div style={{ fontSize:"14px", fontWeight:"600", color:COLORS[band], marginBottom:"4px" }}>{LABELS[band]}</div>
                <div style={{ fontSize:"13px", color:"#6b7280" }}>Protein target: {score.proteinTargetG}g/day</div>
                <div style={{ fontSize:"12px", color:"#9ca3af", marginTop:"4px" }}>Last assessment: {new Date(latest.assessmentDate).toLocaleDateString()}</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ backgroundColor:"#f0fdfa", borderRadius:"16px", padding:"32px", border:"1px solid #99f6e4" }}>
            <h2 style={{ color:"#0f766e", fontSize:"16px", fontWeight:"600", marginBottom:"8px" }}>No assessment yet</h2>
            <p style={{ color:"#374151", fontSize:"14px", marginBottom:"16px" }}>Take your first assessment to get your MyoGuard Score.</p>
          </div>
        )}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
          <Link href="/dashboard/assessment" style={{ backgroundColor:"#0d9488", color:"white", borderRadius:"12px", padding:"20px", textDecoration:"none", display:"block" }}>
            <div style={{ fontSize:"16px", fontWeight:"600", marginBottom:"4px" }}>New Assessment</div>
            <div style={{ fontSize:"13px", opacity:0.8 }}>Update your weekly score</div>
          </Link>
          <Link href="/sign-out" style={{ backgroundColor:"white", color:"#374151", borderRadius:"12px", padding:"20px", textDecoration:"none", display:"block", border:"1px solid #e5e7eb" }}>
            <div style={{ fontSize:"16px", fontWeight:"600", marginBottom:"4px" }}>Sign Out</div>
            <div style={{ fontSize:"13px", color:"#9ca3af" }}>See you next week</div>
          </Link>
        </div>
        <p style={{ color:"#9ca3af", fontSize:"12px", textAlign:"center" }}>MyoGuard Protocol — Clinical decision support for GLP-1 patients</p>
      </div>
    </div>
  )
}
