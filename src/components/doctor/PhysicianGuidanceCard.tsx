'use client';

/**
 * PhysicianGuidanceCard — MyoGuard Protocol
 *
 * Dismissible first-session orientation card for newly activated physicians.
 * Renders at the top of the Clinical Command Center on first visit and
 * disappears permanently once dismissed.
 *
 * DISMISSAL PERSISTENCE:
 *   Uses localStorage with a physician-specific key scoped to the Clerk userId.
 *   Format: myoguard_guidance_<userId>
 *   This prevents shared-computer conflicts between physicians at the same practice.
 *
 * HYDRATION GUARD:
 *   Initial state is null (not boolean) so the card never flashes during SSR
 *   hydration for physicians who have already dismissed it.
 *
 * CLINICAL POSITIONING:
 *   This is a compact orientation card — not an onboarding wizard, not a product
 *   tour, not a tutorial system. Three actions, one dismissal. Nothing more.
 */

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';

export interface PhysicianGuidanceCardProps {
  invitePatientsHref: string;
  viewPatientsHref:   string;
}

const STEPS = [
  'Generate your referral QR code',
  'Invite your first patient',
  'Review your first Sarcopenia Risk Index (SRI)',
] as const;

export default function PhysicianGuidanceCard({
  invitePatientsHref,
  viewPatientsHref,
}: PhysicianGuidanceCardProps) {
  const { user } = useUser();
  const userId   = user?.id;

  /**
   * null  → not yet read from localStorage (hydrating or user not loaded)
   * false → not dismissed — show card
   * true  → dismissed — hide card
   */
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!userId) return;
    const key         = `myoguard_guidance_${userId}`;
    const isDismissed = localStorage.getItem(key);
    setDismissed(isDismissed === 'true');
  }, [userId]);

  // Hydrating or user not yet available — render nothing to avoid flash
  if (dismissed === null || !userId) return null;
  // Already dismissed — render nothing
  if (dismissed) return null;

  const handleDismiss = () => {
    const key = `myoguard_guidance_${userId}`;
    localStorage.setItem(key, 'true');
    setDismissed(true);
  };

  return (
    <div
      style={{
        background:   '#0D1421',
        border:       '1px solid #2DD4BF',
        borderRadius: '16px',
        padding:      '20px 24px',
        marginBottom: '24px',
        position:     'relative',
      }}
    >
      {/* ── Dismiss button ───────────────────────────────────────────────────── */}
      {/* 44×44px tap target centred on × glyph; positioned top-right of card  */}
      <button
        onClick={handleDismiss}
        aria-label="Dismiss guidance card"
        style={{
          position:       'absolute',
          top:            0,
          right:          0,
          width:          '44px',
          height:         '44px',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          background:     'transparent',
          border:         'none',
          cursor:         'pointer',
          color:          '#64748B',
          fontSize:       '18px',
          borderRadius:   '0 16px 0 0',
          lineHeight:     1,
        }}
      >
        ×
      </button>

      {/* ── Title ────────────────────────────────────────────────────────────── */}
      <h2
        style={{
          fontFamily:   'Georgia, serif',
          fontSize:     '16px',
          fontWeight:   600,
          color:        '#F1F5F9',
          margin:       '0 0 4px 0',
          paddingRight: '40px',   /* prevent overlap with dismiss button */
        }}
      >
        Clinical Command Center
      </h2>

      {/* ── Subheading ───────────────────────────────────────────────────────── */}
      <p
        style={{
          fontSize:      '11px',
          fontWeight:    700,
          color:         '#2DD4BF',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          margin:        '0 0 14px 0',
        }}
      >
        Your first three actions
      </p>

      {/* ── Supporting text ──────────────────────────────────────────────────── */}
      <p
        style={{
          fontSize:   '13px',
          color:      '#94A3B8',
          lineHeight: 1.6,
          margin:     '0 0 14px 0',
        }}
      >
        Your Clinical Command Center is active.
      </p>

      {/* ── Three-step list ──────────────────────────────────────────────────── */}
      <ol
        style={{
          margin:        '0 0 16px 0',
          padding:       0,
          listStyle:     'none',
          display:       'flex',
          flexDirection: 'column',
          gap:           '10px',
        }}
      >
        {STEPS.map((step, i) => (
          <li
            key={i}
            style={{
              display:    'flex',
              alignItems: 'flex-start',
              gap:        '10px',
              fontSize:   '13px',
              color:      '#F1F5F9',
              lineHeight: 1.5,
            }}
          >
            {/* Numbered badge */}
            <span
              style={{
                width:          '20px',
                height:         '20px',
                borderRadius:   '50%',
                background:     'rgba(45,212,191,0.12)',
                border:         '1px solid rgba(45,212,191,0.28)',
                color:          '#2DD4BF',
                fontSize:       '10px',
                fontWeight:     700,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                flexShrink:     0,
                marginTop:      '2px',
              }}
            >
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      {/* ── Closing line ─────────────────────────────────────────────────────── */}
      <p
        style={{
          fontSize:   '12px',
          color:      '#94A3B8',
          fontStyle:  'italic',
          lineHeight: 1.55,
          margin:     '0 0 20px 0',
        }}
      >
        Your first patient can be activated in under two minutes using the referral QR code.
      </p>

      {/* ── CTA buttons — stack on mobile (<sm), side-by-side on sm+ ─────────── */}
      <div
        className="flex flex-col sm:flex-row"
        style={{ gap: '10px' }}
      >
        {/* Primary: Invite Patient */}
        <Link
          href={invitePatientsHref}
          style={{
            display:        'inline-flex',
            alignItems:     'center',
            justifyContent: 'center',
            height:         '44px',
            padding:        '0 20px',
            background:     '#2DD4BF',
            color:          '#080C14',
            fontWeight:     700,
            fontSize:       '13px',
            borderRadius:   '99px',
            textDecoration: 'none',
            whiteSpace:     'nowrap',
          }}
        >
          Invite Patient →
        </Link>

        {/* Secondary: View Patients */}
        <Link
          href={viewPatientsHref}
          style={{
            display:        'inline-flex',
            alignItems:     'center',
            justifyContent: 'center',
            height:         '44px',
            padding:        '0 20px',
            background:     'transparent',
            border:         '1px solid #1A2744',
            color:          '#2DD4BF',
            fontSize:       '13px',
            borderRadius:   '99px',
            textDecoration: 'none',
            whiteSpace:     'nowrap',
          }}
        >
          View Patients →
        </Link>
      </div>
    </div>
  );
}
