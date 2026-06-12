/**
 * src/data/citations.ts
 *
 * Clinical Evidence Citations — MyoGuard Protocol
 *
 * Single source of truth for all peer-reviewed literature referenced across
 * the MyoGuard research frontend.
 *
 * GOVERNANCE RULES (non-negotiable):
 *   - All citations must reference real, published, indexed papers.
 *   - Summaries must use observational language only.
 *     Allowed:  "observed", "reported", "described", "associated with", "recorded"
 *     Forbidden: "proves", "confirms", "validates", "guarantees", "demonstrates"
 *   - The SRI is never described as validated, diagnostic, or predictive.
 *   - Do not add citations without cross-checking against PubMed or DOI.
 *
 * Column normative:
 *   PMID and DOI are optional. Include only when confirmed.
 *   Authors stored in 'Last FM' format; display logic handles 'et al.' truncation.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type CitationTopic =
  | 'glp1-therapy'
  | 'muscle-preservation'
  | 'protein-requirements'
  | 'sarcopenia-risk';

export type EvidenceType =
  | 'RCT'
  | 'Meta-Analysis'
  | 'Observational'
  | 'Guideline'
  | 'Consensus'
  | 'Review';

export interface Citation {
  /** Kebab-case unique identifier. Never changes once assigned. */
  id: string;
  /** Full title of the publication. */
  title: string;
  /**
   * Authors in 'Last FM' format.
   * Display layer applies 'et al.' when length > 3.
   */
  authors: string[];
  /** Journal name as published. */
  journal: string;
  /** Publication year (4-digit). */
  year: number;
  /** Digital Object Identifier — include only when confirmed. */
  doi?: string;
  /** PubMed identifier — include only when confirmed. */
  pmid?: string;
  /**
   * One-sentence observational summary.
   * Must use observational vocabulary only. No clinical claims.
   */
  summary: string;
  /**
   * One or more relevant evidence domains.
   * A citation may belong to multiple topics.
   */
  topics: CitationTopic[];
  evidenceType: EvidenceType;
}

// ── Citation Dataset ───────────────────────────────────────────────────────────

