'use client'
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"

const STEPS = ["Personal Details", "Body Measurements", "GLP-1 Therapy", "Nutrition", "Consent"]

const MEDS = ["Semaglutide (Ozempic)", "Semaglutide (Wegovy)", "Tirzepatide (Mounjaro)", "Tirzepatide (Zepbound)", "Liraglutide (Victoza)", "Other"]

export default function OnboardingPage() {
  const router = useRouter()
  const { user } = useUser()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [codeStatus, setCodeStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle')
  const [physicianName, setPhysicianName] = useState("")
  const [form, setForm] = useState({
    fullName: "", age: "", sex: "", heightCm: "", weightKg: "",
    goalWeightKg: "", activityLevel: "", glp1Medication: "",
    glp1DoseMg: "", glp1Stage: "", treatmentStart: "",
    baselineProtein: "", researchConsent: false,
    physicianCode: "",
  })
  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }))

  // Pre-fill physician code from /join page sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('myoguard_physician_code')
    if (stored) {
      set('physicianCode', stored)
      // Auto-validate the pre-filled code
      validateCode(stored)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function validateCode(rawCode: string) {
    const code = rawCode.trim().toUpperCase()
    if (!code) {
      setCodeStatus('idle')
      setPhysicianName("")
      return
    }
    setCodeStatus('validating')
    try {
      const res = await fetch(`/api/physician/validate-code?code=${encodeURIComponent(code)}`)
      const data = await res.json() as { ok: boolean; displayName?: string }
      if (data.ok && data.displayName) {
        setCodeStatus('valid')
        setPhysicianName(data.displayName)
      } else {
        setCodeStatus('invalid')
        setPhysicianName("")
      }
    } catch {
      setCodeStatus('idle')
    }
  }

  async function submit() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/user/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          age: parseInt(form.age),
          heightCm: parseFloat(form.heightCm),
          weightKg: parseFloat(form.weightKg),
          goalWeightKg: form.goalWeightKg ? parseFloat(form.goalWeightKg) : undefined,
          glp1DoseMg: parseFloat(form.glp1DoseMg),
          baselineProtein: form.baselineProtein ? parseFloat(form.baselineProtein) : undefined,
          email: user?.primaryEmailAddress?.emailAddress || "",
          physicianCode: form.physicianCode.trim().toUpperCase() || undefined,
        }),
      })
      if (!res.ok) throw new Error("Failed")
      // Clear stored physician code after successful onboarding
      sessionStorage.removeItem('myoguard_physician_code')
      router.push("/dashboard/assessment")
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:"100vh", backgroundColor:"#f9fafb", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div style={{ backgroundColor:"white", padding:"40px", borderRadius:"16px", maxWidth:"520px", width:"100%", boxShadow:"0 1px 3px rgba(0,0,0,0.1)" }}>
        <h1 style={{ color:"#0d9488", fontSize:"22px", fontWeight:"bold", marginBottom:"4px" }}>MyoGuard Protocol</h1>
        <p style={{ color:"#6b7280", fontSize:"14px", marginBottom:"16px" }}>Step {step+1} of {STEPS.length}: {STEPS[step]}</p>
        <div style={{ height:"6px", backgroundColor:"#e5e7eb", borderRadius:"999px", marginBottom:"32px" }}>
          <div style={{ height:"6px", backgroundColor:"#0d9488", borderRadius:"999px", width:((step+1)/STEPS.length*100)+"%" }} />
        </div>

        {step === 0 && (
          <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
            <div><label style={{ display:"block", fontSize:"14px", fontWeight:"500", color:"#374151", marginBottom:"4px" }}>Full Name</label>
            <input style={{ width:"100%", border:"1px solid #e5e7eb", borderRadius:"8px", padding:"12px", fontSize:"14px" }} value={form.fullName} onChange={e=>set("fullName",e.target.value)} placeholder="Your full name" /></div>

            {/* ── Physician Code (optional) ── */}
            <div>
              <label style={{ display:"block", fontSize:"14px", fontWeight:"500", color:"#374151", marginBottom:"4px" }}>
                Physician Code <span style={{ color:"#9ca3af", fontWeight:"normal" }}>(optional)</span>
              </label>
              <div style={{ position:"relative" }}>
                <input
                  style={{
                    width:"100%", border:"1px solid",
                    borderColor: codeStatus === 'valid' ? '#10b981' : codeStatus === 'invalid' ? '#ef4444' : '#e5e7eb',
                    borderRadius:"8px", padding:"12px", paddingRight:"40px",
                    fontSize:"14px", fontFamily:"monospace", letterSpacing:"0.05em",
                    textTransform:"uppercase", boxSizing:"border-box"
                  }}
                  value={form.physicianCode}
                  onChange={e => {
                    set("physicianCode", e.target.value)
                    if (e.target.value.length >= 6) {
                      validateCode(e.target.value)
                    } else if (!e.target.value) {
                      setCodeStatus('idle')
                      setPhysicianName("")
                    }
                  }}
                  placeholder="e.g. DR-OKPALA-472"
                  autoCapitalize="characters"
                />
                {codeStatus === 'validating' && (
                  <span style={{ position:"absolute", right:"12px", top:"50%", transform:"translateY(-50%)", color:"#9ca3af", fontSize:"12px" }}>…</span>
                )}
                {codeStatus === 'valid' && (
                  <span style={{ position:"absolute", right:"12px", top:"50%", transform:"translateY(-50%)", color:"#10b981" }}>✓</span>
                )}
                {codeStatus === 'invalid' && (
                  <span style={{ position:"absolute", right:"12px", top:"50%", transform:"translateY(-50%)", color:"#ef4444" }}>✗</span>
                )}
              </div>
              {codeStatus === 'valid' && physicianName && (
                <p style={{ fontSize:"12px", color:"#059669", marginTop:"4px" }}>Linked to {physicianName}</p>
              )}
              {codeStatus === 'invalid' && (
                <p style={{ fontSize:"12px", color:"#dc2626", marginTop:"4px" }}>Code not recognised — you can continue without one.</p>
              )}
              {codeStatus === 'idle' && (
                <p style={{ fontSize:"12px", color:"#9ca3af", marginTop:"4px" }}>Enter the code your doctor gave you to link your account.</p>
              )}
            </div>

            <div><label style={{ display:"block", fontSize:"14px", fontWeight:"500", color:"#374151", marginBottom:"4px" }}>Age</label>
            <input style={{ width:"100%", border:"1px solid #e5e7eb", borderRadius:"8px", padding:"12px", fontSize:"14px" }} type="number" value={form.age} onChange={e=>set("age",e.target.value)} placeholder="e.g. 48" /></div>
            <div><label style={{ display:"block", fontSize:"14px", fontWeight:"500", color:"#374151", marginBottom:"4px" }}>Sex</label>
            <select style={{ width:"100%", border:"1px solid #e5e7eb", borderRadius:"8px", padding:"12px", fontSize:"14px", background:"white" }} value={form.sex} onChange={e=>set("sex",e.target.value)}>
              <option value="">Select...</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option><option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
            </select></div>
            <div><label style={{ display:"block", fontSize:"14px", fontWeight:"500", color:"#374151", marginBottom:"4px" }}>Activity Level</label>
            <select style={{ width:"100%", border:"1px solid #e5e7eb", borderRadius:"8px", padding:"12px", fontSize:"14px", background:"white" }} value={form.activityLevel} onChange={e=>set("activityLevel",e.target.value)}>
              <option value="">Select...</option><option value="SEDENTARY">Sedentary</option><option value="LIGHTLY_ACTIVE">Lightly Active (1-3 days/week)</option><option value="MODERATELY_ACTIVE">Moderately Active (3-5 days/week)</option><option value="VERY_ACTIVE">Very Active (6-7 days/week)</option>
            </select></div>
          </div>
        )}

        {step === 1 && (
          <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
              <div><label style={{ display:"block", fontSize:"14px", fontWeight:"500", marginBottom:"4px" }}>Height (cm)</label><input style={{ width:"100%", border:"1px solid #e5e7eb", borderRadius:"8px", padding:"12px" }} type="number" value={form.heightCm} onChange={e=>set("heightCm",e.target.value)} placeholder="170" /></div>
              <div><label style={{ display:"block", fontSize:"14px", fontWeight:"500", marginBottom:"4px" }}>Weight (kg)</label><input style={{ width:"100%", border:"1px solid #e5e7eb", borderRadius:"8px", padding:"12px" }} type="number" value={form.weightKg} onChange={e=>set("weightKg",e.target.value)} placeholder="92" /></div>
            </div>
            <div><label style={{ display:"block", fontSize:"14px", fontWeight:"500", marginBottom:"4px" }}>Goal Weight (kg) optional</label><input style={{ width:"100%", border:"1px solid #e5e7eb", borderRadius:"8px", padding:"12px" }} type="number" value={form.goalWeightKg} onChange={e=>set("goalWeightKg",e.target.value)} placeholder="75" /></div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
            <div><label style={{ display:"block", fontSize:"14px", fontWeight:"500", marginBottom:"4px" }}>Medication</label>
            <select style={{ width:"100%", border:"1px solid #e5e7eb", borderRadius:"8px", padding:"12px", background:"white" }} value={form.glp1Medication} onChange={e=>set("glp1Medication",e.target.value)}>
              <option value="">Select...</option>
              {MEDS.map(m=><option key={m} value={m}>{m}</option>)}
            </select></div>
            <div><label style={{ display:"block", fontSize:"14px", fontWeight:"500", marginBottom:"4px" }}>Dose (mg)</label><input style={{ width:"100%", border:"1px solid #e5e7eb", borderRadius:"8px", padding:"12px" }} type="number" step="0.25" value={form.glp1DoseMg} onChange={e=>set("glp1DoseMg",e.target.value)} placeholder="1.0" /></div>
            <div><label style={{ display:"block", fontSize:"14px", fontWeight:"500", marginBottom:"4px" }}>Treatment Stage</label>
            <select style={{ width:"100%", border:"1px solid #e5e7eb", borderRadius:"8px", padding:"12px", background:"white" }} value={form.glp1Stage} onChange={e=>set("glp1Stage",e.target.value)}>
              <option value="">Select...</option><option value="INITIATION">Initiation (0-3 months)</option><option value="DOSE_ESCALATION">Dose Escalation (3-6 months)</option><option value="MAINTENANCE">Maintenance (6+ months)</option><option value="DISCONTINUING">Planning to discontinue</option>
            </select></div>
            <div><label style={{ display:"block", fontSize:"14px", fontWeight:"500", marginBottom:"4px" }}>Treatment Start Date</label><input style={{ width:"100%", border:"1px solid #e5e7eb", borderRadius:"8px", padding:"12px" }} type="date" value={form.treatmentStart} onChange={e=>set("treatmentStart",e.target.value)} /></div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
            <div style={{ backgroundColor:"#f0fdfa", borderRadius:"8px", padding:"16px", fontSize:"14px", color:"#0f766e" }}>Approximate values are fine. This helps calibrate your starting point.</div>
            <div><label style={{ display:"block", fontSize:"14px", fontWeight:"500", marginBottom:"4px" }}>Average Daily Protein (grams) optional</label><input style={{ width:"100%", border:"1px solid #e5e7eb", borderRadius:"8px", padding:"12px" }} type="number" value={form.baselineProtein} onChange={e=>set("baselineProtein",e.target.value)} placeholder="65" /></div>
          </div>
        )}

        {step === 4 && (
          <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
            <div style={{ backgroundColor:"#f9fafb", borderRadius:"8px", padding:"16px", fontSize:"14px", color:"#6b7280" }}>MyoGuard provides clinical decision support. It does not replace your physician.</div>
            <label style={{ display:"flex", alignItems:"flex-start", gap:"12px", cursor:"pointer" }}>
              <input type="checkbox" checked={form.researchConsent} onChange={e=>set("researchConsent",e.target.checked)} style={{ marginTop:"2px" }} />
              <span style={{ fontSize:"14px", color:"#374151" }}>I consent to my anonymised data being used for research into muscle preservation during GLP-1 therapy.</span>
            </label>
            {error && <p style={{ color:"#dc2626", fontSize:"14px" }}>{error}</p>}
          </div>
        )}

        <div style={{ display:"flex", justifyContent:"space-between", marginTop:"32px" }}>
          {step > 0 ? <button onClick={()=>setStep(s=>s-1)} style={{ padding:"10px 24px", border:"1px solid #e5e7eb", borderRadius:"8px", fontSize:"14px", cursor:"pointer", background:"white" }}>Back</button> : <div />}
          {step < STEPS.length-1
            ? <button onClick={()=>setStep(s=>s+1)} style={{ padding:"10px 24px", backgroundColor:"#0d9488", color:"white", border:"none", borderRadius:"8px", fontSize:"14px", cursor:"pointer" }}>Continue</button>
            : <button onClick={submit} disabled={loading} style={{ padding:"10px 24px", backgroundColor:loading?"#9ca3af":"#0d9488", color:"white", border:"none", borderRadius:"8px", fontSize:"14px", cursor:"pointer" }}>{loading?"Setting up...":"Start My Assessment"}</button>
          }
        </div>
      </div>
    </div>
  )
}
