import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = { width: 180, height: 180 };

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#080C14",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        {/* MG monogram — M white, G teal */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            lineHeight: 1,
          }}
        >
          <span
            style={{
              color: "#F1F5F9",
              fontSize: "88px",
              fontWeight: 900,
              letterSpacing: "-4px",
            }}
          >
            M
          </span>
          <span
            style={{
              color: "#2DD4BF",
              fontSize: "88px",
              fontWeight: 900,
              letterSpacing: "-4px",
            }}
          >
            G
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
