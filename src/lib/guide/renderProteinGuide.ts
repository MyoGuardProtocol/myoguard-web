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
 * MIDNIGHT SILK ON EVERY PAGE
 * All eight pages share one surface: Midnight Navy ground, warm off-white body,
 * teal as the principal accent. An earlier revision set the cover in navy and
 * the internal pages on a light ground, which read as two documents stapled
 * together; the Founder's C3F-3C visual decision unified them. The cover is now
 * distinguished by scale and air rather than by a different colour system.
 *
 * READABILITY OVERRIDES BRAND PURITY — the explicit instruction, and the reason
 * body copy is cream #F0EBE1 rather than teal or pure white: warmer and less
 * harsh than #FFFFFF over eight pages, without giving up any contrast. Teal
 * marks structure — headings, rules, bullets, citation markers — and never
 * carries a paragraph.
 *
 * CONTRAST, measured against the surface each colour actually sits on:
 *
 *   body cream #F0EBE1 on navy ............ 15.0:1
 *   cover lede #D9D3C7 on navy ............ 12.0:1
 *   teal #2DD4BF on navy ................... 9.6:1
 *   muted #ABA599 on navy .................. 7.3:1
 *   amber text #FBDCA7 on amber field ..... 12.8:1
 *
 * Every one clears WCAG AAA for body text. The lowest is the reference
 * apparatus, which is the only copy meant to recede; the safety passages are
 * deliberately among the highest.
 *
 * PRINTING A DARK DOCUMENT
 * The Founder accepted the trade-off. The risk it carries is specific: browsers
 * drop background colours when printing by default, which would leave cream
 * text on white paper — invisible. `print-color-adjust: exact` is what prevents
 * that, and it is declared in the style block rather than inline because
 * printing only happens where a stylesheet is present. See the note there.
 */

import {
  GUIDE_COVER,
  GUIDE_PAGES,
  type GuideBlock,
} from './proteinGuideContent';

// ── Midnight Silk tokens ─────────────────────────────────────────────────────

const SHELL       = '#080C14'; // the ground the document sits on
const PAGE        = '#0F172A'; // Midnight Navy — every page surface, cover included
const PAGE_EDGE   = '#1E2B44'; // restrained rule; separates page from ground
const TEAL        = '#2DD4BF'; // principal accent — headings, rules, bullets, markers
const CREAM       = '#F0EBE1'; // warm off-white; long-form body text
const CREAM_SOFT  = '#D9D3C7'; // the cover lede, one step back from body
const MUTED       = '#ABA599'; // apparatus — references, notes, footer
const AMBER_EDGE  = '#F59E0B'; // restrained: the two genuine safety passages
const AMBER_FIELD = '#261B0E'; // amber as a deep warm field, not a bright panel
const AMBER_INK   = '#FBDCA7';

const SERIF = "Georgia, 'Iowan Old Style', 'Times New Roman', Times, serif";

// ── Print pagination, inlined ────────────────────────────────────────────────
//
// These properties exist only in paged media. A browser ignores them on screen,
// so inlining them changes nothing about the Midnight Silk presentation — and
// inlining is the only way they survive, because Gmail discards the <style>
// block outright. Measured: the document prints to 12 sheets with the style
// block stripped and 16 with it applied, against 8 conceptual pages.
//
// `KEEP_TOGETHER` stops a callout or a safety panel being sliced across the
// fold; `KEEP_WITH_NEXT` stops a heading stranding itself at the foot of a
// sheet. Both are free in sheet count — measured at 12 sheets with and without
// them in the style-stripped path — so they are safe to inline everywhere.
//
// A forced page break per manuscript page is NOT inlined, and that is a
// measured decision rather than an oversight. Inlined, it starts each page on a
// fresh sheet but cannot also shrink the body text, so every page then overflows
// and the style-stripped document goes from 12 sheets to 16. The break only pays
// for itself alongside the print sizing in the stylesheet below, so that is
// where it lives.
const KEEP_TOGETHER  = 'page-break-inside:avoid;break-inside:avoid;';
const KEEP_WITH_NEXT = 'page-break-after:avoid;break-after:avoid;';

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
    ? `<sup style="font-size:11px;line-height:0;color:${TEAL};font-family:${SERIF};">${esc(c)}</sup>`
    : '';

