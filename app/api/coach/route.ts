import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const USER_MONTHLY_REQUEST_LIMIT = 50;
const GLOBAL_MONTHLY_REQUEST_LIMIT = 500;

const SYSTEM = `You are ArtistPilot's music coach. Help the musician develop THEIR OWN idea.
Never write a finished song, full lyrics, or a complete arrangement. Instead: ask 1-2 clarifying questions, explain relevant theory in plain language, offer 2-3 concrete options to try (chord substitutions, rhythm ideas, bassline approaches, groove variations), and give one small exercise. Keep answers under 250 words.`;
export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const { data: p } = await sb.from("profiles").select("is_paid").eq("id", user.id).single();
  if (!p?.is_paid) return NextResponse.json({ error: "ArtistPilot Pro is required." }, { status: 402 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid coach request." }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid coach request." }, { status: 400 });
  const { instrument, message, context } = body as Record<string, unknown>;
  if (typeof message !== "string" || !message.trim() || message.length > 1000) return NextResponse.json({ error: "Write a message under 1000 characters." }, { status: 400 });
  if (context !== undefined && (typeof context !== "string" || context.length > 300)) {
    return NextResponse.json({ error: "Studio context is invalid." }, { status: 400 });
  }
  if (!process.env.GEMINI_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("AI coach is missing GEMINI_API_KEY or SUPABASE_SERVICE_ROLE_KEY.");
    return NextResponse.json({ error: "The AI coach is temporarily unavailable. Please try again later." }, { status: 503 });
  }
  const requestId = randomUUID();
  let quota: {
    allowed: boolean;
    user_used: number;
    global_used: number;
    credits_remaining: number;
    charged_credit: boolean;
    reservation_id: string | null;
  } | null = null;
  let quotaError: { message: string } | null = null;
  try {
    const result = await supabaseAdmin().rpc("reserve_gemini_coach_request", {
      p_user_id: user.id,
      p_user_limit: USER_MONTHLY_REQUEST_LIMIT,
      p_global_limit: GLOBAL_MONTHLY_REQUEST_LIMIT,
      p_request_id: requestId,
    }).single();
    quotaError = result.error;
    const reserved = result.data;
    if (reserved && typeof reserved === "object") {
      const value = reserved as Record<string, unknown>;
      if (
        typeof value.allowed === "boolean" &&
        typeof value.user_used === "number" &&
        typeof value.global_used === "number" &&
        typeof value.credits_remaining === "number" &&
        typeof value.charged_credit === "boolean" &&
        (typeof value.reservation_id === "string" || value.reservation_id === null)
      ) {
        quota = {
          allowed: value.allowed,
          user_used: value.user_used,
          global_used: value.global_used,
          credits_remaining: value.credits_remaining,
          charged_credit: value.charged_credit,
          reservation_id: value.reservation_id,
        };
      }
    }
  } catch (error) {
    console.error("Could not reserve Gemini coach usage:", error);
    return NextResponse.json({ error: "The AI coach is temporarily unavailable. Please try again later." }, { status: 503 });
  }
  if (quotaError) {
    console.error("Could not reserve Gemini coach usage:", quotaError?.message);
    return NextResponse.json({ error: "The AI coach is temporarily unavailable. Please try again later." }, { status: 503 });
  }
  if (!quota) {
    console.error("Gemini usage reservation returned an invalid result.");
    return NextResponse.json({ error: "The AI coach is temporarily unavailable. Please try again later." }, { status: 503 });
  }
  if (!quota.allowed) {
    const globalLimitReached = quota.global_used >= GLOBAL_MONTHLY_REQUEST_LIMIT;
    return NextResponse.json({
      error: globalLimitReached
        ? "The AI coach has reached this month's shared usage limit. It will be available again next month."
        : "You have used your 50 included AI requests and have no prepaid credits. Buy a credit pack to continue.",
      usage: {
        freeUsed: quota.user_used,
        freeLimit: USER_MONTHLY_REQUEST_LIMIT,
        creditsRemaining: quota.credits_remaining,
        globalLimitReached,
      },
    }, { status: globalLimitReached ? 429 : 402 });
  }
  if (!quota.reservation_id) {
    console.error("Gemini usage reservation did not include a reservation ID.");
    return NextResponse.json({ error: "The AI coach is temporarily unavailable. Please try again later." }, { status: 503 });
  }
  const admin = supabaseAdmin();
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{
          role: "user",
          parts: [{ text: `Instrument: ${typeof instrument === "string" ? instrument.slice(0, 40) : "general"}\n${context ? `Studio context: ${context}\n` : ""}${message}` }],
        }],
        generationConfig: { maxOutputTokens: 700 },
      }),
    });
    if (!r.ok) throw new Error(r.status + " " + (await r.text()));
    const j = await r.json();
    const text = (j.candidates?.[0]?.content?.parts ?? []).map((x: { text?: string }) => x.text ?? "").join("");
    if (!text) throw new Error("empty");
    try {
      const { error: completionError } = await admin.rpc("complete_gemini_coach_request", { p_request_id: quota.reservation_id });
      if (completionError) console.error("Could not complete Gemini usage reservation:", completionError);
    } catch (completionError) {
      console.error("Could not complete Gemini usage reservation:", completionError);
    }
    return NextResponse.json({
      text,
      usage: {
        freeUsed: quota.user_used,
        freeLimit: USER_MONTHLY_REQUEST_LIMIT,
        creditsRemaining: quota.credits_remaining,
        chargedCredit: quota.charged_credit,
        globalLimitReached: false,
      },
    });
  } catch (e) {
    try {
      const { error: refundError } = await admin.rpc("refund_gemini_coach_request", { p_request_id: quota.reservation_id });
      if (refundError) console.error("Could not refund failed Gemini usage reservation:", refundError);
    } catch (refundError) {
      console.error("Could not refund failed Gemini usage reservation:", refundError);
    }
    console.error("coach error:", e);
    return NextResponse.json({ error: "The coach is unavailable right now. Try again in a minute." }, { status: 502 });
  }
}
