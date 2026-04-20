"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";

interface PhysicianAvatarProps {
  fullName: string;
  email: string;
  role: string;
}

function getInitials(name: string): string {
  const parts = name.replace(/^Dr\.?\s*/i, "").trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) ?? "??").toUpperCase();
}

export default function PhysicianAvatar({ fullName, email, role }: PhysicianAvatarProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const initials = getInitials(fullName);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Avatar button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Physician menu"
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          background: "#1e293b",
          border: "1px solid #334155",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#34d399", lineHeight: 1 }}>
          {initials}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "8px",
            width: "256px",
            background: "#0f172a",
            border: "1px solid #334155",
            borderRadius: "1rem",
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
            zIndex: 50,
            paddingTop: "8px",
            paddingBottom: "8px",
          }}
        >
          {/* Header — identity */}
          <div
            style={{
              padding: "0.75rem 1rem",
              borderBottom: "1px solid #1e293b",
            }}
          >
            <p style={{ color: "#ffffff", fontWeight: 600, fontSize: "0.875rem", marginBottom: "2px" }}>
              {fullName}
            </p>
            <p style={{ color: "#94a3b8", fontSize: "0.75rem", marginBottom: "6px", wordBreak: "break-all" }}>
              {email}
            </p>
            {role === "PHYSICIAN" ? (
              <span
                style={{
                  display: "inline-block",
                  background: "#064e3b",
                  color: "#6ee7b7",
                  border: "1px solid #065f46",
                  borderRadius: "9999px",
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  padding: "2px 10px",
                  letterSpacing: "0.04em",
                }}
              >
                Verified Physician
              </span>
            ) : (
              <span
                style={{
                  display: "inline-block",
                  background: "#451a03",
                  color: "#fcd34d",
                  border: "1px solid #78350f",
                  borderRadius: "9999px",
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  padding: "2px 10px",
                  letterSpacing: "0.04em",
                }}
              >
                Pending Approval
              </span>
            )}
          </div>

          {/* Menu items */}
          <Link
            href="/doctor/start-sheet"
            onClick={() => setOpen(false)}
            style={{
              display: "block",
              padding: "0.625rem 1rem",
              fontSize: "0.875rem",
              color: "#34d399",
              textDecoration: "none",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#1e293b")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Start Sheet
          </Link>

          <Link
            href="/doctor/patients"
            onClick={() => setOpen(false)}
            style={{
              display: "block",
              padding: "0.625rem 1rem",
              fontSize: "0.875rem",
              color: "#cbd5e1",
              textDecoration: "none",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#1e293b")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            My Patients
          </Link>

          <Link
            href="/doctor/start"
            onClick={() => setOpen(false)}
            style={{
              display: "block",
              padding: "0.625rem 1rem",
              fontSize: "0.875rem",
              color: "#cbd5e1",
              textDecoration: "none",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#1e293b")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Invite Patients
          </Link>

          {/* Divider */}
          <div style={{ borderTop: "1px solid #1e293b", margin: "4px 0" }} />

          {/* Sign out */}
          <SignOutButton redirectUrl="/">
            <button
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                width: "100%",
                padding: "0.625rem 1rem",
                fontSize: "0.875rem",
                color: "#f87171",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#1e293b")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign Out
            </button>
          </SignOutButton>
        </div>
      )}
    </div>
  );
}
