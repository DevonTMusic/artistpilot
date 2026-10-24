# Neon setup

Neon stores application accounts and structured app data. Supabase remains optional but is required for shared Studio project files; see [`../supabase/README.md`](../supabase/README.md).

## Configure the app

Create a Neon Postgres project and configure these environment variables in `.env.local` and in Vercel for **Production**, **Preview**, and **Development** as needed:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string. Use the direct connection string for the schema migration. |
| `BETTER_AUTH_SECRET` | A private random secret of at least 32 characters. Generate one with `openssl rand -base64 32`; keep it out of source control. |
| `BETTER_AUTH_URL` | The app's origin, such as `http://localhost:3000` locally or `https://artistpilot.com` in production. Do not append `/api/auth`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL, only needed for shared Studio file storage. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key, only needed for shared Studio file storage. Keep it server-only. |
| `GEMINI_API_KEY` | Server-side key for the AI music coach. |
| `STRIPE_SECRET_KEY` | Server-side Stripe secret key. |
| `STRIPE_WEBHOOK_SECRET` | Secret for the Stripe webhook endpoint. |
| `STRIPE_PRICE_ID` | Stripe recurring price used for the ArtistPilot subscription. |
| `STRIPE_AI_CREDITS_100_PRICE_ID` | Stripe one-time price for the 100-credit pack. |
| `STRIPE_AI_CREDITS_250_PRICE_ID` | Stripe one-time price for the 250-credit pack. |

Use separate Neon databases (or branches) for development and production. Never commit connection strings or API keys.

## Create the database schema

From the repository root, with `DATABASE_URL` set:

1. Generate Better Auth's account/session tables:

   ```bash
   npx auth@latest migrate --config ./lib/auth/server.ts
   ```

2. In the Neon SQL Editor, run [`neon-schema.sql`](./neon-schema.sql). It creates profiles, lesson progress, AI usage and credit tables/functions, and shared Studio collaboration metadata. Run Better Auth's migration first because this schema references its `"user"` table.
3. Deploy the app. New account sign-ups create their profile in Neon. Users from the old Supabase Auth database must register again; their old passwords/accounts are not copied.

## Seed the grader demo account

After the app is deployed with the production environment variables and schema above, run `npm run seed` from the repository root with `.env.local` containing the production `DATABASE_URL` and `BETTER_AUTH_URL`. The script creates or signs in to `demo@demo.com` with password `password123!`, then grants that account paid access in Neon. If that email already exists with a different password, the script stops with an error instead of pretending the grader credentials are ready.

Verify that the account signs in at the deployed app and that its profile has `is_paid = true` in Neon's `profiles` table.
