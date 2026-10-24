import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
export const runtime = "nodejs";

async function fulfillCreditPurchase(session: Stripe.Checkout.Session) {
  if (session.mode !== "payment" || session.payment_status !== "paid" || session.metadata?.purchase_type !== "ai_credits") {
    return null;
  }
  const userId = session.client_reference_id ?? session.metadata.user_id;
  const credits = Number(session.metadata.credits);
  if (!userId || userId !== session.metadata.user_id || ![100, 250].includes(credits)) {
    console.error("Stripe AI credit checkout has invalid metadata:", session.id);
    return new Response("Invalid AI credit purchase metadata", { status: 400 });
  }

  const { error } = await supabaseAdmin().rpc("grant_gemini_coach_credits", {
    p_checkout_session_id: session.id,
    p_user_id: userId,
    p_credits: credits,
  });
  if (error) {
    console.error("Could not grant purchased Gemini credits:", error);
    return new Response("Could not grant purchased credits", { status: 500 });
  }
  return null;
}

export async function POST(req: Request) {
  const body = await req.text();
  let ev: Stripe.Event;
  try { ev = getStripe().webhooks.constructEvent(body, req.headers.get("stripe-signature")!, process.env.STRIPE_WEBHOOK_SECRET!); }
  catch { return new Response("Bad signature", { status: 400 }); }
  const db = supabaseAdmin();
  if (ev.type === "checkout.session.completed") {
    const s = ev.data.object as Stripe.Checkout.Session;
    if (s.mode === "subscription" && s.client_reference_id) {
      const customerId = typeof s.customer === "string" ? s.customer : s.customer?.id;
      const { error } = await db.from("profiles").update({
        is_paid: true,
        ...(customerId ? { stripe_customer_id: customerId } : {}),
      }).eq("id", s.client_reference_id);
      if (error) {
        console.error("Could not activate subscription from Stripe checkout:", error);
        return new Response("Could not activate subscription", { status: 500 });
      }
    }
    const fulfillmentError = await fulfillCreditPurchase(s);
    if (fulfillmentError) return fulfillmentError;
  }
  if (ev.type === "checkout.session.async_payment_succeeded") {
    const fulfillmentError = await fulfillCreditPurchase(ev.data.object as Stripe.Checkout.Session);
    if (fulfillmentError) return fulfillmentError;
  }
  if (ev.type === "customer.subscription.deleted") {
    const sub = ev.data.object as Stripe.Subscription;
    const { error } = await db.from("profiles").update({ is_paid: false }).eq("stripe_customer_id", sub.customer as string);
    if (error) {
      console.error("Could not deactivate cancelled Stripe subscription:", error);
      return new Response("Could not deactivate subscription", { status: 500 });
    }
  }
  return new Response("ok");
}
