import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { query } from "@/lib/db";
import { isFreeLesson, lessonById } from "@/lib/lessons";
export async function POST(req: Request) {
  const { user } = (await getCurrentSession()) ?? {};
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const { lessonId } = await req.json();
  if (typeof lessonId !== "string" || !lessonById(lessonId)) return NextResponse.json({ error: "Unknown lesson." }, { status: 400 });
  if (!isFreeLesson(lessonId)) {
    const { rows: [profile] } = await query<{ is_paid: boolean }>("select is_paid from profiles where id = $1", [user.id]);
    if (!profile?.is_paid) return NextResponse.json({ error: "This lesson requires ArtistPilot Pro." }, { status: 402 });
  }
  try {
    await query("insert into lesson_progress (user_id, lesson_id) values ($1, $2) on conflict (user_id, lesson_id) do nothing", [user.id, lessonId]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Could not save lesson progress:", error);
    return NextResponse.json({ error: "Could not save progress." }, { status: 500 });
  }
}
