"use client";
import { useState } from "react";

export default function CheckinPage() {
  const [protein, setProtein] = useState("");
  const [weight, setWeight] = useState("");
  const [gi, setGi] = useState("");
  const [exercise, setExercise] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!protein || !weight || !exercise) return;

    const nauseaMap: Record<string, number> = {
      "None": 1,
      "Mild — managed well": 2,
      "Moderate — affecting diet": 3,
      "Severe — significantly limiting": 5,
    };

    const workoutMap: Record<string, number> = {
      "0 sessions": 0,
      "1 session": 1,
      "2 sessions": 2,
      "3 sessions": 3,
      "4+ sessions": 4,
    };

    const payload = {
      avgWeightKg:   parseFloat(weight),
      avgProteinG:   parseFloat(protein),
      totalWorkouts: workoutMap[exercise] ?? 0,
      nauseaLevel:   nauseaMap[gi] ?? 1,
    };

    setLoading(true);
    try {
      const res = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const json = await res.json().catch(() => ({}));
        console.error("[checkin] save failed:", json);
        setSubmitted(true);
      }
    } catch (err) {
      console.error("[checkin] network error:", err);
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  const nav = (
    <nav style={{
      background: "#060D1E",
      borderBottom: "1px solid rgba(255,255,255,0.07)",
      position: "sticky", top: 0, zIndex: 50,
      padding: "0 20px",
    }}>
      <div style={{ maxWidth: "640px", margin: "0 auto",
        display: "flex", alignItems: "center",
        justifyContent: "space-between", height: "56px" }}>
        <a href="/dashboard" style={{ textDecoration: "none",
          fontSize: "18px", fontWeight: "900",
          letterSpacing: "-0.03em", color: "#F8FAFC" }}>
          Myo<span style={{ color: "#2DD4BF" }}>Guard</span>
        </a>
        <a href="/dashboard" style={{ fontSize: "13px",
          color: "#94A3B8", textDecoration: "none" }}>
          ← Dashboard
        </a>
      </div>
    </nav>
  );

  if (submitted) {
    return (
      <main style={{ background: "#080C14", minHeight: "100vh",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        {nav}
        <div style={{ display: "flex", alignItems: "center",
          justifyContent: "center", padding: "80px 20px" }}>
          <div style={{ background: "#0D1421", border: "1px solid #1A2744",
            borderRadius: "16px", padding: "40px 32px",
            maxWidth: "400px", width: "100%",
            textAlign: "center", display: "flex",
            flexDirection: "column", gap: "16px" }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "50%",
              background: "rgba(45,212,191,0.12)",
              border: "1px solid rgba(45,212,191,0.3)",
              display: "flex", alignItems: "center",
              justifyContent: "center", margin: "0 auto",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24"
                fill="none" stroke="#2DD4BF" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "18px",
              fontWeight: "600", color: "#F1F5F9", margin: 0 }}>
              Check-in recorded
            </h2>
            <p style={{ fontSize: "13px", color: "#94A3B8",
              lineHeight: "1.6", margin: 0 }}>
              Your weekly data has been saved. Keep up the consistency — it compounds.
            </p>
            <a href="/dashboard" style={{
              display: "inline-block", background: "#2DD4BF",
              color: "#080C14", padding: "12px 28px",
              borderRadius: "99px", fontSize: "13px",
              fontWeight: "700", textDecoration: "none",
            }}>
              Back to dashboard
            </a>
          </div>
        </div>
      </main>
    );
  }

  const isDisabled = !protein || !weight || !exercise || loading;

  return (
    <main style={{ background: "#080C14", minHeight: "100vh",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <style>{`
        .myg-input::placeholder { color: #475569; }
        .myg-input:focus { outline: none; border-color: #2DD4BF !important; }
        .myg-select:focus { outline: none; border-color: #2DD4BF !important; }
        .myg-select option { background: #0D1421; color: #F1F5F9; }
      `}</style>

      {nav}

      <div style={{ maxWidth: "640px", margin: "0 auto", padding: "32px 20px 48px" }}>

        {/* Heading */}
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: "22px",
            fontWeight: "600", color: "#F1F5F9", marginBottom: "6px" }}>
            Weekly check-in
          </h1>
          <p style={{ fontSize: "13px", color: "#94A3B8" }}>
            Takes 60 seconds. Helps track your muscle-protection progress.
          </p>
        </div>

        {/* Form card */}
        <div style={{ background: "#0D1421", border: "1px solid #1A2744",
          borderRadius: "16px", padding: "24px",
          display: "flex", flexDirection: "column", gap: "20px",
          marginBottom: "20px" }}>

          {/* Protein */}
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: "500", color: "#94A3B8" }}>
              This week&apos;s average protein intake (g/day)
            </span>
            <input
              type="number"
              placeholder="e.g. 95"
              value={protein}
              onChange={e => setProtein(e.target.value)}
              className="myg-input"
              style={{ background: "#0D1421", border: "1px solid #1A2744",
                color: "#F1F5F9", borderRadius: "8px",
                padding: "10px 14px", fontSize: "14px" }}
            />
          </label>

          {/* Weight */}
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: "500", color: "#94A3B8" }}>
              Current weight (kg)
            </span>
            <input
              type="number"
              placeholder="e.g. 84"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              className="myg-input"
              style={{ background: "#0D1421", border: "1px solid #1A2744",
                color: "#F1F5F9", borderRadius: "8px",
                padding: "10px 14px", fontSize: "14px" }}
            />
          </label>

          {/* GI symptoms */}
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: "500", color: "#94A3B8" }}>
              GI symptoms this week
            </span>
            <select
              value={gi}
              onChange={e => setGi(e.target.value)}
              className="myg-select"
              style={{ background: "#0D1421", border: "1px solid #1A2744",
                color: gi ? "#F1F5F9" : "#475569",
                borderRadius: "8px", padding: "10px 14px",
                fontSize: "14px", cursor: "pointer" }}
            >
              <option value="">Select</option>
              <option>None</option>
              <option>Mild — managed well</option>
              <option>Moderate — affecting diet</option>
              <option>Severe — significantly limiting</option>
            </select>
          </label>

          {/* Exercise */}
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: "500", color: "#94A3B8" }}>
              Resistance training sessions this week
            </span>
            <select
              value={exercise}
              onChange={e => setExercise(e.target.value)}
              className="myg-select"
              style={{ background: "#0D1421", border: "1px solid #1A2744",
                color: exercise ? "#F1F5F9" : "#475569",
                borderRadius: "8px", padding: "10px 14px",
                fontSize: "14px", cursor: "pointer" }}
            >
              <option value="">Select</option>
              <option>0 sessions</option>
              <option>1 session</option>
              <option>2 sessions</option>
              <option>3 sessions</option>
              <option>4+ sessions</option>
            </select>
          </label>

        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={isDisabled}
          style={{
            width: "100%",
            background: isDisabled ? "#1A2744" : "#2DD4BF",
            color: isDisabled ? "#475569" : "#080C14",
            padding: "14px", borderRadius: "99px",
            fontSize: "14px", fontWeight: "700",
            border: "none", cursor: isDisabled ? "not-allowed" : "pointer",
            transition: "background 0.15s",
          }}
        >
          {loading ? "Saving..." : "Submit check-in"}
        </button>

        <p style={{ fontSize: "12px", color: "#475569",
          textAlign: "center", marginTop: "16px" }}>
          MyoGuard Clinical Oversight · For monitoring purposes only
        </p>

      </div>
    </main>
  );
}