// ── Block rendering ──────────────────────────────────────────────────────────
//
// Body copy is cream, never teal. Eight pages of continuous reading set in an
// accent colour would be exhausting on a dark ground, and teal's job here is to
// mark structure — headings, rules, bullets, citation markers — not to carry
// paragraphs. Line height is a touch looser than the light-ground setting was,
// because light text on a dark field blooms slightly and needs the room.

const P_STYLE  = `margin:0 0 17px;font-family:${SERIF};font-size:16px;line-height:1.78;color:${CREAM};`;
const LI_STYLE = `margin:0 0 9px;font-family:${SERIF};font-size:16px;line-height:1.66;color:${CREAM};`;

function renderBlock(b: GuideBlock): string {
  switch (b.k) {
    case 'h3':
      return `<h3 style="${KEEP_WITH_NEXT}margin:32px 0 12px;font-family:${SERIF};font-size:18px;line-height:1.35;font-weight:700;color:${TEAL};">${esc(b.text)}</h3>`;

    case 'p':
      return `<p style="${P_STYLE}">${esc(b.text)}${cite(b.cite)}</p>`;

    // A sentence the manuscript already uses to close a page. Given weight with
    // a teal rule and a lift in size — no words added, none taken away.
    case 'pull':
      return (
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="${KEEP_TOGETHER}margin:26px 0 6px;">` +
        `<tr><td style="border-left:3px solid ${TEAL};padding:4px 0 4px 18px;">` +
        `<p style="margin:0;font-family:${SERIF};font-size:17px;line-height:1.66;color:${CREAM};font-style:italic;">${esc(b.text)}</p>` +
        `</td></tr></table>`
      );

    case 'note':
      return `<p style="margin:0 0 10px;font-family:${SERIF};font-size:13.5px;line-height:1.62;color:${MUTED};">${esc(b.text)}</p>`;

    case 'ul':
      return (
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px;">` +
        b.items
          .map(
            it =>
              `<tr>` +
              `<td valign="top" style="width:16px;padding:0 0 9px;font-family:${SERIF};font-size:16px;line-height:1.66;color:${TEAL};">&bull;</td>` +
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
    //
    // On a dark ground the panel is a deep warm field rather than a bright one:
    // a pale amber block would glare against Midnight Navy and read as an alarm.
    // The hierarchy is carried by warmth and the amber edge, and the text is a
    // light amber that holds roughly 9:1 against its own field, so the safety
    // material is the most readable copy in the document rather than the least.
    case 'alertLead':
      return `<p style="margin:0 0 18px;font-family:${SERIF};font-size:16.5px;line-height:1.6;color:${AMBER_INK};font-weight:700;">${esc(b.text)}</p>`;

    case 'alert':
      return (
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="mg-amber" style="${KEEP_TOGETHER}margin:24px 0 6px;background-color:${AMBER_FIELD};border-radius:6px;">` +
        `<tr><td style="border-left:3px solid ${AMBER_EDGE};padding:16px 20px;">` +
        `<p style="margin:0;font-family:${SERIF};font-size:16px;line-height:1.62;color:${AMBER_INK};font-weight:700;">${esc(b.text)}</p>` +
        `</td></tr></table>`
      );

    case 'alertList':
      return (
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="mg-amber" style="${KEEP_TOGETHER}margin:0 0 20px;background-color:${AMBER_FIELD};border-radius:6px;">` +
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
              `<td valign="top" style="width:22px;padding:0 0 10px;font-family:${SERIF};font-size:13px;line-height:1.6;color:${TEAL};">${i + 1}.</td>` +
              `<td valign="top" style="padding:0 0 10px;font-family:${SERIF};font-size:13px;line-height:1.6;color:${MUTED};">${esc(it)}</td>` +
              `</tr>`,
          )
          .join('') +
        `</table>`
      );
  }
}

// ── Document ─────────────────────────────────────────────────────────────────

/**
 * Manuscript Page 1.
 *
 * The cover is the same surface as every other page — same navy, same edge,
 * same eyebrow. What distinguishes it is scale and air, not a different colour
 * system: it is the opening page of one document, not a jacket wrapped around
 * a different one.
 */
function renderCover(): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="mg-page" style="background-color:${PAGE};border:1px solid ${PAGE_EDGE};border-radius:10px;">` +
    `<tr><td class="mg-pad" style="padding:56px 40px 48px;">` +
    `<p style="margin:0 0 28px;font-family:${SERIF};font-size:11px;letter-spacing:2.4px;text-transform:uppercase;color:${TEAL};">MyoGuard Protocol</p>` +
    `<h1 style="margin:0 0 14px;font-family:${SERIF};font-size:33px;line-height:1.24;font-weight:700;color:${CREAM};">${esc(GUIDE_COVER.title)}</h1>` +
    `<p style="margin:0 0 32px;font-family:${SERIF};font-size:18px;line-height:1.5;color:${TEAL};">${esc(GUIDE_COVER.subtitle)}</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 32px;"><tr><td style="height:1px;background-color:${PAGE_EDGE};line-height:1px;font-size:0;">&nbsp;</td></tr></table>` +
    GUIDE_COVER.lede
      .map(
        l =>
          `<p style="margin:0 0 16px;font-family:${SERIF};font-size:16px;line-height:1.78;color:${CREAM_SOFT};">${esc(l)}</p>`,
      )
      .join('') +
    `<p style="margin:28px 0 0;font-family:${SERIF};font-size:12.5px;line-height:1.6;color:${MUTED};">${esc(GUIDE_COVER.footer)}</p>` +
    `</td></tr></table>`
  );
}

