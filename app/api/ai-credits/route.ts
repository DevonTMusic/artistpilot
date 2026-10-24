import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { query } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

const FREE_MONTHLY_REQUESTS = 50;
const GLOBAL_MONTHLY_REQUESTS = 500;
const CREDIT_PACKS = {
  "100": { credits: 100, priceId: () => process.env.STRIPE_AI_CREDITS_100_PRICE_ID },
  "250": { credits: 250, priceId: () => process.env.STRIPE_AI_CREDITS_250_PRICE_ID },
} as const;

export async function GET() {
  const { user } = (await getCurrentSession()) ?? {};
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  let profile: { is_paid: boolean } | undefined;
  try {
    ({ rows: [profile] } = await query<{ is_paid: boolean }>("select is_paid from profiles where id = $1", [user.id]));
  } catch (error) {
    console.error("Could not verify AI credits subscription:", error);
    return NextResponse.json({ error: "Could not verify your subscription." }, { status: 500 });
  }
  if (!profile?.is_paid) return NextResponse.json({ error: "An active ArtistPilot Pro subscription is required." }, { status: 403 });
  if (!process.env.DATABASE_URL) {
    console.error("AI credit balance is missing DATABASE_URL.");
    return NextResponse.json({ error: "AI credit balance is temporarily unavailable." }, { status: 503 });
  }

  const now = new Date();
  const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  try {
    const [usage, credits, global] = await Promise.all([
      query<{ free_request_count: number }>("select free_request_count from gemini_coach_usage where user_id = $1 and month_start = $2", [user.id, monthStart]),
      query<{ balance: number }>("select balance from gemini_coach_credits where user_id = $1", [user.id]),
      query<{ request_count: number }>("select request_count from gemini_coach_global_usage where month_start = $1", [monthStart]),
    ]);
    return NextResponse.json({
      usage: {
        freeUsed: usage.rows[0]?.free_request_count ?? 0,
        freeLimit: FREE_MONTHLY_REQUESTS,
        creditsRemaining: credits.rows[0]?.balance ?? 0,
        globalLimitReached: (global.rows[0]?.request_count ?? 0) >= GLOBAL_MONTHLY_REQUESTS,
      },
    });
  } catch (error) {
    console.error("Could not read AI credit balance:", error);
    return NextResponse.json({ error: "AI credit balance is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const { user } = (await getCurrentSession()) ?? {};
  if (!user) return NextResponse.json({ error: "Please log in to buy AI credits." }, { status: 401 });

  let profile: { is_paid: boolean; stripe_customer_id: string | null } | undefined;
  try {
    ({ rows: [profile] } = await query<{ is_paid: boolean; stripe_customer_id: string | null }>(
      "select is_paid, stripe_customer_id from profiles where id = $1", [user.id],
    ));
  } catch (error) {
    console.error("Could not verify AI credit purchase eligibility:", error);
    return NextResponse.json({ error: "Could not verify your subscription." }, { status: 500 });
  }
  if (!profile?.is_paid) return NextResponse.json({ error: "An active ArtistPilot Pro subscription is required." }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Choose a valid AI credit pack." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("pack" in body) || (body.pack !== "100" && body.pack !== "250")) {
    return NextResponse.json({ error: "Choose a valid AI credit pack." }, { status: 400 });
  }

  const pack = CREDIT_PACKS[body.pack];
  const priceId = pack.priceId();
  if (!priceId) {
    console.error(`Stripe price is not configured for the ${pack.credits}-credit AI pack.`);
    return NextResponse.json({ error: "AI credit purchases are temporarily unavailable." }, { status: 503 });
  }

  try {
    const now = new Date();
    const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const globalState = await query<{ request_count: number }>(
      "select request_count from gemini_coach_global_usage where month_start = $1", [monthStart],
    );
    if ((globalState.rows[0]?.request_count ?? 0) >= GLOBAL_MONTHLY_REQUESTS) {
      return NextResponse.json({ error: "The shared monthly AI safety limit has been reached. Credit purchases are paused until next month." }, { status: 429 });
    }
    const stripe = getStripe();
    const price = await stripe.prices.retrieve(priceId);
    const expectedAmount = pack.credits === 100 ? 500 : 1000;
    if (!price.active || price.recurring || price.currency !== "usd" || price.unit_amount !== expectedAmount) {
      console.error(`Stripe price configuration is invalid for the ${pack.credits}-credit AI pack.`);
      return NextResponse.json({ error: "AI credit purchases are temporarily unavailable." }, { status: 503 });
    }
    const origin = new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      ...(profile.stripe_customer_id
        ? { customer: profile.stripe_customer_id }
        : user.email ? { customer_email: user.email } : {}),
      client_reference_id: user.id,
      metadata: {
        purchase_type: "ai_credits",
        credits: String(pack.credits),
        user_id: user.id,
      },
      payment_intent_data: {
        metadata: {
          purchase_type: "ai_credits",
          credits: String(pack.credits),
          user_id: user.id,
        },
      },
      success_url: `${origin}/dashboard?credits=success`,
      cancel_url: `${origin}/dashboard?credits=cancelled`,
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Could not start AI credit checkout:", error);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
  }
}
