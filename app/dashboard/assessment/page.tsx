'use client'
import { useState } from "react"
import { useRouter } from "next/navigation"

const SYMPTOMS = ["Nausea", "Vomiting", "Diarrhoea", "Constipation", "Fatigue", "Muscle weakness", "None"]

export default function AssessmentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    weightKg: "", proteinGrams: "", exerciseDaysWk: "",
    hydrationLitres: "", symptoms: [] as string[],
    fatigue: "3", nausea: "1", muscleWeakness: "1",
  })

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  function toggleSymptom(s: string) {
    setForm(p => ({ ...p, symptoms: p.symptoms.includes(s) ? p.symptoms.filter(x=>x!==s) : [...p.symptoms, s] }))
  }

  async function submit() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weightKg: parseFloat(form.weightKg),
          proteinGrams: parseFloat(form.proteinGrams),
          exerciseDaysWk: parseInt(form.exerciseDaysWk),
          hydrationLitres: parseFloat(form.hydrationLitres),
          symptoms: form.symptoms,
          fatigue: parseInt(form.fatigue),
          nausea: parseInt(form.nausea),
          muscleWeakness: parseInt(form.muscleWeakness),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      router.push("/dashboard/results/" + data.assessmentId)
    } catch (e: any) {
      setError(e.message || "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  const inp = { width:"100%", border:"1px solid #e5e7eb", borderRadius:"8px", padding:"12px", fontSize:"14px" }
  const lab = { display:"block", fontSize:"14px", fontWeight:"500", color:"#374151", marginBottom:"4px" }

  return (
    <div style={{ minHeight:"100vh", backgroundColor:"#f9fafb", padding:"40px 20px" }}>
      <div style={{ maxWidth:"560px", margin:"0 auto", backgroundColor:"white", borderRadius:"16px", padding:"40px", boxShadow:"0 1px 3px rgba(0,0,0,0.1)" }}>
        <h1 style={{ color:"#0d9488", fontSize:"22px", fontWeight:"bold", marginBottom:"4px" }}>MyoGuard Assessment</h1>
        <p style={{ color:"#6b7280", fontSize:"14px", marginBottom:"32px" }}>Enter your current measurements to calculate your muscle protection score.</p>
        <div style={{ display:"flex", flexDirection:"column", gap:"20px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
            <div><label style={lab as any}>Current Weight (kg)</label><input style={inp as any} type="number" value={form.weightKg} onChange={e=>set("weightKg",e.target.value)} placeholder="e.g. 89" /></div>
            <div><label style={lab as any}>Daily Protein (g)</label><input style={inp as any} type="number" value={form.proteinGrams} onChange={e=>set("proteinGrams",e.target.value)} placeholder="e.g. 80" /></div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
            <div><label style={lab as any}>Exercise Days/Week</label><input style={inp as any} type="number" min="0" max="7" value={form.exerciseDaysWk} onChange={e=>set("exerciseDaysWk",e.target.value)} placeholder="e.g. 3" /></div>
            <div><label style={lab as any}>Water (litres/day)</label><input style={inp as any} type="number" step="0.1" value={form.hydrationLitres} onChange={e=>set("hydrationLitres",e.target.value)} placeholder="e.g. 2.5" /></div>
          </div>
          <div>
            <label style={lab as any}>Symptoms (select all that apply)</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
              {SYMPTOMS.map(s=><button key={s} onClick={()=>toggleSymptom(s)} style={{ padding:"8px 16px", borderRadius:"999px", border:"1px solid", borderColor:form.symptoms.includes(s)?"#0d9488":"#e5e7eb", backgroundColor:form.symptoms.includes(s)?"#f0fdfa":"white", color:form.symptoms.includes(s)?"#0d9488":"#374151", fontSize:"13px", cursor:"pointer" }}>{s}</button>)}
            </div>
          </div>
          <div>
            <label style={lab as any}>Fatigue Level: {form.fatigue}/5</label>
            <input type="range" min="1" max="5" value={form.fatigue} onChange={e=>set("fatigue",e.target.value)} style={{ width:"100%" }} />
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:"12px", color:"#9ca3af" }}><span>None</span><span>Severe</span></div>
          </div>
          <div>
            <label style={lab as any}>Nausea Level: {form.nausea}/5</label>
            <input type="range" min="1" max="5" value={form.nausea} onChange={e=>set("nausea",e.target.value)} style={{ width:"100%" }} />
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:"12px", color:"#9ca3af" }}><span>None</span><span>Severe</span></div>
          </div>
          {error && <p style={{ color:"#dc2626", fontSize:"14px" }}>{error}</p>}
          <button onClick={submit} disabled={loading} style={{ width:"100%", padding:"14px", backgroundColor:loading?"#9ca3af":"#0d9488", color:"white", border:"none", borderRadius:"8px", fontSize:"15px", fontWeight:"600", cursor:loading?"not-allowed":"pointer" }}>
            {loading ? "Calculating your score..." : "Calculate My MyoGuard Score"}
          </button>
        </div>
      </div>
    </div>
  )
}
