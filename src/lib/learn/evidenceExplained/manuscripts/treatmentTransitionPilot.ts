/**
 * src/lib/learn/evidenceExplained/manuscripts/treatmentTransitionPilot.ts
 *
 * Evidence Explained pilot manuscript v0.1 — DRAFT, UNPUBLISHED.
 *
 * CONTENT LOCK
 * The headline, standfirst and every section except Sources are the Founder's
 * wording as supplied for Evidence Explained Step 3 (27 September 2026),
 * verbatim. The Sources citation is bibliographic data from the PubMed record
 * for PMID 41816857. scripts/evidenceExplainedManuscripts.test.mjs locks this
 * text, both ways, against
 * scripts/fixtures/evidenceExplained/mn-2026-w39-treatment-discontinuation.v0.1.txt:
 * editing, adding or removing a sentence here fails that test.
 *
 * AMENDING THIS FILE
 * A wording change is a new version: new text, new fixture, new `version`,
 * reviewed again. Nothing here is visible to anyone — no route imports it.
 *
 * SOURCE FACTS
 * Every number in the text is a structured fact below, each quoted verbatim
 * from the published abstract (Diabetes Obes Metab 2026;28(6):4795-4805),
 * checked against PubMed and Crossref on 27 September 2026.
 */

import type { EvidenceExplainedManuscript } from '../manuscriptGovernance';

