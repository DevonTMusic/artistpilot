import Link from "next/link";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import { IdeaArt, MicArt, PianoArt, StudioArt } from "@/components/Art";
import { supabaseServer } from "@/lib/supabase/server";
import { LESSONS } from "@/lib/lessons";
function Tile({ href, title, text, art, locked }: { href: string; title: string; text: string; art: React.ReactNode; locked: boolean }) {
  return (
    <Link href={locked ? "/dashboard" : href} className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 transition hover:-translate-y-1 hover:border-violet-500">
      <div className="bg-gradient-to-br from-violet-900/30 to-blue-900/20 p-4">{art}</div>
      <div className="p-5">
        <h2 className="text-xl font-bold">{title}{locked && <span className="ml-2 rounded bg-violet-500/20 px-2 py-0.5 text-xs text-violet-300">Pro</span>}</h2>
        <p className="mt-1 text-zinc-400">{text}</p>
      </div>
    </Link>
  );
}
export default async function HomeHub() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).single();
  const { count } = await sb.from("lesson_progress").select("lesson_id", { count: "exact", head: true }).eq("user_id", user.id);
  const paid = !!profile?.is_paid;
  const name = profile?.display_name || user.email?.split("@")[0] || "there";
  const art = "mx-auto h-44 w-auto";
  return (<>
    <Nav signedIn />
    <main className="mx-auto max-w-5xl px-5 py-12">
      <h1 className="text-3xl font-extrabold md:text-4xl">Welcome back, {name}</h1>
      <p className="mt-2 text-zinc-400">What would you like to do today?</p>
      {!paid && (
        <div className="mt-6 rounded-2xl border border-violet-500 bg-zinc-900 p-5">
          <p className="font-bold">Unlock everything with ArtistPilot Pro</p>
          <p className="text-zinc-400">The Academy, Idea Lab and Studio are included for $15/month.</p>
          <Link href="/dashboard" className="mt-3 inline-block rounded-lg bg-gradient-to-r from-violet-500 to-blue-500 px-4 py-2 font-bold">See the plan</Link>
        </div>
      )}
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        <Tile href="/studio" title="Recording Studio" text="Record, save your sessions, mix and export your song." art={<MicArt className={art} />} locked={!paid} />
        <Tile href="/dashboard" title="AI Idea Lab" text="Get hints and ideas for riffs, chords and grooves." art={<IdeaArt className={art} />} locked={!paid} />
        <Tile href="/academy" title="Learn an Instrument" text={`Seven instruments. ${count ?? 0} of ${LESSONS.length} lessons done.`} art={<PianoArt className={art} />} locked={!paid} />
      </div>
      <div className="mt-5 grid items-center gap-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 md:grid-cols-[1fr_220px]">
        <div><h2 className="text-xl font-bold">Artist Marketing</h2><p className="mt-1 text-zinc-400">Bios, captions, content ideas and release planning. Coming soon.</p></div>
        <StudioArt className="hidden h-24 w-full md:block" />
      </div>
    </main>
  </>);
}
