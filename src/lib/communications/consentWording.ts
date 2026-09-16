/**
 * src/lib/communications/consentWording.ts
 *
 * The canonical text a recipient sees when they subscribe, and its version.
 *
 * WHY THE TEXT LIVES IN CODE AND THE ROW IS CREATED LAZILY
 * The wording is the evidence. It must be reviewable, diffable and attributable
 * to a commit, so code is its home. The database row exists to be pointed at by
 * CommunicationConsentEvent.wordingId, and is created the first time someone
 * actually consents — not at deploy.
 *
 * That choice is deliberate: a deploy-time seed would write to production for a
 * consent nobody has given yet, and this programme's releases create no rows.
 * Lazy creation is idempotent because C3A put a unique constraint on
 * (surface, version) — concurrent first-consents converge on one row rather
 * than racing.
 *
 * CHANGING THE WORDING
 * Never edit a registered wording's `text` in place once it has been used. Bump
 * `version` and leave the old text alone. Historical evidence must keep saying
 * what the person actually read; ConsentWording rows carry ON DELETE RESTRICT
 * from the consent ledger precisely so a referenced version cannot vanish.
 *
 * WHY THIS IS A REGISTRY RATHER THAN ONE CONSTANT (Phase 1D-C3F-1A)
 * C3A shaped ConsentWording as (surface, version) from the start, but resolution
 * was written against a single hardcoded surface because only one existed. A
 * second capture surface cannot be added without either editing the resolver or
 * passing it text from the call site — and a call site that supplies its own
 * wording is a call site that can supply the wrong wording.
 *
 * So surfaces are declared here, once, and resolved by name. The registry is the
 * allowlist: a surface that is not declared cannot be resolved, which is how an
 * unwritten consent surface stays unusable rather than silently resolving
 * someone else's text. This phase adds the capability and no new surface.
 *
 * The copy is factual and makes no legal or regulatory claim.
 */

export const CLINICAL_CONTINUITY_SURFACE = 'settings_clinical_continuity';

/** One surface's wording at one version. `text` is verbatim, as presented. */
export type ConsentWordingEntry = {
  readonly surface:       string;
  readonly version:       string;
  readonly text:          string;
  readonly effectiveFrom: Date;
};

export const CLINICAL_CONTINUITY_WORDING = {
  surface: CLINICAL_CONTINUITY_SURFACE,
  version: '1.0',
  text:
    'I would like to receive MyoGuard clinical continuity emails at my verified ' +
    'email address. These include the Weekly Pulse check-in reminder and the ' +
    'monthly Longitudinal Summary of my recorded protocol data. They are sent on ' +
    'a fixed schedule and may be stopped at any time from this page or from the ' +
    'unsubscribe link in any of these emails. Stopping them does not affect ' +
    'account, security, requested report, or physician workflow messages.',
  effectiveFrom: new Date('2026-09-15T00:00:00.000Z'),
} as const;

/**
 * Retained name for the clinical continuity wording.
 *
 * The settings surface renders `CURRENT_WORDING.text`. Kept as an alias rather
 * than renamed: this phase changes no existing behaviour, and a rename here
 * would edit a page this phase is not authorised to touch.
 */
export const CURRENT_WORDING = CLINICAL_CONTINUITY_WORDING;

/**
 * Every consent surface this build can record consent against.
 *
 * Adding a surface is a deliberate act: declare it here with its own
 * independently bumped version. Nothing resolves by accident, because nothing
 * outside this object resolves at all.
 *
 * NOT DECLARED YET — Protein Guide EDUCATIONAL capture. No approved wording
 * exists in this repository, so the surface is absent rather than stubbed. An
 * empty or placeholder text would be attributable evidence of a consent nobody
 * could have read. See C3F-1A: CONSENT WORDING REQUIRED BEFORE PUBLIC
 * ACTIVATION.
 */
const WORDING_REGISTRY: Readonly<Record<string, ConsentWordingEntry>> = {
  [CLINICAL_CONTINUITY_SURFACE]: CLINICAL_CONTINUITY_WORDING,
};

/**
 * Returns the declared wording for a surface, or null if none is declared.
 *
 * `hasOwnProperty`, not a bare index: a bare lookup would let 'constructor' or
 * '__proto__' return an inherited object that is not wording at all. The
 * surface check that follows is the second half of the same guarantee — a
 * misfiled entry cannot answer for a surface it does not name.
 */
export function wordingForSurface(surface: string): ConsentWordingEntry | null {
  if (!Object.prototype.hasOwnProperty.call(WORDING_REGISTRY, surface)) return null;

  const entry = WORDING_REGISTRY[surface];
  return entry && entry.surface === surface ? entry : null;
}

/** Surfaces declared in this build. Order is not meaningful. */
export function declaredSurfaces(): string[] {
  return Object.keys(WORDING_REGISTRY);
}

/**
 * Returns the id of a surface's current wording row, creating it on first use.
 *
 * Returns null on failure rather than throwing: the caller must refuse to
 * record consent it cannot attach evidence to, and an unattributable GRANT is
 * worse than a failed one. An undeclared surface is one such failure — it is
 * not an error condition to recover from, it is a surface that may not yet
 * capture consent.
 */
export async function resolveWordingIdForSurface(
  surface: string,
): Promise<string | null> {
  const wording = wordingForSurface(surface);
  if (!wording) {
    console.error(
      `[comms/wording] no consent wording declared for surface=${surface} — refusing to resolve`,
    );
    return null;
  }

  try {
    const { prisma } = await import('@/src/lib/prisma');

    const existing = await prisma.consentWording.findUnique({
      where: {
        surface_version: { surface: wording.surface, version: wording.version },
      },
      select: { id: true },
    });
    if (existing) return existing.id;

    const created = await prisma.consentWording.create({
      data: {
        surface:       wording.surface,
        version:       wording.version,
        text:          wording.text,
        effectiveFrom: wording.effectiveFrom,
      },
      select: { id: true },
    });
    return created.id;
  } catch (err) {
    // Includes the unique-constraint race: two first-consents at once. Re-read
    // rather than treating it as a failure.
    try {
      const { prisma } = await import('@/src/lib/prisma');
      const row = await prisma.consentWording.findUnique({
        where: {
          surface_version: { surface: wording.surface, version: wording.version },
        },
        select: { id: true },
      });
      if (row) return row.id;
    } catch { /* fall through to the failure below */ }

    console.error(
      '[comms/wording] could not resolve consent wording:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/**
 * Resolves the clinical continuity wording.
 *
 * Unchanged signature and unchanged behaviour: the authenticated preference
 * surface calls this with no argument and must keep resolving exactly the text
 * it resolved before this phase.
 */
export async function resolveCurrentWordingId(): Promise<string | null> {
  return resolveWordingIdForSurface(CLINICAL_CONTINUITY_SURFACE);
}