export const CITATIONS: Citation[] = [

  // ── GLP-1 Receptor Agonist Therapy ────────────────────────────────────────

  {
    id: 'wilding-nejm-2021',
    title: 'Once-Weekly Semaglutide in Adults with Overweight or Obesity',
    authors: ['Wilding JPH', 'Batterham RL', 'Calanna S', 'Davies M', 'Van Gaal LF'],
    journal: 'N Engl J Med',
    year: 2021,
    doi: '10.1056/NEJMoa2032183',
    pmid: '33567185',
    summary:
      'The STEP 1 randomised trial reported a mean body weight reduction of 14.9% with once-weekly semaglutide 2.4 mg over 68 weeks, with lean body mass loss observed as a proportion of total weight lost.',
    topics: ['glp1-therapy'],
    evidenceType: 'RCT',
  },

  {
    id: 'jastreboff-nejm-2022',
    title: 'Tirzepatide Once Weekly for the Treatment of Obesity',
    authors: ['Jastreboff AM', 'Aronne LJ', 'Ahmad NN', 'Wharton S', 'Connery L'],
    journal: 'N Engl J Med',
    year: 2022,
    doi: '10.1056/NEJMoa2206038',
    pmid: '35658024',
    summary:
      'The SURMOUNT-1 randomised trial reported a mean body weight reduction of 22.5% with tirzepatide 15 mg weekly over 72 weeks in adults with obesity without type 2 diabetes.',
    topics: ['glp1-therapy'],
    evidenceType: 'RCT',
  },

  {
    id: 'rubino-jama-2021',
    title:
      'Effect of Continued Weekly Subcutaneous Semaglutide vs Placebo on Weight Loss Maintenance in Adults With Overweight or Obesity: The STEP 4 Randomized Clinical Trial',
    authors: ['Rubino D', 'Abrahamsson N', 'Davies M', 'Hesse D', 'Greenway FL'],
    journal: 'JAMA',
    year: 2021,
    doi: '10.1001/jama.2021.3224',
    pmid: '33755728',
    summary:
      'The STEP 4 trial reported that discontinuation of semaglutide after 20 weeks was associated with regain of approximately two-thirds of prior weight lost by week 120, suggesting that continued pharmacotherapy is required to maintain treatment effects.',
    topics: ['glp1-therapy'],
    evidenceType: 'RCT',
  },

  {
    id: 'garvey-natmed-2022',
    title: 'Two-year effects of semaglutide in adults with overweight or obesity: the STEP 5 trial',
    authors: ['Garvey WT', 'Batterham RL', 'Bhatta M', 'Buscemi S', 'Christensen LN'],
    journal: 'Nat Med',
    year: 2022,
    doi: '10.1038/s41591-022-02026-4',
    pmid: '36216945',
    summary:
      'Sustained semaglutide treatment over two years was associated with continued weight reduction and cardiometabolic improvements, with body composition changes including lean mass reported across the observation period.',
    topics: ['glp1-therapy'],
    evidenceType: 'RCT',
  },

  {
    id: 'lundgren-nejm-2021',
    title: 'Healthy Weight Loss Maintenance with Exercise, Liraglutide, or Both Combined',
    authors: ['Lundgren JR', 'Janus C', 'Jensen SBK', 'Juhl CR', 'Olsen LM'],
    journal: 'N Engl J Med',
    year: 2021,
    doi: '10.1056/NEJMoa2028198',
    pmid: '33979491',
    summary:
      'Combined exercise and liraglutide was associated with the most favourable preservation of lean body mass during weight loss maintenance compared with pharmacotherapy or exercise alone over a 52-week period.',
    topics: ['glp1-therapy', 'muscle-preservation'],
    evidenceType: 'RCT',
  },

  // ── Sarcopenia Risk Assessment ─────────────────────────────────────────────

  {
    id: 'cruz-jentoft-ageageing-2019',
    title: 'Sarcopenia: revised European consensus on definition and diagnosis',
    authors: ['Cruz-Jentoft AJ', 'Bahat G', 'Bauer J', 'Boirie Y', 'Bruyère O'],
    journal: 'Age Ageing',
    year: 2019,
    doi: '10.1093/ageing/afy169',
    pmid: '30312372',
    summary:
      'The EWGSOP2 consensus revised the definition and diagnostic criteria for sarcopenia, establishing low muscle strength as the primary parameter and low muscle quantity or quality as the confirmatory criterion.',
    topics: ['sarcopenia-risk'],
    evidenceType: 'Consensus',
  },

  {
    id: 'chen-jamda-2014',
    title: 'Sarcopenia in Asia: Consensus Report of the Asian Working Group for Sarcopenia',
    authors: ['Chen LK', 'Liu LK', 'Woo J', 'Assantachai P', 'Auyeung TW'],
    journal: 'J Am Med Dir Assoc',
    year: 2014,
    doi: '10.1016/j.jamda.2013.11.025',
    pmid: '24461239',
    summary:
      'The Asian Working Group for Sarcopenia established region-specific diagnostic criteria for low muscle mass and function, noting that sarcopenia thresholds differ meaningfully across ethnic populations.',
    topics: ['sarcopenia-risk'],
    evidenceType: 'Consensus',
  },

  {
    id: 'shafiee-jdmd-2017',
    title:
      'Prevalence of sarcopenia in the world: a systematic review and meta-analysis of general population studies',
    authors: ['Shafiee G', 'Keshtkar A', 'Soltani A', 'Ahadi Z', 'Larijani B'],
    journal: 'J Diabetes Metab Disord',
    year: 2017,
    doi: '10.1186/s40200-017-0302-x',
    pmid: '28523252',
    summary:
      'A systematic review and meta-analysis of general population studies reported sarcopenia prevalence ranging from approximately 10% to 27%, with substantial variation observed depending on the diagnostic criteria applied and the population studied.',
    topics: ['sarcopenia-risk'],
    evidenceType: 'Meta-Analysis',
  },

  {
    id: 'tournadre-jbs-2019',
    title: 'Sarcopenia',
    authors: ['Tournadre A', 'Vial G', 'Capel F', 'Soubrier M', 'Boirie Y'],
    journal: 'Joint Bone Spine',
    year: 2019,
    doi: '10.1016/j.jbspin.2018.08.001',
    pmid: '29859929',
    summary:
      'This review described the pathophysiology, diagnostic approaches, and clinical consequences of sarcopenia, noting its association with metabolic conditions, functional decline, and increased morbidity in older adults.',
    topics: ['sarcopenia-risk'],
    evidenceType: 'Review',
  },

  {
    id: 'weinheimer-nutrrev-2010',
    title:
      'A systematic review of the separate and combined effects of energy restriction and exercise on fat-free mass in middle-aged and older adults: implications for sarcopenic obesity',
    authors: ['Weinheimer EM', 'Sands LP', 'Campbell WW'],
    journal: 'Nutr Rev',
    year: 2010,
    doi: '10.1111/j.1753-4887.2010.00298.x',
    pmid: '20591106',
    summary:
      'This systematic review reported that energy restriction alone was consistently associated with significant fat-free mass loss in middle-aged and older adults, while the combination of energy restriction with exercise attenuated this loss.',
    topics: ['muscle-preservation', 'sarcopenia-risk'],
    evidenceType: 'Meta-Analysis',
  },

  // ── Dietary Protein Requirements ──────────────────────────────────────────

  {
    id: 'bauer-jamda-2013',
    title:
      'Evidence-Based Recommendations for Optimal Dietary Protein Intake in Older People: A Position Paper From the PROT-AGE Study Group',
    authors: ['Bauer J', 'Biolo G', 'Cederholm T', 'Cesari M', 'Cruz-Jentoft AJ'],
    journal: 'J Am Med Dir Assoc',
    year: 2013,
    doi: '10.1016/j.jamda.2013.05.021',
    pmid: '23867520',
    summary:
      'The PROT-AGE Study Group recommended dietary protein intake of 1.0–1.2 g/kg body weight per day for healthy older adults, with higher amounts of 1.2–1.5 g/kg/day described for those with acute or chronic illness.',
    topics: ['protein-requirements', 'sarcopenia-risk'],
    evidenceType: 'Guideline',
  },

  {
    id: 'deutz-clinnutr-2014',
    title:
      'Protein intake and exercise for optimal muscle function with aging: Recommendations from the ESPEN Expert Group',
    authors: ['Deutz NEP', 'Bauer JM', 'Barazzoni R', 'Biolo G', 'Boirie Y'],
    journal: 'Clin Nutr',
    year: 2014,
    doi: '10.1016/j.clnu.2014.04.007',
    pmid: '24814383',
    summary:
      'ESPEN expert recommendations described protein intake of 1.0–1.2 g/kg/day for healthy older adults and 1.2–1.5 g/kg/day for those with illness or injury, with combined dietary protein and physical exercise described as the most effective strategy for preserving muscle mass.',
    topics: ['protein-requirements'],
    evidenceType: 'Guideline',
  },

  {
    id: 'phillips-apnm-2016',
    title: "Protein 'requirements' beyond the RDA: implications for optimizing health",
    authors: ['Phillips SM', 'Chevalier S', 'Leidy HJ'],
    journal: 'Appl Physiol Nutr Metab',
    year: 2016,
    doi: '10.1139/apnm-2015-0550',
    pmid: '26960445',
    summary:
      'This review described evidence that protein intakes above the RDA of 0.8 g/kg/day may be warranted for older adults and individuals engaged in resistance training to optimise muscle protein synthesis and support preservation of lean mass.',
    topics: ['protein-requirements'],
    evidenceType: 'Review',
  },

  {
    id: 'morton-bjsm-2018',
    title:
      'A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults',
    authors: ['Morton RW', 'Murphy KT', 'McKellar SR', 'Schoenfeld BJ', 'Henselmans M'],
    journal: 'Br J Sports Med',
    year: 2018,
    doi: '10.1136/bjsports-2017-097608',
    pmid: '28698222',
    summary:
      'This meta-analysis of 49 studies reported that dietary protein supplementation was significantly associated with resistance training-induced gains in muscle mass and strength, with effects plateauing at intakes of approximately 1.62 g/kg/day.',
    topics: ['protein-requirements', 'muscle-preservation'],
    evidenceType: 'Meta-Analysis',
  },

  {
    id: 'stokes-nutrients-2018',
    title:
      'Recent Perspectives Regarding the Role of Dietary Protein for the Promotion of Muscle Hypertrophy with Resistance Exercise Training',
    authors: ['Stokes T', 'Hector AJ', 'Morton RW', 'McGlory C', 'Phillips SM'],
    journal: 'Nutrients',
    year: 2018,
    doi: '10.3390/nu10020180',
    pmid: '29414855',
    summary:
      'This review described evidence supporting the role of dietary protein in facilitating resistance exercise-induced muscle adaptation, noting that both the amount and timing of protein intake were associated with the magnitude of muscle protein synthesis responses.',
    topics: ['protein-requirements', 'muscle-preservation'],
    evidenceType: 'Review',
  },

  // ── Lean Mass Preservation ─────────────────────────────────────────────────

  {
    id: 'cava-advnutr-2017',
    title: 'Preserving Healthy Muscle during Weight Loss',
    authors: ['Cava E', 'Yeat NC', 'Mittendorfer B'],
    journal: 'Adv Nutr',
    year: 2017,
    doi: '10.3945/an.116.014506',
    pmid: '28507015',
    summary:
      'This review described strategies for attenuating lean mass loss during caloric restriction, emphasising the reported roles of adequate dietary protein and resistance exercise in preserving muscle tissue during weight loss interventions.',
    topics: ['muscle-preservation'],
    evidenceType: 'Review',
  },

];

// ── Query Helpers ──────────────────────────────────────────────────────────────

/**
 * Returns all citations tagged with the given topic, ordered by year descending.
 */
export function getCitationsByTopic(topic: CitationTopic): Citation[] {
  return CITATIONS
    .filter(c => c.topics.includes(topic))
    .sort((a, b) => b.year - a.year);
}

/**
 * Returns a single citation by its unique ID, or undefined if not found.
 */
export function getCitationById(id: string): Citation | undefined {
  return CITATIONS.find(c => c.id === id);
}

/**
 * Returns total citation count per topic.
 */
export function getCitationCountByTopic(): Record<CitationTopic, number> {
  const topics: CitationTopic[] = [
    'glp1-therapy',
    'muscle-preservation',
    'protein-requirements',
    'sarcopenia-risk',
  ];
  return Object.fromEntries(
    topics.map(t => [t, getCitationsByTopic(t).length])
  ) as Record<CitationTopic, number>;
}
