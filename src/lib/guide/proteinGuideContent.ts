/**
 * src/lib/guide/proteinGuideContent.ts
 *
 * The MyoGuard Protein Guide — Manuscript v1.2, as structured data.
 *
 * CONTENT LOCK
 * Every string in this file is verbatim from MyoGuard_Protein_Guide_Manuscript
 * v1.2 (C3F-3A-M2B Citation Closure), Part One. Nothing here was written,
 * paraphrased, shortened or expanded by the implementation. The strings were
 * extracted mechanically from the approved manuscript rather than retyped, so a
 * transcription error is not among the ways this file can be wrong.
 *
 * Part Two of the manuscript — the Citation Closure Record — is an internal
 * reconciliation artefact and is deliberately absent: it is not patient-facing
 * content, and shipping it would expose dossier reasoning to patients.
 *
 * WHY CONTENT IS SEPARATED FROM PRESENTATION
 * The manuscript is the clinical authority; the Midnight Silk treatment governs
 * presentation only. Keeping them in separate modules means a visual change
 * cannot reach a clinical sentence, and a reviewer reading this file sees the
 * approved wording undiluted by markup. `block.k` names a presentation role,
 * never a clinical claim — no `k` value is patient-visible.
 *
 * AMENDING THIS FILE
 * Do not. Clinical wording changes arrive as a new approved manuscript version,
 * which is a new file and a new asset version, so CommunicationEvent rows keep
 * naming the exact artefact that was delivered. scripts/proteinGuideContent.test.mjs
 * locks these strings against
 * scripts/fixtures/proteinGuideV1_2.manuscript.txt, which was extracted from the
 * approved .docx; editing a sentence here fails that test.
 *
 * STRUCTURAL LABELS THAT ARE NOT PATIENT COPY
 * The manuscript carries production annotations — "PAGE 1", "Cover",
 * "Positioning statement", "Cover footer line" and the horizontal rules. They
 * describe the document to its producers and are not rendered. Every remaining
 * line of Part One is present.
 */

/** A citation marker, e.g. '1,3' — rendered superscript, never editorial. */
export type Citation = string;

/**
 * A unit of the approved document.
 *
 * `alert` / `alertLead` / `alertList` mark the two genuine safety passages —
 * the Page 4 symptoms that need clinical attention and the Page 5 renal
 * checkpoint. They exist so restraint is enforceable: amber is reachable only
 * through these three kinds, so it cannot spread across the document by
 * accident. `pull` marks a sentence the manuscript already uses as a closing
 * emphasis; it adds weight, never words.
 */
export type GuideBlock =
  | { k: 'h3';        text: string }
  | { k: 'p';         text: string; cite?: Citation }
  | { k: 'pull';      text: string }
  | { k: 'alertLead'; text: string }
  | { k: 'alert';     text: string }
  | { k: 'note';      text: string }
  | { k: 'ul';        items: readonly string[] }
  | { k: 'alertList'; items: readonly string[] }
  | { k: 'refs';      items: readonly string[] };

export type GuidePage = {
  /** Manuscript page number, 2–8. Page 1 is the cover, modelled separately. */
  readonly n: number;
  readonly title: string;
  readonly blocks: readonly GuideBlock[];
};

/** Manuscript Page 1. */
export const GUIDE_COVER = {
  title:    'THE MYOGUARD PROTEIN GUIDE',
  subtitle: 'Protein-Smart Eating During GLP-1 Weight Loss',
  lede: [
    'Weight loss changes more than the number on the scale. This guide explains what happens to your body during treatment with GLP-1 and related medicines, why eating well can become harder, and how to think about protein in everyday food — without turning eating into arithmetic.',
    'It is educational. It is not a diet plan, and it is not a substitute for advice from your own clinician.',
  ],
  footer:   'MyoGuard Protocol  ·  Physician-led Clinical Decision Support  ·  myoguard.health',} as const;

