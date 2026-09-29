import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "MyoGuard Protocol privacy policy. Learn how Meridian Wellness Systems LLC collects, uses, shares and retains information through MyoGuard Protocol.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <Link href="/" className="text-xl font-bold text-slate-800 tracking-tight hover:opacity-80 transition-opacity">
              Myo<span className="text-teal-600">Guard</span> Protocol
            </Link>
            <p className="text-xs text-slate-500 mt-0.5">Physician-Formulated · Data-Driven Muscle Protection</p>
          </div>
          <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-3 py-1 font-medium">
            MyoGuard Clinical Oversight
          </span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800">Privacy Policy</h1>
          <p className="text-sm text-slate-500 mt-2">Last updated: September 2026 · Governing law: Wyoming, USA</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-8 text-sm text-slate-600 leading-relaxed">

          {/* Introduction */}
          <section>
            <p>
              MyoGuard Protocol (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is committed to protecting your personal information. This Privacy Policy explains what data we collect, how we use it, and your rights as a user of this tool. By using the MyoGuard Protocol Clinical Decision Support (CDS) platform, you agree to the practices described in this policy.
            </p>
          </section>

          {/* 1. Data We Collect */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-3">1. Data We Collect</h2>
            <p className="mb-3">We collect information you provide to us, and limited usage information collected automatically, as described in section 3. Through the SRI assessment, this may include:</p>
            <ul className="list-disc list-inside space-y-1.5 text-slate-600 pl-2">
              <li><span className="font-medium text-slate-700">Email address:</span> collected if you choose to have your protocol emailed to you</li>
              <li><span className="font-medium text-slate-700">Body weight:</span> used to generate personalised nutritional targets and, if you have an account, kept as part of your assessment record</li>
              <li><span className="font-medium text-slate-700">Medication type:</span> the GLP-1 medication you select (e.g. Semaglutide, Tirzepatide)</li>
              <li><span className="font-medium text-slate-700">Weekly dose:</span> your current GLP-1 dose in mg</li>
              <li><span className="font-medium text-slate-700">Activity level:</span> sedentary, moderate, or active</li>
              <li><span className="font-medium text-slate-700">Symptoms:</span> any self-reported symptoms selected from the checklist</li>
              <li><span className="font-medium text-slate-700">Protein intake and sleep:</span> your self-reported daily protein intake and typical hours of sleep</li>
            </ul>
            <p className="mt-3">
              If you create a patient account, we also store your name and email address, and the information you enter through your account: your profile (such as age, sex, height, weight, goal weight, GLP-1 medication, dose and treatment stage), your SRI assessments and their outputs, and your weekly check-ins. If your account is linked to a physician, that physician can view these records.
            </p>
            <p className="mt-3">
              If you register as a physician, we store your name, email address, country, specialty and any professional identifiers you provide, such as an NPI or licence number. A physician using MyoGuard may also enter a patient&apos;s name, email address and clinical details, such as age, weight and GLP-1 medication, to prepare a protocol or an invitation before that patient has an account.
            </p>
            <p className="mt-3">
              You may also give us your email address when you ask us to send you an educational resource, such as the MyoGuard Protein Guide. If you do, your email address is the only information we collect. You do not need to complete the SRI assessment, create an account, register as a physician, or be a patient of ours in order to request it.
            </p>
            <p className="mt-3">
              No account is required to use the preliminary SRI on our homepage or to request an educational resource. An account is required to use the patient dashboard, and physicians must register to use the physician platform. We do not store phone numbers. Physician subscriptions are paid through our payment processor; we do not receive full card details, and we store only the processor&apos;s customer and subscription references.
            </p>
          </section>

          {/* 2. How We Use Your Data */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-3">2. How We Use Your Data</h2>
            <p className="mb-3">We use the information you provide solely for the following purposes:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>To generate your personalised protein, fibre, and hydration protocol outputs</li>
              <li>To send your protocol results to the email address you provide, if requested</li>
              <li>To improve the accuracy and relevance of our SRI and protocol methodologies over time</li>
              <li>To send you an educational resource, such as the MyoGuard Protein Guide, when you ask us for it</li>
              <li>If you have an account, to keep your assessment history so that changes can be followed over time</li>
              <li>If your account is linked to a physician, to make your records available to that physician</li>
              <li>To let you share your report through a link you create, which stops working after 30 days or when you revoke it</li>
              <li>For physicians, to review registration, manage subscriptions and provide the physician platform</li>
              <li>To understand how our website is used, through the usage information described in section 3</li>
            </ul>
            <p className="mt-3">
              Asking us for an educational resource is a one-time request. By itself it does not subscribe you to ongoing educational or marketing email, and it does not add you to a mailing list.
            </p>
            <p className="mt-3">
              The SRI is generated automatically from the information you provide. Its outputs, including a risk category and protocol targets, are Clinical Decision Support (CDS) intended to be reviewed with a physician. They are not medical advice.
            </p>
          </section>

          {/* 3. Data Sharing */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-3">3. Data Sharing and Third Parties</h2>
            <p>
              We do not sell, rent, or trade your personal data to third parties. We will never share your health-related inputs (weight, dose, symptoms) with advertisers, data brokers, or any external commercial entities.
            </p>
            <p className="mt-3">
              We use third-party service providers — for authentication, hosting and database services, email delivery, payment processing and analytics — to fulfil the functions described in this policy.
            </p>
            <p className="mt-3">
              We use a third-party product analytics service to understand how our website is used. It records the pages you visit and specific actions, such as starting an assessment or requesting a resource, together with a random identifier stored in your browser&apos;s local storage and in a cookie. We do not send it your name, your email address or your individual assessment inputs. When you generate a preliminary SRI on our homepage, it records the preliminary risk category (low, moderate or high). It does not record your screen, and patient, assessment and report-link identifiers in page addresses are removed before anything is sent. We also keep simple usage records in our own database, such as a record that an account completed an assessment.
            </p>
          </section>

          {/* 4. Affiliate Links */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-3">4. Affiliate Links Disclosure</h2>
            <p>
              MyoGuard Protocol does not currently contain affiliate links to supplement retailers.
            </p>
            <p className="mt-3">
              Supplement information is based on published clinical protocols and is not influenced by affiliate relationships.
            </p>
          </section>

          {/* 5. GDPR */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-3">5. Your Rights Under GDPR (EU/EEA Users)</h2>
            <p className="mb-3">If you are located in the European Union or European Economic Area, you may have the following rights under the General Data Protection Regulation (GDPR):</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li><span className="font-medium text-slate-700">Right of access:</span> you may request a copy of the personal data we hold about you</li>
              <li><span className="font-medium text-slate-700">Right to rectification:</span> you may request correction of inaccurate data</li>
              <li><span className="font-medium text-slate-700">Right to erasure:</span> you may request deletion of your personal data</li>
              <li><span className="font-medium text-slate-700">Right to restrict processing:</span> you may request that we limit how we use your data</li>
              <li><span className="font-medium text-slate-700">Right to object:</span> you may object to processing based on legitimate interests</li>
            </ul>
            <p className="mt-3">
              To make a request, contact us at <a href="mailto:privacy@myoguard.health" className="text-teal-600 hover:underline">privacy@myoguard.health</a>. Requests are handled subject to applicable law, verification of your identity, and any records we are required or permitted to retain.
            </p>
          </section>

          {/* 6. CCPA */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-3">6. Your Rights Under CCPA (California Users)</h2>
            <p className="mb-3">If you are a California resident, the California Consumer Privacy Act (CCPA) may give you the following rights:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li><span className="font-medium text-slate-700">Right to know:</span> you may request disclosure of the categories and specific pieces of personal information we have collected about you</li>
              <li><span className="font-medium text-slate-700">Right to delete:</span> you may request deletion of your personal information</li>
              <li><span className="font-medium text-slate-700">Right to opt-out of sale:</span> we do not sell personal information</li>
              <li><span className="font-medium text-slate-700">Right to non-discrimination:</span> we will not discriminate against you for exercising your CCPA rights</li>
            </ul>
            <p className="mt-3">
              To submit a CCPA request, contact <a href="mailto:privacy@myoguard.health" className="text-teal-600 hover:underline">privacy@myoguard.health</a>. Requests are handled subject to applicable law, verification of your identity, and any records we are required or permitted to retain.
            </p>
          </section>

          {/* 7. Data Retention */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-3">7. Data Retention</h2>
            <p>
              When you ask us to email your preliminary SRI results or an educational resource, such as the MyoGuard Protein Guide, your email address is sent to our email delivery provider so that the message can be delivered. MyoGuard does not currently store that address in its application database solely because of that request.
            </p>
            <p className="mt-3">
              We do keep a pseudonymous record of the send — a one-way code derived from the address rather than the address itself — so that we can show a message was requested and sent, and so that safeguards such as sending limits work. We also keep pseudonymous suppression information, so that if a message bounces or is reported as spam, we continue to honour that and stop sending to it. We have not set a fixed retention period for these pseudonymous records.
            </p>
            <p className="mt-3">
              If you use the preliminary SRI on our homepage without an account, your assessment inputs (weight, dose, symptoms, etc.) are processed in your browser and are not sent to our servers. If you ask us to email your results, your email address and your preliminary results — not your individual inputs — are sent to our servers so that the email can be delivered. If you have an account, your profile, SRI assessments, their outputs and your weekly check-ins are stored on our servers as part of your account record.
            </p>
            <p className="mt-3">
              We have not set a fixed retention period for account records, clinical records or information entered by physicians. These records may be retained as reasonably necessary to provide longitudinal Clinical Decision Support (CDS), maintain appropriate records, meet applicable legal or regulatory obligations, resolve disputes, and protect the security and integrity of the platform.
            </p>
            <p className="mt-3">
              You may ask us to delete your personal information by contacting <a href="mailto:privacy@myoguard.health" className="text-teal-600 hover:underline">privacy@myoguard.health</a>. Deletion is not automatic or immediate. Requests are handled subject to applicable law, verification of your identity, and any records we are required or permitted to retain.
            </p>
          </section>

          {/* 8. Contact */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-3">8. Privacy Contact</h2>
            <p>
              For all privacy-related requests, questions, or concerns, please contact us at:
            </p>
            <div className="mt-3 bg-slate-50 rounded-lg border border-slate-200 px-4 py-3">
              <p className="font-medium text-slate-700">MyoGuard Protocol, Privacy Office</p>
              <p className="mt-1">
                <a href="mailto:privacy@myoguard.health" className="text-teal-600 hover:underline">privacy@myoguard.health</a>
              </p>
            </div>
          </section>

          {/* 9. Governing Law */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-3">9. Governing Law</h2>
            <p>
              This Privacy Policy is governed by and construed in accordance with the laws of the State of Wyoming, United States. Any disputes arising from this policy shall be subject to the exclusive jurisdiction of the courts of Wyoming, USA.
            </p>
          </section>

          {/* 10. Changes */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. When we do, the &quot;Last updated&quot; date at the top of this page will be revised. Continued use of the MyoGuard Protocol tool after any changes constitutes your acceptance of the updated policy.
            </p>
          </section>

        </div>

        {/* Back to homepage */}
        <div className="mt-8 text-center">
          <a
            href="/"
            className="inline-flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors"
          >
            ← Back to home
          </a>
        </div>

        <p className="mt-6 text-xs text-slate-400 text-center">
          © 2026 Meridian Wellness Systems LLC · myoguard.health
        </p>
      </div>
    </main>
  );
}
