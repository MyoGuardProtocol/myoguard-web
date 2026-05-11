/**
 * src/lib/research/logger.ts
 *
 * Structured console-safe logger for the MyoGuard Protocol observational study domain.
 *
 * LAYER: Shared Research Infrastructure.
 * This module has no UI surface, no API routes, and no PostHog calls.
 * No external logging provider dependency — output goes to console only.
 *
 * Governance mandates enforced by this logger:
 *   (1) PHI fields are never written to any log output.
 *       Any key matching PHI_FIELDS in a context object is replaced with [REDACTED].
 *   (2) PHI values are never inspected or compared — only key names are checked.
 *   (3) Log entries include namespace prefix, severity, and structured context.
 *   (4) assessmentId, enrollmentId, studyId are safe to log (non-identifiable).
 *       patientId, userId, clerkId, email, fullName must never appear in logs.
 *
 * Usage:
 *   import { researchLogger } from './logger';
 *   researchLogger.error('snapshot', 'Snapshot creation failed', { assessmentId, cause });
 */

import { PHI_FIELDS } from './deidentify';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Namespaces correspond to the subsystem where the log event originates.
 * Use the most specific namespace available.
 */
export type ResearchLogNamespace =
  | 'snapshot'      // AssessmentSnapshot creation and failure
  | 'export'        // CSV export pipeline
  | 'enrollment'    // Study enrollment guard failures
  | 'phi'           // PHI violation detection
  | 'consent'       // Consent gate failures
  | 'longitudinal'  // Trajectory computation and cohort processing
  | 'study';        // Study creation and lifecycle events

export type ResearchLogSeverity = 'info' | 'warn' | 'error';

/** Safe context object — no PHI values. Keys matching PHI_FIELDS are redacted before output. */
export type ResearchLogContext = Record<string, unknown>;

// ─── PHI Scrubbing ────────────────────────────────────────────────────────────

/**
 * Returns a copy of the context object with all PHI field keys replaced by [REDACTED].
 * The original value is never read or compared — only the key name is checked.
 * This is a defensive measure; callers should never pass PHI values in the first place.
 */
function scrubContext(context: ResearchLogContext): ResearchLogContext {
  const clean: ResearchLogContext = {};
  for (const [key, value] of Object.entries(context)) {
    if ((PHI_FIELDS as readonly string[]).includes(key)) {
      clean[key] = '[REDACTED]';
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

// ─── Formatter ────────────────────────────────────────────────────────────────

function formatEntry(
  severity: ResearchLogSeverity,
  namespace: ResearchLogNamespace,
  message: string,
  context?: ResearchLogContext,
  err?: unknown,
): string {
  const tag = `[research:${namespace}]`;
  const parts: string[] = [`${tag} ${message}`];

  if (context && Object.keys(context).length > 0) {
    const safe = scrubContext(context);
    parts.push(JSON.stringify(safe));
  }

  if (err !== undefined) {
    const errMessage = err instanceof Error ? err.message : String(err);
    parts.push(`error="${errMessage}"`);
  }

  return parts.join(' — ');
}

// ─── Logger ───────────────────────────────────────────────────────────────────

export interface ResearchLogger {
  info(namespace: ResearchLogNamespace, message: string, context?: ResearchLogContext): void;
  warn(namespace: ResearchLogNamespace, message: string, context?: ResearchLogContext, err?: unknown): void;
  error(namespace: ResearchLogNamespace, message: string, context?: ResearchLogContext, err?: unknown): void;
}

const logger: ResearchLogger = {
  info(namespace, message, context) {
    console.info(formatEntry('info', namespace, message, context));
  },

  warn(namespace, message, context, err) {
    console.warn(formatEntry('warn', namespace, message, context, err));
  },

  error(namespace, message, context, err) {
    console.error(formatEntry('error', namespace, message, context, err));
  },
};

export const researchLogger: ResearchLogger = logger;

// ─── Convenience Wrappers ─────────────────────────────────────────────────────
// Pre-namespaced helpers reduce boilerplate in service modules.

export const snapshotLogger = {
  info: (msg: string, ctx?: ResearchLogContext) => logger.info('snapshot', msg, ctx),
  warn: (msg: string, ctx?: ResearchLogContext, err?: unknown) => logger.warn('snapshot', msg, ctx, err),
  error: (msg: string, ctx?: ResearchLogContext, err?: unknown) => logger.error('snapshot', msg, ctx, err),
};

export const exportLogger = {
  info: (msg: string, ctx?: ResearchLogContext) => logger.info('export', msg, ctx),
  warn: (msg: string, ctx?: ResearchLogContext, err?: unknown) => logger.warn('export', msg, ctx, err),
  error: (msg: string, ctx?: ResearchLogContext, err?: unknown) => logger.error('export', msg, ctx, err),
};

export const enrollmentLogger = {
  info: (msg: string, ctx?: ResearchLogContext) => logger.info('enrollment', msg, ctx),
  warn: (msg: string, ctx?: ResearchLogContext, err?: unknown) => logger.warn('enrollment', msg, ctx, err),
  error: (msg: string, ctx?: ResearchLogContext, err?: unknown) => logger.error('enrollment', msg, ctx, err),
};

export const phiLogger = {
  warn: (msg: string, ctx?: ResearchLogContext, err?: unknown) => logger.warn('phi', msg, ctx, err),
  error: (msg: string, ctx?: ResearchLogContext, err?: unknown) => logger.error('phi', msg, ctx, err),
};

export const consentLogger = {
  info: (msg: string, ctx?: ResearchLogContext) => logger.info('consent', msg, ctx),
  warn: (msg: string, ctx?: ResearchLogContext, err?: unknown) => logger.warn('consent', msg, ctx, err),
  error: (msg: string, ctx?: ResearchLogContext, err?: unknown) => logger.error('consent', msg, ctx, err),
};

export const longitudinalLogger = {
  info: (msg: string, ctx?: ResearchLogContext) => logger.info('longitudinal', msg, ctx),
  warn: (msg: string, ctx?: ResearchLogContext, err?: unknown) => logger.warn('longitudinal', msg, ctx, err),
  error: (msg: string, ctx?: ResearchLogContext, err?: unknown) => logger.error('longitudinal', msg, ctx, err),
};
