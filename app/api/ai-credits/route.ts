import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

const FREE_MONTHLY_REQUESTS = 50;
const GLOBAL_MONTHLY_REQUESTS = 500;
const CREDIT_PACKS = {
  "100": { credits: 100, priceId: () => process.env.STRIPE_AI_CREDITS_100_PRICE_ID },
  "250": { credits: 250, priceId: () => process.env.STRIPE_AI_CREDITS_250_PRICE_ID },
} as const;

export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_paid")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: "Could not verify your subscription." }, { status: 500 });
  if (!profile?.is_paid) return NextResponse.json({ error: "An active ArtistPilot Pro subscription is required." }, { status: 403 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("AI credit balance is missing SUPABASE_SERVICE_ROLE_KEY.");
    return NextResponse.json({ error: "AI credit balance is temporarily unavailable." }, { status: 503 });
  }

  const now = new Date();
  const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  try {
    const admin = supabaseAdmin();
    const [usage, credits, global] = await Promise.all([
      admin.from("gemini_coach_usage").select("free_request_count").eq("user_id", user.id).eq("month_start", monthStart).maybeSingle(),
      admin.from("gemini_coach_credits").select("balance").eq("user_id", user.id).maybeSingle(),
      admin.from("gemini_coach_global_usage").select("request_count").eq("month_start", monthStart).maybeSingle(),
    ]);
    const error = usage.error ?? credits.error ?? global.error;
    if (error) {
      console.error("Could not read AI credit balance:", error);
      return NextResponse.json({ error: "AI credit balance is temporarily unavailable." }, { status: 503 });
    }
    return NextResponse.json({
      usage: {
        freeUsed: usage.data?.free_request_count ?? 0,
        freeLimit: FREE_MONTHLY_REQUESTS,
        creditsRemaining: credits.data?.balance ?? 0,
        globalLimitReached: (global.data?.request_count ?? 0) >= GLOBAL_MONTHLY_REQUESTS,
      },
    });
  } catch (error) {
    console.error("Could not read AI credit balance:", error);
    return NextResponse.json({ error: "AI credit balance is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in to buy AI credits." }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_paid, stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    console.error("Could not verify AI credit purchase eligibility:", profileError);
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
    const admin = supabaseAdmin();
    const [creditState, globalState] = await Promise.all([
      admin.from("gemini_coach_credits").select("balance").eq("user_id", user.id).maybeSingle(),
      admin.from("gemini_coach_global_usage").select("request_count").eq("month_start", monthStart).maybeSingle(),
    ]);
    const quotaError = creditState.error ?? globalState.error;
    if (quotaError) {
      console.error("Could not verify AI credit purchase setup:", quotaError);
      return NextResponse.json({ error: "AI credit purchases are temporarily unavailable." }, { status: 503 });
    }
    if ((globalState.data?.request_count ?? 0) >= GLOBAL_MONTHLY_REQUESTS) {
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
