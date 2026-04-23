"use client"
import { useEffect, useState } from "react"

interface Props {
  score: number
  riskBand: string
}

export default function SanctuaryScoreOrb({ score, riskBand }: Props) {
  const [offset, setOffset] = useState(502)

  const orbColor =
    score >= 70 ? "#2DD4BF" :
    score >= 50 ? "#F59E0B" : "#FB7185"

  const riskLabel =
    riskBand === "LOW" ? "Low Risk" :
    riskBand === "MODERATE" ? "Moderate Risk" : "High Risk"

  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(502 - (score / 100) * 502)
    }, 100)
    return () => clearTimeout(timer)
  }, [score])

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "12px"
    }}>
      <style>{`
        @keyframes orbBreathe {
          0%, 100% { filter: drop-shadow(0 0 8px ${orbColor}40); }
          50% { filter: drop-shadow(0 0 24px ${orbColor}60); }
        }
        .orb-glow { animation: orbBreathe 3s ease-in-out infinite; }
      `}</style>
      <div className="orb-glow">
        <svg viewBox="0 0 200 200" width="180" height="180">
          <circle cx="100" cy="100" r="80"
            fill="none" stroke="#1A2744" strokeWidth="12" />
          <circle cx="100" cy="100" r="80"
            fill="none"
            stroke={orbColor}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray="502"
            strokeDashoffset={offset}
            transform="rotate(-90 100 100)"
            style={{ transition: "stroke-dashoffset 1.2s ease-out" }}
          />
          <text x="100" y="92" textAnchor="middle"
            fill="#F1F5F9" fontSize="44" fontWeight="700"
            fontFamily="Georgia, serif">
            {score}
          </text>
          <text x="100" y="114" textAnchor="middle"
            fill="#94A3B8" fontSize="13"
            fontFamily="-apple-system, sans-serif">
            /100
          </text>
          <text x="100" y="136" textAnchor="middle"
            fill={orbColor} fontSize="12" fontWeight="600"
            fontFamily="-apple-system, sans-serif">
            {riskLabel}
          </text>
        </svg>
      </div>
    </div>
  )
}
