import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const body = await req.text();
  let ev: Stripe.Event;
  try { ev = getStripe().webhooks.constructEvent(body, req.headers.get("stripe-signature")!, process.env.STRIPE_WEBHOOK_SECRET!); }
  catch { return new Response("Bad signature", { status: 400 }); }
  const db = supabaseAdmin();
  if (ev.type === "checkout.session.completed") {
    const s = ev.data.object as Stripe.Checkout.Session;
    if (s.client_reference_id) await db.from("profiles").update({ is_paid: true, stripe_customer_id: s.customer as string }).eq("id", s.client_reference_id);
  }
  if (ev.type === "customer.subscription.deleted") {
    const sub = ev.data.object as Stripe.Subscription;
    await db.from("profiles").update({ is_paid: false }).eq("stripe_customer_id", sub.customer as string);
  }
  return new Response("ok");
}
