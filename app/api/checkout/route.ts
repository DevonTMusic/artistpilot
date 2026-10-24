import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { getStripe } from "@/lib/stripe";
export async function POST(req: Request) {
  const { user } = (await getCurrentSession()) ?? {};
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
