'use client';

const CATEGORIES = [
  {
    id:          'foundation',
    label:       'Foundation',
    rationale:   'Core micronutrient support for GLP-1 patients — addresses common deficiencies in vitamin D, magnesium, and B-complex during caloric restriction.',
    formulation: 'High-bioavailability multivitamin with methylated B-complex, 1,000–2,000 IU vitamin D3, and omega-3 concentrate (EPA+DHA ≥ 1 g/day)',
  },
  {
    id:          'muscle',
    label:       'Muscle Support',
    rationale:   'Leucine-rich protein and creatine to preserve and stimulate muscle protein synthesis during active weight loss.',
    formulation: 'Whey or plant-based protein isolate with ≥ 2.5 g leucine per serving; creatine monohydrate 3–5 g/day',
  },
  {
    id:          'recovery',
    label:       'Recovery / Sleep',
    rationale:   'Supports sleep architecture and cortisol regulation — particularly relevant during active weight-loss phases.',
    formulation: 'Magnesium glycinate 200–400 mg before sleep; optional: ashwagandha (KSM-66) 300–600 mg',
  },
  {
    id:          'gi',
    label:       'GI Support (GLP-1 Specific)',
    rationale:   'Targets delayed gastric emptying, nausea, and constipation associated with semaglutide and tirzepatide use.',
    formulation: 'Psyllium husk 5–10 g/day; digestive enzymes with lipase; ginger extract 250–500 mg as needed',
  },
  {
    id:          'adjuncts',
    label:       'Optional Adjuncts',
    rationale:   'Evidence-adjacent formulations for additional metabolic and anti-inflammatory support.',
    formulation: 'Berberine 500 mg (metabolic support), alpha-lipoic acid 300–600 mg, or curcumin with piperine',
  },
];

/**
 * PATIENT-FACING PURCHASE PATHWAY REMOVED — Platform Hardening v1 closure.
 *
 * This block previously carried an affiliate constant, a retailer link table
 * and a `getProviderLink()` builder, and every category rendered an outbound
 * link to an external retailer carrying a referral code. The closure audit
 * found that arrangement indefensible on a patient clinical report: a
 * physician-led Clinical Decision Support (CDS) surface placed dosed
 * supplement recommendations beside undisclosed revenue-generating links.
 *
 * Founder decision, 24 September 2026: SUPPRESS the outbound pathway. The
 * links, the referral code and the builder are gone rather than hidden — a
 * disclosure was explicitly rejected as a substitute, and no replacement
 * retailer was added.
 *
 * The educational content is deliberately UNCHANGED. Every category keeps its
 * label, rationale and formulation exactly as written; rewriting doses or
 * clinical claims was out of scope for this task and remains open.
 *
 * SUPPLEMENT_CLICK, fired from the removed links, was the only patient-side
 * writer to /api/analytics. That route and its table are left in place
 * untouched, per instruction — the event simply has no firing site now.
 *
 * Reinstating any purchase pathway here is a Founder and counsel decision,
 * not an engineering one, and the governance suite fails if a link reappears.
 */

const ACTION_CUES: Record<string, string> = {
  muscle:   'Action cue: Consider adding structured protein support to help meet your daily target.',
  gi:       'Action cue: GI support may help improve consistency with meals and protein intake.',
  recovery: 'Action cue: Recovery support may help reinforce sleep and adaptation habits.',
};

const CONTEXT_NOTES: Record<string, string> = {
  muscle:
    'Your reported protein intake appears below your clinical target. Supplemental protein options may help support lean mass preservation during GLP-1 therapy.',
  gi:
    'GI symptoms may make consistent protein intake harder. GI-support options may help improve tolerability and nutritional consistency.',
  recovery:
    'Short sleep duration may reduce recovery quality and muscle adaptation. Recovery-support options may help reinforce your protocol.',
};

interface SupplementCTAProps {
  dark?:          boolean;
  lowProtein?:    boolean;
  hasGISymptoms?: boolean;
  lowRecovery?:   boolean;
}

