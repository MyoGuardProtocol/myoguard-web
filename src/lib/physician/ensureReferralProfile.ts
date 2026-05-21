/**
 * Idempotent: ensures a verified physician has an active referral slug and a
 * PhysicianProfile with a patient-facing referral code.  Safe to call on
 * every page load — it short-circuits immediately when everything is in place.
 *
 * Returns { slug, referralCode } on success, null only on unexpected failure.
 */

import { prisma } from '@/src/lib/prisma';

type UserInput = {
  id:           string;
  fullName:     string | null;
  referralSlug: string | null;
};

async function generateUniqueCode(lastName: string): Promise<{ slug: string; code: string } | null> {
  const upper = lastName.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8) || 'DOC';
  const lower = upper.toLowerCase();

  for (let i = 0; i < 5; i++) {
    const num  = String(100 + Math.floor(Math.random() * 900));
    const slug = `dr-${lower}-${num}`;
    const code = `DR-${upper}-${num}`;

    const [slugHit, codeHit] = await Promise.all([
      prisma.physicianProfile.findUnique({ where: { slug },         select: { id: true } }).catch(() => null),
      prisma.physicianProfile.findFirst({ where: { referralCode: code }, select: { id: true } }).catch(() => null),
    ]);

    if (!slugHit && !codeHit) return { slug, code };
  }

  // Fallback: base-36 timestamp suffix — practically collision-free
  const ts   = Date.now().toString(36).toUpperCase().slice(-4);
  return { slug: `dr-${lower}-${ts}`, code: `DR-${upper}-${ts}` };
}

function parseLastName(fullName: string | null): string {
  const cleaned = (fullName ?? '').replace(/^Dr\.?\s+/i, '').trim();
  const parts   = cleaned.split(/\s+/);
  return (parts[parts.length - 1] ?? 'DOC').replace(/[^a-zA-Z]/g, '') || 'DOC';
}

export async function ensureReferralProfile(
  user: UserInput,
): Promise<{ slug: string; referralCode: string } | null> {
  // ── Fast path: slug + profile + code already exist ────────────────────────
  if (user.referralSlug) {
    const existing = await prisma.physicianProfile.findUnique({
      where:  { slug: user.referralSlug },
      select: { referralCode: true },
    }).catch(() => null);

    if (existing?.referralCode) {
      return { slug: user.referralSlug, referralCode: existing.referralCode };
    }

    // Repair path: slug is stamped on User but profile is missing/incomplete
    try {
      const lastName = parseLastName(user.fullName);
      const gen      = await generateUniqueCode(lastName);
      if (!gen) return null;

      // Use the existing slug but ensure the code doesn't collide
      const repairCode = existing
        ? gen.code            // profile exists but code is null — use generated code
        : gen.code;           // no profile at all — create it

      await prisma.physicianProfile.upsert({
        where:  { slug: user.referralSlug },
        create: {
          slug:         user.referralSlug,
          displayName:  user.fullName ?? 'Physician',
          referralCode: repairCode,
          isActive:     true,
        },
        update: { referralCode: repairCode },
      });

      return { slug: user.referralSlug, referralCode: repairCode };
    } catch {
      return null;
    }
  }

  // ── Slow path: no slug yet — generate slug + code + profile ──────────────
  try {
    const lastName = parseLastName(user.fullName);
    const gen      = await generateUniqueCode(lastName);
    if (!gen) return null;

    await prisma.user.update({
      where: { id: user.id },
      data:  { referralSlug: gen.slug },
    });

    await prisma.physicianProfile.upsert({
      where:  { slug: gen.slug },
      create: {
        slug:         gen.slug,
        displayName:  user.fullName ?? 'Physician',
        referralCode: gen.code,
        isActive:     true,
      },
      update: {
        displayName:  user.fullName ?? 'Physician',
        referralCode: gen.code,
      },
    });

    return { slug: gen.slug, referralCode: gen.code };
  } catch {
    return null;
  }
}
