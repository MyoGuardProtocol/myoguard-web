"use client";
import { QRCodeSVG } from "qrcode.react";

interface Props {
  url: string;
  physicianName: string;
}

export default function PhysicianQRCode({ url, physicianName }: Props) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "12px",
    }}>
      <div style={{
        background: "#ffffff",
        padding: "16px",
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.1)",
      }}>
        <QRCodeSVG
          value={url}
          size={160}
          level="H"
          includeMargin={false}
        />
      </div>
      <p style={{
        fontSize: "11px",
        color: "rgba(255,255,255,0.35)",
        textAlign: "center",
        maxWidth: "180px",
        lineHeight: "1.5",
      }}>
        Scan to join {physicianName}&apos;s patient panel
      </p>
    </div>
  );
}
