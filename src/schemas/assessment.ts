import { z } from "zod";

// ─── Assessment intake (mirrors AssessmentInput from protocolEngine) ──────────

export const AssessmentInputSchema = z.object({
  weight: z.string().min(1, "Weight is required"),
  unit: z.enum(["kg", "lbs"]),
  medication: z.enum(["semaglutide", "tirzepatide"]),
  doseMg: z.number().positive("Dose must be a positive number"),
  activityLevel: z.enum(["sedentary", "moderate", "active"]),
  symptoms: z.array(z.string()),
});

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
    activityLevel: z.string(),
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
});

export type CheckinSchema = z.infer<typeof CheckinSchema>;
