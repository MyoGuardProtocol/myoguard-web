import type { PhysicianInfo } from '@/src/types';

type ReferralBannerProps = {
  physician: PhysicianInfo | null;
  refSlug: string | null;
};

/**
 * Shown below the page headline when a ?ref= parameter is present.
 * Hidden completely when no referral is active.
 */
export default function ReferralBanner({ physician, refSlug }: ReferralBannerProps) {
  // Only render when a referral slug is active
  if (!refSlug) return null;

  const displayName = physician?.displayName ?? null;

  return (
    <div className="mb-6 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 flex items-start gap-3">
      <span className="text-teal-600 text-lg mt-0.5 flex-shrink-0">✓</span>
      <div>
        <p className="text-sm font-semibold text-teal-800">
          Physician Referral
          {displayName && (
            <span className="font-normal"> — Referred by {displayName}</span>
          )}
        </p>
        <p className="text-xs text-teal-700 mt-0.5 leading-relaxed">
          You were invited to complete this MyoGuard assessment by your physician as part of your
          GLP-1 care plan.
        </p>
      </div>
    </div>
  );
}
