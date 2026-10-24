import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { query } from "@/lib/db";
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

  try {
    await query("select grant_gemini_coach_credits($1, $2, $3)", [session.id, userId, credits]);
  } catch (error) {
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
  if (ev.type === "checkout.session.completed") {
    const s = ev.data.object as Stripe.Checkout.Session;
    if (s.mode === "subscription" && s.client_reference_id) {
      const customerId = typeof s.customer === "string" ? s.customer : s.customer?.id;
      try {
        await query(
          "update profiles set is_paid = true, stripe_customer_id = coalesce($1, stripe_customer_id) where id = $2",
          [customerId ?? null, s.client_reference_id],
        );
      } catch (error) {
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
    try {
      await query("update profiles set is_paid = false where stripe_customer_id = $1", [sub.customer as string]);
    } catch (error) {
      console.error("Could not deactivate cancelled Stripe subscription:", error);
      return new Response("Could not deactivate subscription", { status: 500 });
    }
  }
  return new Response("ok");
}
