/**
 * src/lib/guide/renderProteinGuide.ts
 *
 * Presentation for the Protein Guide. Midnight Silk, applied to approved
 * content this module is not permitted to alter.
 *
 * THE DIVISION THIS FILE HONOURS
 * The manuscript is the clinical authority; this file controls appearance only.
 * It therefore contains no patient-facing sentence of its own. Every visible
 * string originates in `proteinGuideContent.ts`, and the only text this module
 * introduces is the document's own footer identity and the numerals of the
 * manuscript's own pagination. If a clinical sentence ever needs to change, it
 * changes in a new approved manuscript — never here.
 *
 * WHY INLINE STYLES RATHER THAN A STYLESHEET
 * This document is delivered as email. Several clients discard <style> blocks
 * outright, so anything load-bearing — colour, contrast, spacing, the amber
 * safety treatment — is inlined on the element itself and survives regardless.
 * The single <style> block carries only progressive enhancement: print rules
 * and a narrow-viewport adjustment. A client that drops it still renders a
 * correct, accessible, non-alarmist document; it simply prints less tidily.
 *
 * WHY A LIGHT READING SURFACE
 * Midnight Silk is the platform's authenticated surface treatment. This asset
 * is eight pages of continuous reading that patients are expected to print, and
 * an inverted body would be both harder to read at length and wasteful to
 * print, since most clients drop background colours when printing and would
 * leave pale text on white paper. The direction is therefore carried by
 * Midnight Navy structure and teal accent against Sanctuary White — the
 * palette's own light ground — which keeps the premium clinical register while
 * staying legible and printable. Navy is used at full strength wherever it
 * carries no text.
 *
 * CONTRAST
 * Teal #2DD4BF is an accent, never body text: against white it measures about
 * 1.8:1 and would fail badly. On the navy cover it rises above 8:1 and is used
 * for text there. Where a teal-family colour must read as text on the light
 * ground, the deeper #0F766E is used instead. Amber follows the same rule — the
 * #F59E0B accent marks an edge, while amber text uses #78350F.
 */

import {
  GUIDE_COVER,
  GUIDE_PAGES,
  type GuideBlock,
} from './proteinGuideContent';

// ── Midnight Silk tokens ─────────────────────────────────────────────────────

const NAVY        = '#0F172A'; // Midnight Navy — structure, never a text ground
const NAVY_SOFT   = '#1E293B'; // headings and body ink on the light ground
const TEAL        = '#2DD4BF'; // accent; text only against navy
const TEAL_DEEP   = '#0F766E'; // the teal that is legible as text on paper
const PAPER       = '#F7F7F5'; // Sanctuary White — the document ground
const CARD        = '#FFFFFF';
const INK         = '#24303F';
const MUTED       = '#4A5567';
const RULE        = '#E4E7EC';
const AMBER_EDGE  = '#F59E0B'; // restrained: the two genuine safety passages
const AMBER_FIELD = '#FFFBEB';
const AMBER_INK   = '#78350F';

const SERIF = "Georgia, 'Iowan Old Style', 'Times New Roman', Times, serif";

/** Escapes text for an HTML text node. Content is trusted; correctness is not optional. */
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * A superscript citation marker.
 *
 * The manuscript attaches these to specific sentences, and the attachment is
 * part of what was clinically reconciled — a marker moved to a different
 * sentence would misattribute a source. It renders after the terminal
 * punctuation, exactly as the manuscript sets it.
 */
const cite = (c?: string): string =>
  c
    ? `<sup style="font-size:11px;line-height:0;color:${TEAL_DEEP};font-family:${SERIF};">${esc(c)}</sup>`
    : '';

// ── Block rendering ──────────────────────────────────────────────────────────

const P_STYLE  = `margin:0 0 16px;font-family:${SERIF};font-size:16px;line-height:1.72;color:${INK};`;
const LI_STYLE = `margin:0 0 9px;font-family:${SERIF};font-size:16px;line-height:1.6;color:${INK};`;

