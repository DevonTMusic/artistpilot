import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const origin = new URL(req.url).origin;
  if (!user) return NextResponse.redirect(`${origin}/login`, 303);
  const s = await getStripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    client_reference_id: user.id,
    customer_email: user.email!,
    success_url: `${origin}/dashboard?paid=1`,
    cancel_url: `${origin}/dashboard`,
  });
  return NextResponse.redirect(s.url!, 303);
}
