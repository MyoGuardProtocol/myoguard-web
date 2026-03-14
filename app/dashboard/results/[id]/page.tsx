'use client'
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"

type RiskBand = "LOW" | "MODERATE" | "HIGH" | "CRITICAL"

const BAND_COLORS: Record<RiskBand, string> = {
  LOW: "#16a34a", MODERATE: "#d97706", HIGH: "#ea580c", CRITICAL: "#dc2626"
}

const BAND_BG: Record<RiskBand, string> = {
  LOW: "#f0fdf4", MODERATE: "#fffbeb", HIGH: "#fff7ed", CRITICAL: "#fef2f2"
}

const BAND_LABELS: Record<RiskBand, string> = {
  LOW: "Low Risk", MODERATE: "Moderate Risk", HIGH: "High Risk", CRITICAL: "Critical Risk"
}

export default function ResultsPage() {
  const params = useParams()
  const id = params.id as string
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!id) return
    fetch("/api/assessment?latest=true")
      .then(r => r.json())
      .then(d => { setData(d.assessment); setLoading(false) })
      .catch(() => { setError("Could not load results."); setLoading(false) })
  }, [id])

  if (loading) return <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}><p style={{ color:"#6b7280" }}>Calculating your score...</p></div>
  if (error || !data) return <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}><p style={{ color:"#dc2626" }}>{error || "No results found."}</p></div>

  const score = data.muscleScore
  const band: RiskBand = score?.riskBand || "HIGH"
  const numScore = score?.score || 0

  return (
    <div style={{ minHeight:"100vh", backgroundColor:"#f9fafb", padding:"40px 20px" }}>
      <div style={{ maxWidth:"600px", margin:"0 auto", display:"flex", flexDirection:"column", gap:"20px" }}>
        <div style={{ backgroundColor:"white", borderRadius:"16px", padding:"32px", boxShadow:"0 1px 3px rgba(0,0,0,0.1)", textAlign:"center" }}>
          <h1 style={{ color:"#0d9488", fontSize:"20px", fontWeight:"bold", marginBottom:"24px" }}>Your MyoGuard Score</h1>
          <div style={{ width:"160px", height:"160px", borderRadius:"50%", border:"12px solid", borderColor:BAND_COLORS[band], display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", backgroundColor:BAND_BG[band] }}>
            <div>
              <div style={{ fontSize:"48px", fontWeight:"bold", color:BAND_COLORS[band] }}>{Math.round(numScore)}</div>
              <div style={{ fontSize:"12px", color:"#6b7280" }}>out of 100</div>
            </div>
          </div>
          <div style={{ display:"inline-block", padding:"6px 16px", borderRadius:"999px", backgroundColor:BAND_BG[band], color:BAND_COLORS[band], fontWeight:"600", fontSize:"14px", marginBottom:"16px" }}>{BAND_LABELS[band]}</div>
          <p style={{ color:"#374151", fontSize:"14px", lineHeight:"1.6" }}>{score?.explanation}</p>
        </div>
        <div style={{ backgroundColor:"white", borderRadius:"16px", padding:"32px", boxShadow:"0 1px 3px rgba(0,0,0,0.1)" }}>
          <h2 style={{ color:"#111827", fontSize:"16px", fontWeight:"600", marginBottom:"16px" }}>Your Protein Target</h2>
          <div style={{ display:"flex", alignItems:"center", gap:"16px", backgroundColor:"#f0fdfa", borderRadius:"12px", padding:"16px" }}>
            <div style={{ fontSize:"40px", fontWeight:"bold", color:"#0d9488" }}>{score?.proteinTargetG}g</div>
            <div style={{ color:"#374151", fontSize:"14px" }}>daily protein target based on your weight, age, and GLP-1 stage</div>
          </div>
        </div>
        <div style={{ backgroundColor:"white", borderRadius:"16px", padding:"32px", boxShadow:"0 1px 3px rgba(0,0,0,0.1)" }}>
          <h2 style={{ color:"#111827", fontSize:"16px", fontWeight:"600", marginBottom:"8px" }}>Clinical Note</h2>
          <p style={{ color:"#6b7280", fontSize:"13px", lineHeight:"1.6" }}>MyoGuard Protocol provides clinical decision support and educational guidance. It does not replace the advice of your treating physician. Share these results with your doctor at your next consultation.</p>
        </div>
        <a href="/dashboard/assessment" style={{ display:"block", textAlign:"center", padding:"14px", backgroundColor:"#0d9488", color:"white", borderRadius:"8px", fontWeight:"600", fontSize:"15px", textDecoration:"none" }}>Take Another Assessment</a>
      </div>
    </div>
  )
}
