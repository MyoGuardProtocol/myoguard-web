import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

/**
 * Returns a configured Stripe client, or null if STRIPE_SECRET_KEY is not set.
 * All API routes that need Stripe must check for null before proceeding.
 * This prevents build/boot errors when Stripe is not yet configured.
 */
export function getStripeClient(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;

  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-02-24.acacia",
    });
  }

  return stripeInstance;
}
