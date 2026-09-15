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
 * Never edit CURRENT_WORDING.text in place once it has been used. Bump
 * `version` and leave the old text alone. Historical evidence must keep saying
 * what the person actually read; ConsentWording rows carry ON DELETE RESTRICT
 * from the consent ledger precisely so a referenced version cannot vanish.
 *
 * The copy is factual and makes no legal or regulatory claim.
 */

export const CLINICAL_CONTINUITY_SURFACE = 'settings_clinical_continuity';

export const CURRENT_WORDING = {
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
 * Returns the id of the current wording row, creating it on first use.
 *
 * Returns null on failure rather than throwing: the caller must refuse to
 * record consent it cannot attach evidence to, and an unattributable GRANT is
 * worse than a failed one.
 */
export async function resolveCurrentWordingId(): Promise<string | null> {
  try {
    const { prisma } = await import('@/src/lib/prisma');

    const existing = await prisma.consentWording.findUnique({
      where: {
        surface_version: {
          surface: CURRENT_WORDING.surface,
          version: CURRENT_WORDING.version,
        },
      },
      select: { id: true },
    });
    if (existing) return existing.id;

    const created = await prisma.consentWording.create({
      data: {
        surface:       CURRENT_WORDING.surface,
        version:       CURRENT_WORDING.version,
        text:          CURRENT_WORDING.text,
        effectiveFrom: CURRENT_WORDING.effectiveFrom,
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
          surface_version: {
            surface: CURRENT_WORDING.surface,
            version: CURRENT_WORDING.version,
          },
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
