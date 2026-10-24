# Supabase and provider setup

## AI coach usage cap

1. Run `gemini_free_usage.sql` in the Supabase SQL Editor for the production project and any development project.
2. Run `gemini_prepaid_credits.sql` after it. It adds a per-user prepaid balance and webhook-idempotent purchases. Requests are reserved atomically; failed Gemini requests are refunded. Both migrations must be applied for the coach to work.
3. Add `GEMINI_API_KEY` to the server environment. The app pins requests to `gemini-2.5-flash-lite`; do not add a model override.
4. Subscribers get 50 coach requests per UTC month. Extra requests use one prepaid credit each. Credit packs cost $5 for 100 credits or $10 for 250 credits; purchased credits do not expire. There is also a hard shared safety cap of 500 AI requests across the whole app per UTC month.
5. In Stripe, create active, one-time USD prices of exactly $5.00 and $10.00 for the two packs. Set their Price IDs as `STRIPE_AI_CREDITS_100_PRICE_ID` and `STRIPE_AI_CREDITS_250_PRICE_ID`. The checkout route rejects prices that do not match those amounts. Make sure the existing Stripe webhook URL subscribes to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `customer.subscription.deleted`; otherwise purchased credits will not be delivered.
6. Use a Gemini API key/project confirmed as eligible for Google's no-cost tier. An application quota does not change Google's billing settings or guarantee that a project is on a free tier. Configure provider-side budget alerts and billing controls separately; Google may change free-tier eligibility and terms.

Prepaid billing collects payment before extra AI requests, but it cannot guarantee that the business has zero costs: Stripe processing fees are deducted from the merchant's payout, and taxes, refunds, disputes, and provider pricing may also apply. The listed prices are customer charges, not a guarantee of a particular net payout.

## Shared Studio storage

Run `studio_storage_limits.sql` to cap each shared project/revision upload at 25 MiB. The app removes the previous project file after a successful revision save so revisions do not grow storage indefinitely. This does not cap total Supabase storage, database, bandwidth, or hosting usage; set provider-side limits/alerts and review your plan.