function renderBlock(b: GuideBlock): string {
  switch (b.k) {
    case 'h3':
      return `<h3 style="margin:30px 0 12px;font-family:${SERIF};font-size:18px;line-height:1.35;font-weight:700;color:${NAVY_SOFT};">${esc(b.text)}</h3>`;

    case 'p':
      return `<p style="${P_STYLE}">${esc(b.text)}${cite(b.cite)}</p>`;

    // A sentence the manuscript already uses to close a page. Given weight with
    // a teal rule and a lift in size — no words added, none taken away.
    case 'pull':
      return (
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:26px 0 6px;">` +
        `<tr><td style="border-left:3px solid ${TEAL};padding:4px 0 4px 18px;">` +
        `<p style="margin:0;font-family:${SERIF};font-size:17px;line-height:1.6;color:${NAVY_SOFT};font-style:italic;">${esc(b.text)}</p>` +
        `</td></tr></table>`
      );

    case 'note':
      return `<p style="margin:0 0 10px;font-family:${SERIF};font-size:13.5px;line-height:1.6;color:${MUTED};">${esc(b.text)}</p>`;

    case 'ul':
      return (
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px;">` +
        b.items
          .map(
            it =>
              `<tr>` +
              `<td valign="top" style="width:16px;padding:0 0 9px;font-family:${SERIF};font-size:16px;line-height:1.6;color:${TEAL_DEEP};">&bull;</td>` +
              `<td valign="top" style="padding:0 0 9px;"><span style="${LI_STYLE}display:block;">${esc(it)}</span></td>` +
              `</tr>`,
          )
          .join('') +
        `</table>`
      );

    // ── The amber passages ───────────────────────────────────────────────────
    //
    // Reached only by these three kinds, and used twice in eight pages: the
    // Page 4 symptoms that need clinical attention, and the Page 5 renal
    // checkpoint. The treatment is a field and a left edge — no icon, no
    // exclamation, no red. The manuscript's register is calm, and a patient
    // reading about their own kidneys should not meet a warning triangle.
    case 'alertLead':
      return `<p style="margin:0 0 18px;font-family:${SERIF};font-size:16.5px;line-height:1.6;color:${AMBER_INK};font-weight:700;">${esc(b.text)}</p>`;

    case 'alert':
      return (
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0 6px;background-color:${AMBER_FIELD};border-radius:6px;">` +
        `<tr><td style="border-left:3px solid ${AMBER_EDGE};padding:16px 20px;">` +
        `<p style="margin:0;font-family:${SERIF};font-size:16px;line-height:1.62;color:${AMBER_INK};font-weight:700;">${esc(b.text)}</p>` +
        `</td></tr></table>`
      );

    case 'alertList':
      return (
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;background-color:${AMBER_FIELD};border-radius:6px;">` +
        `<tr><td style="border-left:3px solid ${AMBER_EDGE};padding:16px 20px 8px;">` +
        b.items
          .map(
            it =>
              `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>` +
              `<td valign="top" style="width:16px;padding:0 0 9px;font-family:${SERIF};font-size:16px;line-height:1.6;color:${AMBER_EDGE};">&bull;</td>` +
              `<td valign="top" style="padding:0 0 9px;font-family:${SERIF};font-size:16px;line-height:1.6;color:${AMBER_INK};">${esc(it)}</td>` +
              `</tr></table>`,
          )
          .join('') +
        `</td></tr></table>`
      );

    // The nine references. Set smaller and quieter than body copy, because they
    // are apparatus rather than reading — but present, in full, and never
    // abbreviated: a public clinical claim carries its visible source.
    case 'refs':
      return (
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 0;">` +
        b.items
          .map(
            (it, i) =>
              `<tr>` +
              `<td valign="top" style="width:22px;padding:0 0 10px;font-family:${SERIF};font-size:13px;line-height:1.6;color:${TEAL_DEEP};">${i + 1}.</td>` +
              `<td valign="top" style="padding:0 0 10px;font-family:${SERIF};font-size:13px;line-height:1.6;color:${MUTED};">${esc(it)}</td>` +
              `</tr>`,
          )
          .join('') +
        `</table>`
      );
  }
}

// ── Document ─────────────────────────────────────────────────────────────────

