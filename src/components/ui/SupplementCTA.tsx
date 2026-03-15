/**
 * Supplement affiliate CTA — verbatim from app/page.tsx lines 371–385.
 */
export default function SupplementCTA() {
  return (
    <div className="bg-teal-600 rounded-2xl p-5 text-white mb-6">
      <p className="font-semibold text-sm mb-1">Recommended Supplements</p>
      <p className="text-teal-100 text-xs leading-relaxed mb-3">
        Professional-grade products curated using published clinical protocols for GLP-1 patients. Thorne and iHerb selections.
      </p>
      <a
        href="https://api-comms.iherb.com/gateway/comms/ct?pl=qkZ8DA0slJ0u7dcv5Pi4oWEnPkGns9a_rhHjdya7gGbAWGlkC1br2hy8cjWKNlSikMBDaRoXdIWLfdOdacFttmU3QRqmpI3R7bzdW8z2uZIV-y1zfjUjmjTHbNHWiwlENV8XVAlnmf0fSTeQjbuXjyJjdwZkTdbJcwxXdLhA1VOQGZ4w2R8F58FMRi5InRtxMqkSwbYYvOM0Kp_OBD5aTyRivFcYbmZWa3RKbQe16BEbmyYv3yqzhFZKoXlJs1cScqVqv6VKTFer_6WTNZeujnX9SulVittb02xsbtBVEDbrBcL4LYT0YKQsjsaY3Q%3d%3d"
        target="_blank"
        rel="noopener noreferrer"
        className="bg-white text-teal-700 font-semibold text-sm px-4 py-2 rounded-lg hover:bg-teal-50 transition-colors inline-block"
      >
        View Supplement Stack →
      </a>
    </div>
  );
}
