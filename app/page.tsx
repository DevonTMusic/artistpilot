import Link from "next/link";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import { GuitarArt, IdeaArt, MicArt, StudioArt } from "@/components/Art";
import { supabaseServer } from "@/lib/supabase/server";
const cta = "inline-block rounded-xl bg-gradient-to-r from-violet-500 to-blue-500 px-6 py-3 font-bold";
export default async function Home() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (user) redirect("/home");
  const ways = [
    ["Learn an instrument", "Guitar, piano, bass, drums, ukulele, violin and vocals, one small lesson at a time.", <GuitarArt key="g" className="mx-auto h-44 w-auto" />],
    ["Make your own music", "An AI coach gives you hints and ideas. You write the song.", <IdeaArt key="i" className="mx-auto h-44 w-auto" />],
    ["Record your song", "Layer tracks, add a beat, mix it and export it.", <MicArt key="m" className="mx-auto h-44 w-auto" />],
  ];
  return (<>
    <Nav />
    <main>
      <section className="mx-auto grid max-w-5xl items-center gap-10 px-5 py-16 md:grid-cols-2">
        <div>
          <h1 className="text-4xl font-extrabold leading-tight md:text-6xl">Learn Music. Create Your Sound. Grow Your Career.</h1>
          <p className="mt-5 text-lg text-zinc-400">Whether you are picking up your first chord or ready to record your first song, ArtistPilot is a friendly place to learn, create and grow. The AI coaches you. The music stays yours.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className={cta}>Get Started — $15/month</Link>
            <Link href="/login" className="inline-block rounded-xl border border-zinc-700 px-6 py-3 font-bold">Log in</Link>
          </div>
        </div>
        <StudioArt className="w-full drop-shadow-[0_20px_60px_rgba(139,92,246,0.35)]" />
      </section>
      <section className="mx-auto max-w-5xl px-5 py-12">
        <h2 className="text-3xl font-extrabold">Three ways to begin</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {ways.map(([t, d, art]) => (
            <Link key={String(t)} href="/signup" className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 transition hover:-translate-y-1 hover:border-violet-500">
              <div className="bg-gradient-to-br from-violet-900/30 to-blue-900/20 p-4">{art}</div>
              <div className="p-5"><h3 className="text-xl font-bold">{t}</h3><p className="mt-1 text-zinc-400">{d}</p></div>
            </Link>
          ))}
        </div>
      </section>
      <section id="how" className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="text-3xl font-extrabold">How it works</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[["Learn", "Improve your skills with guided lessons and practical exercises."], ["Create and record", "Develop original ideas with your AI coach and bring them to life in the studio."], ["Promote and grow", "Marketing tools for bios, captions and release planning are coming soon."]].map(([t, d], i) => (
            <div key={t} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="mb-3 grid h-9 w-9 place-items-center rounded-full bg-gradient-to-r from-violet-500 to-blue-500 font-bold">{i + 1}</div>
              <h3 className="text-xl font-bold">{t}</h3><p className="mt-1 text-zinc-400">{d}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-lg">ArtistPilot helps you build your own skills and creative independence.</p>
      </section>
      <section id="pricing" className="mx-auto max-w-5xl px-5 pb-24 pt-8">
        <h2 className="text-3xl font-extrabold">One simple plan</h2>
        <div className="mt-8 max-w-md rounded-2xl border border-violet-500 bg-zinc-900 p-8">
          <h3 className="text-2xl font-bold">ArtistPilot Pro</h3>
          <p className="mt-2 text-5xl font-extrabold">$15<span className="text-lg font-medium text-zinc-400">/month</span></p>
          <p className="mt-1 text-zinc-400">Billed monthly. Cancel anytime from Settings.</p>
          <ul className="mt-5 space-y-2 text-zinc-300"><li>Instrument Academy with seven instruments</li><li>AI Idea Lab</li><li>Recording studio with up to 12 tracks, session files you keep on your own device, and WAV export</li><li>Lesson progress saved to your account</li></ul>
          <Link href="/signup" className={cta + " mt-6 w-full text-center"}>Get Started — $15/month</Link>
        </div>
      </section>
    </main>
    <footer className="border-t border-zinc-800 py-8 text-center text-sm text-zinc-500">© {new Date().getFullYear()} ArtistPilot. All rights reserved.</footer>
  </>);
}