/** Manuscript Page 1, set as a navy cover — the one full-strength navy surface. */
function renderCover(): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="mg-page" style="background-color:${NAVY};border-radius:10px;">` +
    `<tr><td style="padding:52px 40px 44px;">` +
    `<p style="margin:0 0 26px;font-family:${SERIF};font-size:12px;letter-spacing:2.4px;text-transform:uppercase;color:${TEAL};">MyoGuard Protocol</p>` +
    `<h1 style="margin:0 0 14px;font-family:${SERIF};font-size:32px;line-height:1.24;font-weight:700;color:#F8FAFC;">${esc(GUIDE_COVER.title)}</h1>` +
    `<p style="margin:0 0 30px;font-family:${SERIF};font-size:18px;line-height:1.5;color:${TEAL};">${esc(GUIDE_COVER.subtitle)}</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 30px;"><tr><td style="height:1px;background-color:#33415A;line-height:1px;font-size:0;">&nbsp;</td></tr></table>` +
    GUIDE_COVER.lede
      .map(
        l =>
          `<p style="margin:0 0 16px;font-family:${SERIF};font-size:16px;line-height:1.72;color:#CBD5E1;">${esc(l)}</p>`,
      )
      .join('') +
    `<p style="margin:26px 0 0;font-family:${SERIF};font-size:12.5px;line-height:1.6;color:#8C9AB0;">${esc(GUIDE_COVER.footer)}</p>` +
    `</td></tr></table>`
  );
}

/** One manuscript page as a card. The numeral is the manuscript's own pagination. */
function renderPage(p: (typeof GUIDE_PAGES)[number]): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="mg-page" style="margin-top:24px;background-color:${CARD};border:1px solid ${RULE};border-radius:10px;">` +
    `<tr><td class="mg-pad" style="padding:38px 40px 34px;">` +
    `<p style="margin:0 0 6px;font-family:${SERIF};font-size:11px;letter-spacing:2.2px;color:${TEAL_DEEP};">${p.n < 10 ? '0' : ''}${p.n}</p>` +
    `<h2 style="margin:0 0 8px;font-family:${SERIF};font-size:25px;line-height:1.3;font-weight:700;color:${NAVY};">${esc(p.title)}</h2>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td width="52" style="height:2px;background-color:${TEAL};line-height:2px;font-size:0;">&nbsp;</td></tr></table>` +
    p.blocks.map(renderBlock).join('') +
    `</td></tr></table>`
  );
}

/**
 * Renders the complete Guide.
 *
 * Takes no arguments, and must not grow any: the Guide is one fixed document
 * sent to everyone who asks. Nothing recipient-supplied reaches this body, so
 * the delivery pathway cannot be used to render attacker-controlled text into
 * mail from the MyoGuard domain.
 */
export function renderProteinGuideHtml(): string {
  return (
    `<!DOCTYPE html>` +
    `<html lang="en"><head>` +
    `<meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="color-scheme" content="light only">` +
    `<meta name="supported-color-schemes" content="light only">` +
    `<title>${esc(GUIDE_COVER.title)}</title>` +
    // Enhancement only. Everything load-bearing is inlined above.
    `<style>` +
    `@media only screen and (max-width:620px){` +
    `.mg-pad{padding:28px 22px 24px!important}` +
    `.mg-shell{padding:16px 12px!important}` +
    `}` +
    // Printing is a first-class outcome: patients are expected to take this to
    // an appointment. One manuscript page per sheet, no card chrome, no shadow.
    `@media print{` +
    `body{background:#fff!important}` +
    `.mg-shell{padding:0!important}` +
    `.mg-page{margin-top:0!important;border:0!important;border-radius:0!important;page-break-after:always;break-after:page}` +
    `.mg-page:last-of-type{page-break-after:auto;break-after:auto}` +
    `}` +
    `</style>` +
    `</head>` +
    `<body style="margin:0;padding:0;background-color:${PAPER};">` +
    // Preheader: the manuscript's own subtitle, so the inbox preview is approved
    // content rather than a line written for the inbox.
    `<div style="display:none;font-size:1px;color:${PAPER};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(GUIDE_COVER.subtitle)}</div>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${PAPER};">` +
    `<tr><td align="center" class="mg-shell" style="padding:28px 16px 40px;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="660" style="width:100%;max-width:660px;">` +
    `<tr><td>` +
    renderCover() +
    GUIDE_PAGES.map(renderPage).join('') +
    // Document identity. Not clinical content, and deliberately not marketing:
    // no call to action, no link, nothing to click.
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:26px;">` +
    `<tr><td align="center" style="padding:4px 12px;">` +
    `<p style="margin:0;font-family:${SERIF};font-size:12px;line-height:1.6;color:${MUTED};">&copy; 2026 Meridian Wellness Systems LLC &middot; myoguard.health</p>` +
    `</td></tr></table>` +
    `</td></tr></table>` +
    `</td></tr></table>` +
    `</body></html>`
  );
}
