import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt =
  "MyoGuard Protocol — Physician-Led Muscle Protection During GLP-1 Therapy";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#080C14",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "0 88px",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        {/* Left teal accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "6px",
            height: "100%",
            background: "#2DD4BF",
            display: "flex",
          }}
        />

        {/* Bottom-right subtle grid accent */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: "320px",
            height: "320px",
            background:
              "radial-gradient(circle at bottom right, rgba(45,212,191,0.04) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Physician-Led CDS badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "#0D1421",
            border: "1px solid rgba(45,212,191,0.25)",
            borderRadius: "6px",
            padding: "8px 18px",
            marginBottom: "38px",
            gap: "10px",
          }}
        >
          <div
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: "#2DD4BF",
              display: "flex",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              color: "#2DD4BF",
              fontSize: "14px",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Physician-Led Clinical Decision Support
          </span>
        </div>

        {/* Wordmark — Myo (white) Guard (teal) Protocol (slate) */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            marginBottom: "24px",
            lineHeight: 1,
          }}
        >
          <span
            style={{
              color: "#F1F5F9",
              fontSize: "82px",
              fontWeight: 900,
              letterSpacing: "-0.03em",
            }}
          >
            Myo
          </span>
          <span
            style={{
              color: "#2DD4BF",
              fontSize: "82px",
              fontWeight: 900,
              letterSpacing: "-0.03em",
            }}
          >
            Guard
          </span>
          <span
            style={{
              color: "#3B5268",
              fontSize: "82px",
              fontWeight: 300,
              letterSpacing: "-0.03em",
              marginLeft: "18px",
            }}
          >
            Protocol
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            display: "flex",
            color: "#94A3B8",
            fontSize: "29px",
            fontWeight: 400,
            lineHeight: 1.45,
            maxWidth: "780px",
            marginBottom: "52px",
          }}
        >
          Physician-Led Muscle Protection During GLP-1 Therapy
        </div>

        {/* SRI detail row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: "#2DD4BF",
              display: "flex",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              color: "#2D3F52",
              fontSize: "17px",
              letterSpacing: "0.03em",
            }}
          >
            Sarcopenia Risk Index (SRI) · GI Tolerance · Anabolic Resistance ·
            Protein Optimisation
          </span>
        </div>

        {/* Entity watermark — bottom right */}
        <div
          style={{
            position: "absolute",
            bottom: "48px",
            right: "88px",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "5px",
          }}
        >
          <span
            style={{ color: "#1A2744", fontSize: "13px", fontWeight: 500 }}
          >
            Meridian Wellness Systems LLC
          </span>
          <span style={{ color: "#111827", fontSize: "12px" }}>
            myoguard.health
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
