export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <a href="/" className="text-xl font-bold text-slate-800 tracking-tight hover:opacity-80 transition-opacity">
              Myo<span className="text-teal-600">Guard</span> Protocol
            </a>
            <p className="text-xs text-slate-500 mt-0.5">Physician-Formulated · Data-Driven Muscle Protection</p>
          </div>
          <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-3 py-1 font-medium">
            Dr. B, MBBS
          </span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800">Privacy Policy</h1>
          <p className="text-sm text-slate-500 mt-2">Last updated: March 2026 · Governing law: Trinidad and Tobago</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-8 text-sm text-slate-600 leading-relaxed">

          {/* Introduction */}
          <section>
            <p>
              MyoGuard Protocol (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is committed to protecting your personal information. This Privacy Policy explains what data we collect, how we use it, and your rights as a user of this tool. By using the MyoGuard Protocol calculator, you agree to the practices described in this policy.
            </p>
          </section>

          {/* 1. Data We Collect */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-3">1. Data We Collect</h2>
            <p className="mb-3">We collect only the information you voluntarily enter into the calculator. This may include:</p>
            <ul className="list-disc list-inside space-y-1.5 text-slate-600 pl-2">
              <li><span className="font-medium text-slate-700">Email address:</span> collected if you choose to have your protocol emailed to you</li>
              <li><span className="font-medium text-slate-700">Body weight:</span> used solely to calculate personalised nutritional targets</li>
              <li><span className="font-medium text-slate-700">Medication type:</span> the GLP-1 medication you select (e.g. Semaglutide, Tirzepatide)</li>
              <li><span className="font-medium text-slate-700">Weekly dose:</span> your current GLP-1 dose in mg</li>
              <li><span className="font-medium text-slate-700">Activity level:</span> sedentary, moderate, or active</li>
              <li><span className="font-medium text-slate-700">Symptoms:</span> any self-reported symptoms selected from the checklist</li>
            </ul>
            <p className="mt-3">
              No account registration is required. We do not collect names, phone numbers, or payment information directly through this tool.
            </p>
          </section>

          {/* 2. How We Use Your Data */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-3">2. How We Use Your Data</h2>
            <p className="mb-3">We use the information you provide solely for the following purposes:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>To generate your personalised protein, fibre, and hydration protocol calculations</li>
              <li>To send your protocol results to the email address you provide, if requested</li>
              <li>To improve the accuracy and relevance of our calculation models over time</li>
            </ul>
            <p className="mt-3">
              We do not use your data for automated decision-making or profiling that produces legal or similarly significant effects.
            </p>
          </section>

          {/* 3. Data Sharing */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-3">3. Data Sharing and Third Parties</h2>
            <p>
              We do not sell, rent, or trade your personal data to third parties. We will never share your health-related inputs (weight, dose, symptoms) with advertisers, data brokers, or any external commercial entities.
            </p>
            <p className="mt-3">
              We may use trusted third-party service providers (such as email delivery services) solely to fulfil the functions described in this policy. These providers are contractually bound to handle your data securely and only for the purposes we specify.
            </p>
          </section>

          {/* 4. Affiliate Links */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-3">4. Affiliate Links Disclosure</h2>
            <p>
              MyoGuard Protocol contains affiliate links to iHerb and Thorne supplement products. If you click one of these links and make a purchase, we may earn a commission at no additional cost to you. Affiliate commissions help support the ongoing development of this free clinical tool.
            </p>
            <p className="mt-3">
              Supplement recommendations are made based on published clinical protocols and are not influenced by affiliate relationships. We only link to products we believe are appropriate for the GLP-1 patient population.
            </p>
          </section>

          {/* 5. GDPR */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-3">5. Your Rights Under GDPR (EU/EEA Users)</h2>
            <p className="mb-3">If you are located in the European Union or European Economic Area, you have the following rights under the General Data Protection Regulation (GDPR):</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li><span className="font-medium text-slate-700">Right of access:</span> you may request a copy of the personal data we hold about you</li>
              <li><span className="font-medium text-slate-700">Right to rectification:</span> you may request correction of inaccurate data</li>
              <li><span className="font-medium text-slate-700">Right to erasure:</span> you may request deletion of your personal data</li>
              <li><span className="font-medium text-slate-700">Right to data portability:</span> you may request your data in a structured, machine-readable format</li>
              <li><span className="font-medium text-slate-700">Right to restrict processing:</span> you may request that we limit how we use your data</li>
              <li><span className="font-medium text-slate-700">Right to object:</span> you may object to processing based on legitimate interests</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at <a href="mailto:privacy@myoguard.com" className="text-teal-600 hover:underline">privacy@myoguard.com</a>. We will respond within 30 days.
            </p>
          </section>

          {/* 6. CCPA */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-3">6. Your Rights Under CCPA (California Users)</h2>
            <p className="mb-3">If you are a California resident, the California Consumer Privacy Act (CCPA) grants you the following rights:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li><span className="font-medium text-slate-700">Right to know:</span> you may request disclosure of the categories and specific pieces of personal information we have collected about you</li>
              <li><span className="font-medium text-slate-700">Right to delete:</span> you may request deletion of your personal information</li>
              <li><span className="font-medium text-slate-700">Right to opt-out:</span> we do not sell personal information, so no opt-out is required</li>
              <li><span className="font-medium text-slate-700">Right to non-discrimination:</span> we will not discriminate against you for exercising your CCPA rights</li>
            </ul>
            <p className="mt-3">
              To submit a CCPA request, contact <a href="mailto:privacy@myoguard.com" className="text-teal-600 hover:underline">privacy@myoguard.com</a>.
            </p>
          </section>

          {/* 7. Data Retention */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-3">7. Data Retention</h2>
            <p>
              Email addresses collected through the protocol delivery feature are retained for a maximum of 12 months from the date of submission. After this period, email addresses are permanently deleted from our systems unless you have actively re-engaged with our service.
            </p>
            <p className="mt-3">
              Calculator inputs (weight, dose, symptoms, etc.) are processed in-browser and are not stored on our servers beyond what is necessary to generate and deliver your protocol.
            </p>
            <p className="mt-3">
              You may request early deletion of your data at any time by contacting <a href="mailto:privacy@myoguard.com" className="text-teal-600 hover:underline">privacy@myoguard.com</a>.
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
                <a href="mailto:privacy@myoguard.com" className="text-teal-600 hover:underline">privacy@myoguard.com</a>
              </p>
            </div>
          </section>

          {/* 9. Governing Law */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-3">9. Governing Law</h2>
            <p>
              This Privacy Policy is governed by and construed in accordance with the laws of the Republic of Trinidad and Tobago. Any disputes arising from this policy shall be subject to the exclusive jurisdiction of the courts of Trinidad and Tobago.
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
            className="inline-block bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors"
          >
            ← Back to Calculator
          </a>
        </div>

        <p className="mt-6 text-xs text-slate-400 text-center">
          © 2026 MyoGuard Protocol · Dr. B, MBBS · Governing law: Trinidad and Tobago
        </p>
      </div>
    </main>
  );
}
