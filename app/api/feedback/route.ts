import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { query } from "@/lib/db";
import { ensureFeedbackTable } from "@/lib/feedback";

const CATEGORIES = ["general", "bug", "idea", "studio", "academy"];

export async function POST(req: Request) {
  const { user } = (await getCurrentSession()) ?? {};
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const category = CATEGORIES.includes(body.category) ? body.category : "general";
  if (message.length < 3 || message.length > 2000) return NextResponse.json({ error: "Feedback must be 3-2000 characters." }, { status: 400 });
  try {
    await ensureFeedbackTable();
    const { rows } = await query<{ count: string }>("select count(*)::text as count from feedback where user_id = $1 and created_at > now() - interval '1 hour'", [user.id]);
    if (Number(rows[0]?.count ?? 0) >= 10) return NextResponse.json({ error: "Too many submissions. Try again later." }, { status: 429 });
    await query("insert into feedback (user_id, email, category, message) values ($1, $2, $3, $4)", [user.id, user.email ?? null, category, message]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Could not save feedback:", error);
    return NextResponse.json({ error: "Could not save feedback." }, { status: 500 });
  }
}
