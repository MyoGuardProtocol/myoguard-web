'use client';

/**
 * UserDropdown
 *
 * Shows a signed-in user's avatar + name in the header and a dropdown with:
 *   • My Account  — opens Clerk's native profile modal (no custom route needed)
 *   • Dashboard   — links to /dashboard
 *   • Sign Out    — calls clerk.signOut() and redirects to /
 *
 * Behaviour:
 *   • Closes on outside click (mousedown listener)
 *   • Closes on Escape key
 *   • Avatar falls back to initials when no Clerk image is set
 *   • Name truncated to 120 px on sm+, hidden on xs (avatar only)
 *   • Returns null if Clerk is loading or user is not signed in
 *     (Header shows signed-out links instead)
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import Link from 'next/link';
import Image from 'next/image';

export default function UserDropdown() {
  const { user, isLoaded, isSignedIn } = useUser();
  const clerk = useClerk();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  /* ── Close on outside click ─────────────────────────────────────────── */
  const handleOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  /* ── Close on Escape ────────────────────────────────────────────────── */
  const handleKeydown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleOutside);
      document.addEventListener('keydown', handleKeydown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [open, handleOutside, handleKeydown]);

  /* ── Guard: only render for signed-in users ─────────────────────────── */
  if (!isLoaded || !isSignedIn || !user) return null;

  /* ── Derived display values ─────────────────────────────────────────── */
  const initials =
    [user.firstName?.[0], user.lastName?.[0]]
      .filter(Boolean)
      .join('')
      .toUpperCase() ||
    user.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ||
    '?';

  const displayName =
    user.fullName ||
    user.primaryEmailAddress?.emailAddress ||
    'Account';

  const email = user.primaryEmailAddress?.emailAddress;

  /* ── Handlers ───────────────────────────────────────────────────────── */
  function handleSignOut() {
    setOpen(false);
    clerk.signOut({ redirectUrl: '/' });
  }

  function handleMyAccount() {
    setOpen(false);
    clerk.openUserProfile();
  }

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div ref={containerRef} className="relative">

      {/* ── Trigger ──────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      >
        {/* Avatar */}
        <div className="w-7 h-7 rounded-full overflow-hidden bg-teal-600 flex items-center justify-center flex-shrink-0 ring-1 ring-teal-500/20">
          {user.imageUrl ? (
            <Image
              src={user.imageUrl}
              alt={displayName}
              width={28}
              height={28}
              className="object-cover w-full h-full"
            />
          ) : (
            <span className="text-[11px] font-bold text-white leading-none select-none">
              {initials}
            </span>
          )}
        </div>

        {/* Name — hidden on xs, shown on sm+ */}
        <span className="hidden sm:block text-xs font-medium text-slate-700 max-w-[120px] truncate leading-none">
          {displayName}
        </span>

        {/* Chevron */}
        <svg
          className={`w-3 h-3 text-slate-400 transition-transform duration-150 flex-shrink-0 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* ── Dropdown panel ───────────────────────────────────────────── */}
      {open && (
        <div
          role="menu"
          aria-label="Account options"
          className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl border border-slate-200 shadow-lg shadow-slate-200/60 z-50 overflow-hidden"
        >

          {/* User info header */}
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-800 truncate">{displayName}</p>
            {email && (
              <p className="text-[11px] text-slate-400 truncate mt-0.5">{email}</p>
            )}
          </div>

          {/* Menu items */}
          <div className="py-1" role="none">

            {/* My Account */}
            <button
              type="button"
              role="menuitem"
              onClick={handleMyAccount}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors text-left"
            >
              <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              My Account
            </button>

            {/* Dashboard */}
            <Link
              href="/dashboard"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
              Dashboard
            </Link>
          </div>

          {/* Divider + Sign Out */}
          <div className="border-t border-slate-100 py-1" role="none">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-rose-600 hover:bg-rose-50 transition-colors text-left"
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              Sign Out
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
