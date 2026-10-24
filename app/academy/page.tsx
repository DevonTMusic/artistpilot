import Link from "next/link";
import Nav from "@/components/Nav";
import { requirePaid } from "@/lib/access";
import { INSTRUMENTS, LESSONS } from "@/lib/lessons";
export default async function Academy() {
  const { sb, user } = await requirePaid();
  const { data } = await sb.from("lesson_progress").select("lesson_id").eq("user_id", user.id);
  const done = new Set((data ?? []).map((d) => d.lesson_id));
  return (<>
    <Nav signedIn />
    <main className="mx-auto max-w-5xl px-5 py-12">
      <h1 className="text-3xl font-extrabold">Instrument Academy</h1>
      <p className="mb-8 mt-2 max-w-xl text-zinc-400">Choose an instrument and follow short guided lessons with playable reference tones, visual chord guides, practice steps, and a live tuner for pitched instruments. Your lesson progress is saved to your account.</p>
      <div className="grid gap-5 md:grid-cols-2">
        {INSTRUMENTS.map((inst) => {
          const ls = LESSONS.filter((l) => l.instrument === inst);
          const n = ls.filter((l) => done.has(l.id)).length;
          const nextLesson = ls.find((lesson) => !done.has(lesson.id)) ?? ls[0];
          return (<section key={inst} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-baseline justify-between gap-2"><h2 className="text-xl font-bold">{inst}</h2><span className="text-sm text-zinc-400">{n} of {ls.length} complete</span></div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800" aria-label={`${inst} course progress`}>
              <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500" style={{ width: `${ls.length ? (n / ls.length) * 100 : 0}%` }} />
            </div>
            {nextLesson && (
              <Link href={`/academy/${nextLesson.id}`} className="mt-4 inline-flex rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-500">
                {n === ls.length ? "Review course" : n > 0 ? "Continue course" : "Start course"}
              </Link>
            )}
            <ul className="mt-4 space-y-2">
              {ls.map((l) => (<li key={l.id}><Link href={`/academy/${l.id}`} className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-3 hover:border-violet-500"><span>{l.title}</span><span className="text-sm text-emerald-400">{done.has(l.id) ? "Done" : ""}</span></Link></li>))}
            </ul>
          </section>);
        })}
      </div>
    </main>
  </>);
}
