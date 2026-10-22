import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
const DEMO = "demo@demo.com";
export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user || !user.email) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await req.json();
  const admin = supabaseAdmin();
  if (user.email === DEMO) return NextResponse.json({ error: "The shared demo account can't be changed or deleted." }, { status: 403 });

  if (b.action === "password") {
    if (typeof b.current !== "string" || typeof b.next !== "string" || b.next.length < 8) return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
    const check = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { error: bad } = await check.auth.signInWithPassword({ email: user.email, password: b.current });
    if (bad) return NextResponse.json({ error: "Your current password is not correct." }, { status: 400 });
    const { error } = await admin.auth.admin.updateUserById(user.id, { password: b.next });
    if (error) return NextResponse.json({ error: "Could not change your password." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "delete") {
    if (b.confirm !== "DELETE") return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });
    const { data: p } = await admin.from("profiles").select("stripe_customer_id").eq("id", user.id).single();
    if (p?.stripe_customer_id) {
      try {
        const stripe = getStripe();
        const subs = await stripe.subscriptions.list({ customer: p.stripe_customer_id, status: "active" });
        for (const s of subs.data) await stripe.subscriptions.cancel(s.id);
      } catch { return NextResponse.json({ error: "Could not cancel your subscription, so your account was not deleted. Cancel it under Manage billing first." }, { status: 502 }); }
    }
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return NextResponse.json({ error: "Could not delete your account." }, { status: 500 });
    await sb.auth.signOut();
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown request." }, { status: 400 });
}
