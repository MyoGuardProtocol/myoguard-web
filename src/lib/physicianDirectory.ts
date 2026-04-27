/**
 * physicianDirectory.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Static mapping of referral codes → physician info.
 *
 * The API route checks the database first (for fully onboarded physicians),
 * then falls back to this directory. This allows referral links to work
 * immediately without requiring a database record.
 *
 * To add a new physician:
 *   1. Add an entry here keyed by their referral slug.
 *   2. Share the link: myoguard.health/?ref=<slug>
 *   3. Optionally create a PhysicianProfile row in the database
 *      (the DB record will take precedence once it exists).
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type DirectoryEntry = {
  slug:        string;
  displayName: string;
  clinicName:  string | null;
  specialty:   string | null;
};

export const PHYSICIAN_DIRECTORY: Record<string, DirectoryEntry> = {
  'dr-b': {
    slug:        'dr-b',
    displayName: 'MyoGuard Protocol · Clinical Decision Support System',
    clinicName:  null,
    specialty:   'GLP-1 & Metabolic Medicine',
  },
  'dr-james': {
    slug:        'dr-james',
    displayName: 'Dr. James Patel, MD',
    clinicName:  null,
    specialty:   null,
  },
};
