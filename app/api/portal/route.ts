import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { query } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  const { user } = (await getCurrentSession()) ?? {};
  if (!user) return NextResponse.redirect(`${origin}/login`, 303);
  const { rows: [p] } = await query<{ stripe_customer_id: string | null }>("select stripe_customer_id from profiles where id = $1", [user.id]);
  if (!p?.stripe_customer_id) return NextResponse.redirect(`${origin}/settings`, 303);
  const s = await getStripe().billingPortal.sessions.create({ customer: p.stripe_customer_id, return_url: `${origin}/settings` });
  return NextResponse.redirect(s.url, 303);
}