/** Manuscript Pages 2–8, in order. */
export const GUIDE_PAGES: readonly GuidePage[] = [
  {
    n: 2,
    title: 'What Happens to Your Body During Weight Loss',
    blocks: [
      { k: 'p', text: 'When people lose a significant amount of weight — through any method — the weight that comes off is not made up of fat alone. Some lean tissue is lost as well. This is a normal part of weight loss, and the proportion lost as lean tissue during treatment with these medicines is broadly similar to other substantial weight-loss approaches.', cite: '1,3' },
      { k: 'p', text: 'In studies of incretin-based treatments, most of the weight people lost was fat.', cite: '1,3' },
      { k: 'h3', text: 'Lean mass is not the same thing as muscle' },
      { k: 'p', text: 'You may see the term "lean mass" used in articles about weight loss. It is worth understanding what it actually means.' },
      { k: 'p', text: 'Lean mass is everything in the body that is not fat. That includes skeletal muscle — the muscle you use to stand, lift and walk — but it also includes water, organs and connective tissue. Body-composition scans do not measure skeletal muscle directly; they estimate it, and part of a reported change can reflect shifts in body water rather than a loss of muscle itself.', cite: '9' },
      { k: 'p', text: 'This matters because a falling number on a scan is not, by itself, evidence that a person has lost strength or function.', cite: '2,3,9' },
      { k: 'h3', text: 'What the evidence does and does not show' },
      { k: 'p', text: 'Researchers are still working out how much of the lean tissue change during incretin treatment represents skeletal muscle, and what it means for how people actually feel and move. The available evidence does not establish that these medicines cause a disproportionate loss of muscle.', cite: '1,3' },
      { k: 'p', text: 'Measures that matter to daily life — strength, walking, getting out of a chair, carrying shopping — have been studied less often in these trials than weight and scan results have. Where strength has been measured, it did not decline.', cite: '1,2,3' },
      { k: 'pull', text: 'The goal is not to protect a number on a scan. The goal is to come through weight loss strong, well-nourished and able to do the things you need to do.' },
    ],
  },
  {
    n: 3,
    title: 'Muscle Health Is Bigger Than Protein',
    blocks: [
      { k: 'p', text: 'Protein gets most of the attention in conversations about muscle during weight loss. It deserves some of it. But protein on its own is not the whole picture, and treating it as though it were can lead people to focus on the wrong thing.' },
      { k: 'h3', text: 'Using your muscles matters, too' },
      { k: 'p', text: 'In the wider weight-loss research — studies not specific to GLP-1 medicines — resistance activity has been studied for its role in helping people hold on to strength and physical function while losing weight. This means activity that asks your muscles to work against resistance: body weight, bands, weights, or everyday tasks that involve lifting and carrying.', cite: '4,5' },
      { k: 'p', text: 'This evidence comes from general weight-loss and older-adult research rather than from trials of incretin medicines specifically. That distinction is worth keeping in mind — it is reasonable evidence, but it was not gathered in people taking these treatments.' },
      { k: 'h3', text: 'Protein and activity work together' },
      { k: 'p', text: 'Eating protein gives the body the raw material. Using your muscles gives it a reason to keep them. In one study of older adults losing weight, neither higher protein alone nor exercise alone made a clear difference to lean tissue — only the two together did. Looking at them together may be more useful than concentrating on protein alone.', cite: '4' },
      { k: 'h3', text: 'The rest of the picture' },
      { k: 'ul', items: [
          'Eating enough overall — not only enough protein',
          'Sleep and recovery',
          'Your other medical conditions and medicines',
          'How well you are tolerating treatment day to day',
        ] },
      { k: 'p', text: 'This guide does not set out an exercise programme. What kind of activity is appropriate, and how much, depends on your health, your fitness and any conditions you live with. That is a conversation to have with your clinician.' },
      { k: 'pull', text: 'Protein matters. Using your muscles matters too. The evidence supports thinking about them together rather than focusing on either one alone.' },
    ],
  },
  {
    n: 4,
    title: 'Why Eating Enough Can Become Harder',
    blocks: [
      { k: 'p', text: 'These medicines work in part by reducing appetite. That is the point of the treatment, and for many people it is exactly what helps. But the same effect can make it genuinely harder to eat well — and that is a practical problem worth planning for rather than a sign that something has gone wrong.' },
      { k: 'h3', text: 'What people may notice' },
      { k: 'ul', items: [
          'Feeling full much sooner than expected',
          'Little or no appetite at usual mealtimes',
          'Nausea, particularly in the early weeks or after a dose increase',
          'Food losing its appeal',
          'Meals becoming smaller without any deliberate decision',
        ] },
      { k: 'p', text: 'These effects are well described in studies of these medicines.', cite: '2,8' },
      { k: 'p', text: 'None of this means you are undernourished. It does mean that eating well now takes more thought than it did before — because the appetite signals that used to organise your eating are quieter.' },
      { k: 'h3', text: 'When to contact your clinician' },
      { k: 'p', text: 'Some symptoms need clinical attention rather than self-management. Contact your clinician if you experience:' },
      { k: 'alertList', items: [
          'Vomiting that keeps returning, or that stops you keeping fluids down',
          'Severe or persistent abdominal pain',
          'Signs of dehydration — very little urine, dizziness on standing, persistent thirst',
          'Being unable to eat meaningfully for more than a day or two',
          'Any symptom that worries you, or that is new and does not settle',
        ] },
      { k: 'p', text: 'Do not change how you take your medicine on your own. If symptoms are making treatment difficult, that is a conversation to have with the clinician who prescribed it.' },
      { k: 'alert', text: 'Losing your appetite is expected. Being unable to eat or drink is not — that is worth a phone call.' },
    ],
  },
  {
    n: 5,
    title: 'Before You Change What You Eat — A Safety Checkpoint',
    blocks: [
      { k: 'alertLead', text: 'Please read this page before acting on anything that follows.' },
      { k: 'p', text: 'The rest of this guide describes practical ways to include protein in everyday eating. Before you increase your protein intake substantially, there is something important to understand.' },
      { k: 'h3', text: 'Protein needs are not the same for everyone' },
      { k: 'p', text: 'There is no single protein amount that is right for every person. What is appropriate depends on your health, your medical conditions, your nutritional state, your activity and your treatment. Two people the same age and weight can genuinely need different amounts.', cite: '6,7' },
      { k: 'h3', text: 'Speak with your clinician first if any of these apply to you' },
      { k: 'ul', items: [
          'You have kidney disease, reduced kidney function, or have been told to watch your kidneys',
          'You are on dialysis, or have had a kidney transplant',
          'You have been given a specific diet by a clinician or dietitian',
          'You have another medical condition for which you have been given specific dietary advice',
          'You are unsure whether any of the above applies to you',
        ] },
      { k: 'h3', text: 'An important point about kidney health' },
      { k: 'p', text: 'People sometimes assume that kidney disease automatically means eating less protein. That is not accurate, and acting on that assumption can be harmful.' },
      { k: 'p', text: 'Protein guidance in kidney disease depends on several things — including the stage of the condition, whether someone is on dialysis, their nutritional state, and whether they are frail or losing muscle. In some situations clinicians advise reducing protein. In others — including dialysis, and in some older adults who are frail or have low muscle — clinicians advise the opposite.', cite: '6,7' },
      { k: 'p', text: 'This is exactly why it is a conversation with your own clinician rather than something to work out from a guide. Your clinician knows your kidney function, your history and your nutrition. A booklet does not.' },
      { k: 'alert', text: 'If you have kidney disease or any prescribed diet, do not substantially increase your protein intake before speaking with your clinician.' },
    ],
  },
  {
    n: 6,
    title: 'Building a Protein-Smart Day',
    blocks: [
      { k: 'p', text: 'These are principles, not prescriptions. There is no target here to hit, and no need to count anything. The aim is to make protein easier to include when appetite is limited.' },
      { k: 'h3', text: 'Include a protein food at each eating occasion' },
      { k: 'p', text: 'Rather than concentrating protein into one large meal you may not manage, aim to have something protein-containing whenever you eat — even if the portion is small.' },
      { k: 'h3', text: 'Spread protein opportunities across the day' },
      { k: 'p', text: 'Several modest protein-containing meals or snacks are usually easier to manage than one or two large ones when appetite is reduced.' },
      { k: 'h3', text: 'Start the meal with the protein food' },
      { k: 'p', text: 'If you often feel full partway through a meal, eating the protein part first means it is less likely to be the part left on the plate.' },
      { k: 'h3', text: 'Work with what you can actually tolerate' },
      { k: 'p', text: 'A protein food you can eat is more useful than one you cannot. If a food has become unappealing, dairy, eggs, fish, beans, lentils and soy foods all provide protein and are often easier to manage.' },
      { k: 'h3', text: 'Think about the whole diet, not just protein' },
      { k: 'p', text: 'Fruit, vegetables, fibre and adequate fluid all matter, and eating well overall supports how you feel and how your treatment goes. Protein is one part of nutrition, not a replacement for it.' },
      { k: 'h3', text: 'Do not go hungry to keep the protein high' },
      { k: 'p', text: 'If eating enough at all is difficult, that is worth raising with your clinician. Adequate overall nutrition comes before optimising any single nutrient.' },
      { k: 'pull', text: 'Small, regular, tolerable. That is the whole strategy.' },
    ],
  },
  {
    n: 7,
    title: 'Everyday Protein Foods',
    blocks: [
      { k: 'p', text: 'These are ordinary foods, with approximate protein amounts for common portions. Values are rounded and vary with type, cut, brand and preparation. They are here to give you a sense of scale — not to be added up.' },
      { k: 'p', text: 'Where a range is shown, the variation between products is genuinely wide. Where a food is labelled, the label is more accurate than any general figure.' },
      { k: 'h3', text: 'Eggs and dairy' },
      { k: 'ul', items: [
          '1 large egg — around 6 g',
          '100 g plain Greek yogurt — around 10 g',
          '100 g cottage cheese — around 10–12 g',
          'A glass of milk (about 250 ml) — around 8 g',
        ] },
      { k: 'h3', text: 'Fish, poultry and meat' },
      { k: 'ul', items: [
          '100 g cooked chicken breast — around 31 g',
          '100 g canned tuna in water, drained — around 20 g',
          '100 g cooked white fish — around 20–25 g',
          '100 g lean cooked beef — around 26–30 g, depending on the cut',
        ] },
      { k: 'h3', text: 'Beans, lentils and soy' },
      { k: 'ul', items: [
          '100 g cooked lentils — around 9 g',
          '100 g cooked beans — around 8–9 g',
          '100 g tofu — around 10–17 g, depending on firmness and brand. Check the label.',
        ] },
      { k: 'note', text: 'Note: figures for beans and lentils refer to cooked weight. Dried weights are much higher and are not comparable.' },
      { k: 'note', text: 'Food composition values: USDA FoodData Central.' },
      { k: 'h3', text: 'When your appetite is low' },
      { k: 'ul', items: [
          'Choose foods that are easy to eat — yogurt, eggs, fish, soft beans, soup with lentils',
          'Drinkable protein foods such as milk or yogurt drinks can be easier than solid food',
          'Keep something protein-containing ready, so eating does not depend on cooking',
          'Eat when appetite appears, rather than waiting for the usual mealtime',
          'Cold foods are often better tolerated than hot ones when nausea is present',
          'Small and frequent beats large and occasional',
        ] },
      { k: 'p', text: 'These strategies are practical suggestions for making eating easier. They are not a treatment, and they do not guarantee any particular outcome.' },
    ],
  },
  {
    n: 8,
    title: 'Your Needs Are Individual',
    blocks: [
      { k: 'p', text: 'If there is one thing to take from this guide, it is that there is no single protein number that is right for everyone.' },
      { k: 'h3', text: 'What changes what is appropriate for you' },
      { k: 'ul', items: [
          'Your medicine, your dose and how long you have been on treatment',
          'Your kidney function and any other medical conditions',
          'Your nutritional state and whether you are eating adequately overall',
          'Your age, your activity and your current strength',
          'Any diet you have already been given by a clinician or dietitian',
        ] },
      { k: 'p', text: 'Because these differ from person to person, the useful next step is not to find a number online. It is to have the conversation with someone who knows your situation.' },
      { k: 'h3', text: 'Questions worth taking to your clinician' },
      { k: 'ul', items: [
          'Given my health, is my protein intake about right?',
          'Is there anything about my kidney function I should take into account?',
          'What kind of activity would be sensible and safe for me?',
          'I am struggling to eat enough — can we look at that?',
        ] },
      { k: 'h3', text: 'About MyoGuard' },
      { k: 'p', text: 'MyoGuard Protocol is a physician-led Clinical Decision Support platform, designed to be used by clinicians alongside their own judgement when caring for people on GLP-1 and related treatments.' },
      { k: 'p', text: 'The Sarcopenia Risk Index (SRI) is a physician-led Clinical Decision Support tool that helps clinicians consider factors associated with vulnerability to sarcopenia and muscle compromise during treatment.' },
      { k: 'p', text: 'It is not a diagnosis. It does not predict what will happen to any individual. It supports clinical judgement rather than replacing it, and every output is interpreted by the treating clinician.' },
      { k: 'h3', text: 'Important' },
      { k: 'p', text: 'This guide is general education. It is not medical advice, it is not a diet plan, and it does not create a clinician–patient relationship. Decisions about your treatment, your diet and your health belong with you and your own clinician.' },
      { k: 'h3', text: 'References' },
      { k: 'refs', items: [
          'Look M, Dunn JP, Kushner RF, et al. Body composition changes during weight reduction with tirzepatide in the SURMOUNT-1 study. Diabetes Obes Metab. 2025;27(5):2720-2729. DOI 10.1111/dom.16275. PMID 39996356.',
          'Alissou M, et al. Impact of semaglutide on fat mass, lean mass and muscle function: the SEMALEAN study. Diabetes Obes Metab. 2026;28(1):112-121. DOI 10.1111/dom.70141. PMID 41068996.',
          'Laverde LP, Muñoz-Velandia OM, Alfonso D, Gómez Medina AM. Effect of GLP-1 receptor agonists at doses for obesity management on muscle health. Int J Obes. 2026;50(8):1638-1646. DOI 10.1038/s41366-026-02118-y. PMID 42321502.',
          'Verreijen AM, Engberink MF, Memelink RG, et al. Nutr J. 2017;16:10. DOI 10.1186/s12937-017-0229-6. PMID 28166780.',
          'Villareal DT, Aguirre L, Gurney AB, et al. N Engl J Med. 2017;376(20):1943-1955. DOI 10.1056/NEJMoa1616338. PMID 28514618.',
          'Bauer J, Biolo G, Cederholm T, et al. PROT-AGE Study Group. J Am Med Dir Assoc. 2013;14(8):542-559. DOI 10.1016/j.jamda.2013.05.021.',
          'KDIGO CKD Work Group. KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease. Kidney Int. 2024;105(4S):S117-S314. DOI 10.1016/j.kint.2023.10.018.',
          'Karrar HR, et al. Tirzepatide-induced gastrointestinal manifestations: a systematic review and meta-analysis. Cureus. 2023;15(9):e46091. DOI 10.7759/cureus.46091. PMID 37908927.',
          'Baglietto N, Vaquero-Cristóbal R, Albaladejo-Saura M, et al. Front Nutr. 2024;11:1445892. DOI 10.3389/fnut.2024.1445892. PMID 39224178.',
        ] },
    ],
  },];

/** The approved content version. Bound into the asset's templateId. */
export const GUIDE_MANUSCRIPT_VERSION = 'v1.2';
