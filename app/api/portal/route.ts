import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`, 303);
  const { data: p } = await sb.from("profiles").select("stripe_customer_id").eq("id", user.id).single();
  if (!p?.stripe_customer_id) return NextResponse.redirect(`${origin}/settings`, 303);
  const s = await getStripe().billingPortal.sessions.create({ customer: p.stripe_customer_id, return_url: `${origin}/settings` });
  return NextResponse.redirect(s.url, 303);
}
