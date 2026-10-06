import { z } from "zod";
import { isAcceptedWeight, WEIGHT_KG_RANGE } from "@/src/lib/units/weight";

// ─── Assessment intake (mirrors AssessmentInput from protocolEngine) ──────────

export const AssessmentInputSchema = z.object({
  weight:        z.string().min(1, "Weight is required"),
  unit:          z.enum(["kg", "lbs"]),
  medication:    z.enum(["semaglutide", "tirzepatide"]),
  doseMg:        z.number().positive("Dose must be a positive number"),
  activityLevel: z.enum(["sedentary", "moderate", "active"]),
  symptoms:      z.array(z.string()),
  // ── Recovery & Sleep (optional — section C of the form) ─────────────────
  sleepHours:    z.number().min(0).max(14).optional(),
  sleepQuality:  z.number().int().min(1).max(5).optional(),
  // ── GLP-1 context (optional — unlocks stage multiplier and grip triage) ──
  glp1Stage:     z.enum(['INITIATION', 'DOSE_ESCALATION', 'MAINTENANCE', 'DISCONTINUATION']).optional(),
  gripStrengthKg: z.number().positive().optional(),
  exerciseDaysWk: z.number().int().min(0).max(7).optional(),
})
// Protein Clinical Integrity P0 containment (PROT-UNIT-002): weight was only
// checked as non-empty text. It must now be a number that, in kilograms, falls in
// the range the assessment forms already enforce. No new limit is introduced.
.refine(
  d => isAcceptedWeight(d.weight, d.unit),
  { message: `Weight must be between ${WEIGHT_KG_RANGE.min} and ${WEIGHT_KG_RANGE.max} kg`, path: ['weight'] },
);

export type AssessmentInputSchema = z.infer<typeof AssessmentInputSchema>;

// ─── Email capture ────────────────────────────────────────────────────────────

export const EmailCaptureSchema = z.object({
  email: z.string().email("Invalid email address"),
  protocolResult: z.object({
    weightKg: z.number(),
    proteinStandard: z.number(),
    proteinAggressive: z.number(),
    fiber: z.number(),
    hydration: z.number(),
    myoguardScore: z.number(),
    riskBand: z.enum(["LOW", "MODERATE", "HIGH", "CRITICAL"]),
    leanLossEstPct: z.number(),
    explanation: z.string(),
  }),
  formData: z.object({
    medication: z.string(),
    doseMg: z.number(),
    // Same finite domain as AssessmentInputSchema.activityLevel above — this
    // field is rendered into the protocol email, and /api/email-capture is a
    // public unauthenticated route, so the loose z.string() let an arbitrary
    // caller put any text into the generated HTML. Constrained to the values
    // the form actually produces; no new category is introduced here.
    activityLevel: z.enum(["sedentary", "moderate", "active"]),
    symptoms: z.array(z.string()),
    referralSlug: z.string().optional(),
  }),
});

export type EmailCaptureSchema = z.infer<typeof EmailCaptureSchema>;

// ─── Weekly check-in ─────────────────────────────────────────────────────────

export const CheckinSchema = z.object({
  avgWeightKg:   z.number().positive().optional(),
  avgProteinG:   z.number().min(0).optional(),
  totalWorkouts: z.number().int().min(0).max(21).optional(),
  avgHydration:  z.number().positive().optional(),
  energyLevel:   z.number().int().min(1).max(5).optional(),
  nauseaLevel:   z.number().int().min(1).max(5).optional(),
  notes:         z.string().max(2000).optional(),
  // ── Recovery & Sleep ─────────────────────────────────────────────────────
  sleepHours:    z.number().min(0).max(14).optional(),
  sleepQuality:  z.number().int().min(1).max(5).optional(),
});

export type CheckinSchema = z.infer<typeof CheckinSchema>;
