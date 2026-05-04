'use client';

import { useEffect, useRef, useState } from 'react';
import { SignOutButton } from '@clerk/nextjs';

interface PatientAvatarProps {
  initials: string;
}

export default function PatientAvatar({ initials }: PatientAvatarProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        style={{
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          background: '#1A2744',
          border: '1px solid #2DD4BF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: '700',
          color: '#2DD4BF',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {initials}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '180px',
            background: '#0D1421',
            border: '1px solid #1A2744',
            borderRadius: '12px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
            zIndex: 100,
            overflow: 'hidden',
          }}
        >
          <a
            href="/dashboard"
            onClick={() => setOpen(false)}
            style={{
              display: 'block',
              padding: '10px 16px',
              fontSize: '13px',
              color: '#F1F5F9',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#1A2744')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Dashboard
          </a>

          <div style={{ borderTop: '1px solid #1A2744' }} />

          <SignOutButton redirectUrl="/">
            <button
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 16px',
                fontSize: '13px',
                color: '#F87171',
                background: 'transparent',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#1A2744')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              Sign out
            </button>
          </SignOutButton>
        </div>
      )}
    </div>
  );
}