/**
 * One manuscript page.
 *
 * Identical treatment to the cover — the numeral and the teal rule are the only
 * furniture, and the numeral is the manuscript's own pagination rather than
 * anything this phase invented.
 */
function renderPage(p: (typeof GUIDE_PAGES)[number]): string {
  // The final page is marked explicitly rather than left to `:last-of-type`,
  // which does not match it: the document footer is a later table sibling, so
  // the selector found nothing and page 8 took a break of its own, pushing the
  // footer onto an extra sheet.
  const last = p.n === GUIDE_PAGES[GUIDE_PAGES.length - 1].n ? ' mg-page-last' : '';
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="mg-page${last}" style="margin-top:22px;background-color:${PAGE};border:1px solid ${PAGE_EDGE};border-radius:10px;">` +
    `<tr><td class="mg-pad" style="padding:42px 40px 38px;">` +
    `<p style="margin:0 0 7px;font-family:${SERIF};font-size:11px;letter-spacing:2.4px;color:${TEAL};">${p.n < 10 ? '0' : ''}${p.n}</p>` +
    `<h2 style="${KEEP_WITH_NEXT}margin:0 0 10px;font-family:${SERIF};font-size:26px;line-height:1.3;font-weight:700;color:${CREAM};">${esc(p.title)}</h2>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;"><tr><td width="52" style="height:2px;background-color:${TEAL};line-height:2px;font-size:0;">&nbsp;</td></tr></table>` +
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
    // The document is dark by design. Declaring that stops the mail clients
    // which auto-invert light mail from inverting this into something neither
    // approved nor legible.
    `<meta name="color-scheme" content="dark">` +
    `<meta name="supported-color-schemes" content="dark">` +
    `<title>${esc(GUIDE_COVER.title)}</title>` +
    // Enhancement only. Everything load-bearing is inlined above.
    `<style>` +
    `@media only screen and (max-width:620px){` +
    `.mg-pad{padding:30px 22px 26px!important}` +
    `.mg-shell{padding:14px 10px!important}` +
    `}` +
    // ── Clinical Parchment: the approved printed form ────────────────────────
    //
    // Printing is a first-class outcome — patients take this to an appointment.
    // An earlier revision forced the navy onto paper with print-color-adjust.
    // Gmail discards this block, converts the document to a light sheet of its
    // own accord, and that is the treatment the Founder reviewed and approved.
    // So this block now produces the same thing rather than fighting it, and a
    // browser print matches what Gmail already produces.
    //
    // Every rule needs !important: the document's colours are inlined, and an
    // inline style outranks a stylesheet. Cream body text left unconverted
    // would print white-on-white, which is why the text rules come first and
    // the amber panels — dark field, light text — are converted as a unit.
    `@page{margin:12mm 12mm}` +
    `@media print{` +
    `html,body{background:#FFFFFF!important}` +
    `.mg-shell{padding:0!important}` +
    `.mg-page{background:#FFFFFF!important;border:0!important;border-radius:0!important;margin-top:0!important;page-break-after:always;break-after:page}` +
    `.mg-page-last{page-break-after:auto!important;break-after:auto!important}` +
    `.mg-pad{padding:0 0 4mm!important}` +
    `.mg-page p,.mg-page span,.mg-page td,.mg-page li{color:#1F2937!important}` +
    // Paper reads smaller than a screen. 10.5pt with 1.45 leading is ordinary
    // clinical-handout body size — comfortably readable, and what brings each
    // manuscript page inside a single sheet. Anything below 10pt would be
    // buying pagination with legibility, which the brief rules out.
    `.mg-page p,.mg-page span,.mg-page td,.mg-page li{font-size:10.5pt!important;line-height:1.45!important}` +
    `.mg-page p{margin:0 0 5pt!important}` +
    // The list cells and the safety panels carry screen-scale padding. Left
    // alone they are what pushes the two dense pages — the everyday foods and
    // the safety checkpoint — over the fold.
    `.mg-page tr>td[valign=top]{padding-bottom:3pt!important}` +
    `.mg-amber td{padding:8pt 11pt!important}` +
    `.mg-page h1{font-size:19pt!important;margin:0 0 6pt!important}` +
    `.mg-page h2{font-size:14pt!important;margin:0 0 5pt!important}` +
    `.mg-page h3{font-size:11.5pt!important;margin:9pt 0 3pt!important}` +
    `.mg-page sup{font-size:7.5pt!important}` +
    `.mg-page h1,.mg-page h2{color:#0F172A!important}` +
    `.mg-page h3,.mg-page sup{color:#0F766E!important}` +
    `.mg-amber{background-color:#FFF8E7!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}` +
    `.mg-amber td,.mg-amber p{color:#78350F!important}` +
    `.mg-foot p{color:#6B7280!important}` +
    `}` +
    `</style>` +
    `</head>` +
    `<body style="margin:0;padding:0;background-color:${SHELL};">` +
    // Preheader: the manuscript's own subtitle, so the inbox preview is approved
    // content rather than a line written for the inbox.
    `<div style="display:none;font-size:1px;color:${SHELL};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(GUIDE_COVER.subtitle)}</div>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${SHELL};">` +
    `<tr><td align="center" class="mg-shell" style="padding:28px 16px 40px;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="660" style="width:100%;max-width:660px;">` +
    `<tr><td>` +
    renderCover() +
    GUIDE_PAGES.map(renderPage).join('') +
    // Document identity. Not clinical content, and deliberately not marketing:
    // no call to action, no link, nothing to click.
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:24px;">` +
    `<tr><td align="center" class="mg-foot" style="padding:4px 12px;">` +
    `<p style="margin:0;font-family:${SERIF};font-size:12px;line-height:1.6;color:${MUTED};">&copy; 2026 Meridian Wellness Systems LLC &middot; myoguard.health</p>` +
    `</td></tr></table>` +
    `</td></tr></table>` +
    `</td></tr></table>` +
    `</body></html>`
  );
}
