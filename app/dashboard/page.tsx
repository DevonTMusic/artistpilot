import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import IdeaLab from "@/components/IdeaLab";
import { supabaseServer } from "@/lib/supabase/server";
export default async function Dashboard({ searchParams }: { searchParams: Promise<{ paid?: string; credits?: string }> }) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await sb.from("profiles").select("is_paid").eq("id", user.id).single();
  const sp = await searchParams;
  return (<>
    <Nav signedIn />
    <main className="mx-auto max-w-5xl px-5 py-12">
      <h1 className="text-3xl font-extrabold">AI Idea Lab</h1>
      <p className="mb-8 mt-2 max-w-xl text-zinc-400">Describe your idea. The coach asks questions and gives hints so you build it yourself.</p>
      {sp.credits === "success" && <p role="status" className="mb-5 max-w-2xl rounded-lg border border-emerald-900 bg-emerald-950/30 p-3 text-sm text-emerald-200">Payment received. Your prepaid AI credits will appear after Stripe confirms it; refresh in a moment if the balance has not updated.</p>}
      {sp.credits === "cancelled" && <p role="status" className="mb-5 max-w-2xl rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-300">Checkout was cancelled. You have not been charged.</p>}
      {p?.is_paid ? <IdeaLab /> : (
        <div className="max-w-md rounded-2xl border border-violet-500 bg-zinc-900 p-8">
          {sp.paid ? <p className="mb-4 text-amber-300">Payment received. Your access turns on in a few seconds. Refresh this page.</p> : null}
          <h2 className="text-2xl font-bold">ArtistPilot Pro — $15/month</h2>
          <p className="mt-2 text-zinc-400">Subscribe to unlock the AI Idea Lab. Billed monthly through Stripe.</p>
          <form action="/api/checkout" method="post"><button className="mt-6 w-full rounded-xl bg-gradient-to-r from-violet-500 to-blue-500 py-3 font-bold">Get Started — $15/month</button></form>
        </div>
      )}
    </main>
  </>);
}