export const TREATMENT_TRANSITION_PILOT = {
  manuscriptId: 'mn-2026-w39-treatment-discontinuation',
  linkedEvidenceId: 'ev-2026-w39-treatment-discontinuation',
  internalWorkingSlug: 'stopping-a-glp-1-medicine-next-plan',
  manuscriptStatus: 'DRAFT',
  headline: 'Stopping a GLP-1 Medicine? Why the Next Plan Matters',
  standfirst:
    'Stopping or interrupting treatment should not mean that metabolic care ends. New real-world research shows that many people restart treatment or use another weight-management approach, reinforcing the importance of a clinically supervised transition plan.',
  reviewedBy: 'FOUNDER',
  draftedAt: '2026-09-27',
  lastReviewedAt: '2026-09-27',
  reviewDueAt: '2027-03-27',
  readingAudience: 'PATIENTS_AND_PUBLIC',
  sections: [
    {
      id: 'what-is-being-reported',
      heading: 'What is being reported?',
      blocks: [
        { k: 'p', text: 'A real-world study examined what happened after adults stopped injectable semaglutide or tirzepatide. Rather than assuming that everyone simply remained off treatment without further care, the researchers looked at the additional weight-management support people received during the following year.' },
      ],
    },
    {
      id: 'what-researchers-examined',
      heading: 'What did the researchers examine?',
      blocks: [
        { k: 'p', text: 'The study reviewed health records from 7,938 adults with overweight or obesity in a large health system in Ohio and Florida. Participants had stopped treatment between three and twelve months after starting it.' },
        { k: 'p', text: 'Because this was an observational study using routine health records, it can describe patterns of care but cannot prove that one post-treatment strategy caused a particular outcome.' },
      ],
    },
    {
      id: 'what-they-found',
      heading: 'What did they find?',
      blocks: [
        { k: 'p', text: 'During the following year:' },
        { k: 'ul', items: [
          '19.6% restarted the original medicine.',
          '35.2% received another obesity intervention.',
          'Some patients received another medication, attended a lifestyle-support visit or underwent metabolic or bariatric surgery.',
        ] },
        { k: 'p', text: 'Average weight change after discontinuation was modest in this cohort. This finding should be interpreted alongside the fact that many participants restarted treatment or received another intervention during the following year.' },
      ],
    },
    {
      id: 'meaning-for-patients',
      heading: 'What might this mean for patients?',
      blocks: [
        { k: 'p', text: 'The period after interruption or discontinuation is not one single pathway. Some patients restart treatment, some change treatment and others use nutritional, behavioural or surgical support.' },
        { k: 'p', text: 'The important message is not that everyone should continue the same medicine. It is that treatment changes should be planned, monitored and supported according to the individual patient’s clinical circumstances.' },
      ],
    },
    {
      id: 'what-it-does-not-prove',
      heading: 'What does this study not prove?',
      blocks: [
        { k: 'p', text: 'This study does not prove that stopping treatment prevents weight regain. It also does not establish that restarting medication, switching treatment or using another intervention is best for every patient.' },
        { k: 'p', text: 'The researchers relied on routine health records. Some care, including informal dietary or lifestyle changes and compounded medicines, may not have been recorded. The people who received additional treatment may also have differed from those who did not.' },
      ],
    },
    {
      id: 'why-transition-plan',
      heading: 'Why does a transition plan matter?',
      blocks: [
        { k: 'p', text: 'A clinically supervised transition plan can help preserve continuity of metabolic care when treatment is interrupted, changed or ended.' },
        { k: 'p', text: 'Depending on the patient’s circumstances, this discussion may include:' },
        { k: 'ul', items: [
          'the reason treatment is changing;',
          'appetite and weight trajectory;',
          'blood glucose, blood pressure and other cardiometabolic measures;',
          'nutritional adequacy and hydration;',
          'muscle preservation and physical function;',
          'alternative treatment or supportive-care options;',
          'timing of clinical follow-up.',
        ] },
      ],
    },
    {
      id: 'discuss-with-clinician',
      heading: 'What should you discuss with your clinician?',
      blocks: [
        { k: 'p', text: 'Before changing treatment, discuss:' },
        { k: 'ul', items: [
          'why you are considering the change;',
          'any adverse effects or difficulty accessing treatment;',
          'changes in appetite, food intake or hydration;',
          'your weight, metabolic health and treatment goals;',
          'how nutrition, resistance exercise and physical function will be supported;',
          'what monitoring and follow-up will occur after the change.',
        ] },
        { k: 'p', text: 'Do not change prescribed treatment solely because of an educational article.' },
      ],
    },
    {
      id: 'myoguard-perspective',
      heading: 'MyoGuard perspective',
      blocks: [
        { k: 'p', text: 'MyoGuard supports continuity of care across treatment initiation, continuation, interruption, switching and structured discontinuation.' },
        { k: 'p', text: 'Its role is not to favour a particular medicine or manufacturer. MyoGuard’s physician-led Clinical Decision Support focuses on nutritional adequacy, muscle preservation, functional health and longitudinal metabolic outcomes throughout the treatment journey.' },
      ],
    },
    {
      id: 'sources',
      heading: 'Sources',
      blocks: [
        { k: 'p', text: 'Gasoyan H, Schulte R, Boyer CB, et al. Obesity Treatments and Weight Changes in Clinical Practice After Discontinuation of Semaglutide or Tirzepatide. Diabetes Obes Metab. 2026;28(6):4795-4805. DOI 10.1111/dom.70660. PMID 41816857.' },
      ],
    },
    {
      id: 'educational-disclaimer',
      heading: 'Educational disclaimer',
      blocks: [
        { k: 'p', text: 'This material is for education only and does not replace individualized medical advice. Medication decisions should be made with the treating clinician, who can consider the patient’s diagnosis, treatment response, adverse effects, access, preferences and overall health.' },
      ],
    },
  ],
  sourceReferences: [
    {
      evidenceId: 'ev-2026-w39-treatment-discontinuation',
      citation: 'Gasoyan H, Schulte R, Boyer CB, et al. Obesity Treatments and Weight Changes in Clinical Practice After Discontinuation of Semaglutide or Tirzepatide. Diabetes Obes Metab. 2026;28(6):4795-4805. DOI 10.1111/dom.70660. PMID 41816857.',
      doi: '10.1111/dom.70660',
      pmid: '41816857',
      canonicalUrl: null,
      facts: [
        {
          id: 'cohort-size',
          tokens: ['7,938'],
          sourceStatement: 'A total of 7938 patients (mean [SD] age, 55.7 [13.4] years; 5061 [63.8%] female) were identified.',
        },
        {
          id: 'discontinuation-window',
          tokens: ['three', 'twelve'],
          sourceStatement: 'Adults with overweight or obesity who initiated injectable semaglutide or tirzepatide for obesity or T2D between 2021 and 2023 and discontinued the medication within 3-12 months were included.',
        },
        {
          id: 'restarted-original-medicine',
          tokens: ['19.6%'],
          sourceStatement: 'During 1-year post-discontinuation, 19.6% restarted the index medication and 35.2% received an alternative obesity treatment, including starting another medication (27.4%), lifestyle modification visit (13.7%) and metabolic and bariatric surgery (0.6%).',
        },
        {
          id: 'another-obesity-intervention',
          tokens: ['35.2%'],
          sourceStatement: 'During 1-year post-discontinuation, 19.6% restarted the index medication and 35.2% received an alternative obesity treatment, including starting another medication (27.4%), lifestyle modification visit (13.7%) and metabolic and bariatric surgery (0.6%).',
        },
      ],
    },
  ],
  educationalDisclaimer:
    'This material is for education only and does not replace individualized medical advice. Medication decisions should be made with the treating clinician, who can consider the patient’s diagnosis, treatment response, adverse effects, access, preferences and overall health.',
  version: 'v0.1',
} as const satisfies EvidenceExplainedManuscript;
