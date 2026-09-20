/**
 * src/lib/share/shareNotice.ts
 *
 * What the patient is told before they generate a share link, and the version
 * stamp recorded alongside their action.
 *
 * Deliberately free of imports. The client component that displays this text
 * and the server route that records the acknowledgement both read it from
 * here, so the wording shown and the wording recorded cannot drift apart. A
 * module that pulled in Prisma could not be imported by the client.
 *
 * The text is the Founder's C3F/1D-R1 doctrine wording. It says what the link
 * does, how long it lasts and that it can be withdrawn — three facts, no
 * legalese and nothing persuasive. If it changes materially, bump the version
 * so existing evidence still records which wording was actually shown.
 */

export const SHARE_NOTICE_VERSION = '1.0';

export const SHARE_NOTICE_TEXT =
  'This link allows someone you share it with to view your MyoGuard information. ' +
  'It expires after 30 days. You can revoke it at any time.';

/** Days a newly minted share link remains valid. Absolute — never extended. */
export const SHARE_LINK_TTL_DAYS = 30;
