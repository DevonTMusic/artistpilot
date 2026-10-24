import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { auth } from "@/lib/auth/server";
import { query } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
const DEMO = "demo@demo.com";
export async function POST(req: Request) {
  const { user } = (await getCurrentSession()) ?? {};
  if (!user || !user.email) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await req.json();
  if (user.email === DEMO) return NextResponse.json({ error: "The shared demo account can't be changed or deleted." }, { status: 403 });

  if (b.action === "password") {
    if (typeof b.current !== "string" || typeof b.next !== "string" || b.next.length < 8) return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
    try {
      await auth.api.changePassword({
        body: { currentPassword: b.current, newPassword: b.next },
        headers: req.headers,
      });
      return NextResponse.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.toLowerCase().includes("password")) {
        return NextResponse.json({ error: "Your current password is not correct." }, { status: 400 });
      }
      console.error("Could not change account password:", error);
      return NextResponse.json({ error: "Could not change your password." }, { status: 500 });
    }
  }

  if (b.action === "delete") {
    if (b.confirm !== "DELETE") return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });
    const { rows: [p] } = await query<{ stripe_customer_id: string | null }>(
      "select stripe_customer_id from profiles where id = $1", [user.id],
    );
    if (p?.stripe_customer_id) {
      try {
        const stripe = getStripe();
        const subs = await stripe.subscriptions.list({ customer: p.stripe_customer_id, status: "active" });
        for (const s of subs.data) await stripe.subscriptions.cancel(s.id);
      } catch { return NextResponse.json({ error: "Could not cancel your subscription, so your account was not deleted. Cancel it under Manage billing first." }, { status: 502 }); }
    }
    await query('delete from "user" where id = $1', [user.id]);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown request." }, { status: 400 });
}