export default function SupplementCTA({
  dark          = false,
  lowProtein    = false,
  hasGISymptoms = false,
  lowRecovery   = false,
}: SupplementCTAProps) {
  function isBadged(id: string): boolean {
    if (id === 'muscle'   && lowProtein)    return true;
    if (id === 'gi'       && hasGISymptoms) return true;
    if (id === 'recovery' && lowRecovery)   return true;
    return false;
  }

  function contextNote(id: string): string | null {
    if (id === 'muscle'   && lowProtein)    return CONTEXT_NOTES.muscle;
    if (id === 'gi'       && hasGISymptoms) return CONTEXT_NOTES.gi;
    if (id === 'recovery' && lowRecovery)   return CONTEXT_NOTES.recovery;
    return null;
  }

  function actionCue(id: string): string | null {
    if (id === 'muscle'   && lowProtein)    return ACTION_CUES.muscle;
    if (id === 'gi'       && hasGISymptoms) return ACTION_CUES.gi;
    if (id === 'recovery' && lowRecovery)   return ACTION_CUES.recovery;
    return null;
  }

  if (dark) {
    return (
      <div className="rounded-2xl overflow-hidden" style={{ background: '#0D1421', border: '1px solid #1A2744' }}>
        <div className="px-5 pt-4 pb-3" style={{ borderBottom: '1px solid #1A2744' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">💊</span>
            <p className="text-[10px] font-bold text-teal-400 uppercase tracking-[0.2em]">
              Supplement Protocol
            </p>
          </div>
          <p className="text-sm font-semibold text-slate-100 leading-snug mb-1">
            Support Your Muscle Protection Plan
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            These options are provided as educational support pathways to discuss with your clinician.
          </p>
        </div>

        <div>
          {CATEGORIES.map((cat, i) => {
            const badged = isBadged(cat.id);
            const note   = contextNote(cat.id);
            return (
              <div
                key={cat.id}
                className="px-5 py-4"
                style={i > 0 ? { borderTop: '1px solid rgba(26,39,68,0.6)' } : undefined}
              >
                <div className="flex items-center flex-wrap gap-1 mb-1">
                  <p className="text-xs font-bold text-slate-200">{cat.label}</p>
                  {badged && (
                    <span style={{
                      fontSize:     '10px',
                      fontWeight:   '700',
                      color:        '#2DD4BF',
                      background:   'rgba(45,212,191,0.1)',
                      border:       '1px solid rgba(45,212,191,0.2)',
                      borderRadius: '99px',
                      padding:      '2px 8px',
                      marginLeft:   '8px',
                    }}>
                      Relevant to your profile
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed mb-2">{cat.rationale}</p>
                {note && (
                  <p style={{ fontSize: '12px', color: '#94A3B8', fontStyle: 'italic', marginTop: '8px', marginBottom: '8px', lineHeight: 1.5 }}>
                    {note}
                  </p>
                )}
                {actionCue(cat.id) && (
                  <p style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 600, marginTop: '4px', marginBottom: '8px', lineHeight: 1.5 }}>
                    {actionCue(cat.id)}
                  </p>
                )}
                <p className="text-xs text-slate-300 leading-relaxed mb-3">
                  <span className="font-medium text-slate-500">Recommended formulation: </span>
                  {cat.formulation}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Light variant — anonymous assessment flow
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      <div className="px-5 pt-3 pb-3 bg-teal-600">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">💊</span>
          <p className="text-[10px] font-bold text-white uppercase tracking-[0.2em]">
            Supplement Protocol
          </p>
        </div>
        <p className="text-sm font-semibold text-white leading-snug mb-1">
          Support Your Muscle Protection Plan
        </p>
        <p className="text-xs text-teal-100 leading-relaxed">
          These options are provided as educational support pathways to discuss with your clinician.
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {CATEGORIES.map(cat => (
          <div key={cat.id} className="px-5 py-4">
            <p className="text-xs font-bold text-slate-700 mb-1">{cat.label}</p>
            <p className="text-[11px] text-slate-500 leading-relaxed mb-2">{cat.rationale}</p>
            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              <span className="font-medium text-slate-500">Recommended formulation: </span>
              {cat.formulation}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
