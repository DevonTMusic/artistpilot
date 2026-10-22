import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import CompleteButton from "@/components/CompleteButton";
import { requirePaid } from "@/lib/access";
import { lessonById } from "@/lib/lessons";
export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lesson = lessonById(id);
  if (!lesson) notFound();
  const { sb, user } = await requirePaid();
  const { data } = await sb.from("lesson_progress").select("lesson_id").eq("user_id", user.id).eq("lesson_id", id);
  return (<>
    <Nav signedIn />
    <main className="mx-auto max-w-2xl px-5 py-12">
      <Link href="/academy" className="text-sm text-zinc-400 hover:text-white">Back to Academy</Link>
      <p className="mt-6 text-sm text-violet-300">{lesson.instrument}</p>
      <h1 className="mb-6 text-3xl font-extrabold">{lesson.title}</h1>
      <div className="space-y-4 text-lg leading-relaxed text-zinc-300">{lesson.body.map((p, i) => <p key={i}>{p}</p>)}</div>
      <div className="my-8 rounded-2xl border border-violet-500 bg-zinc-900 p-5"><h2 className="font-bold">Practice</h2><p className="mt-1 text-zinc-300">{lesson.practice}</p></div>
      <CompleteButton lessonId={id} done={(data ?? []).length > 0} />
      <p className="mt-6 text-sm text-zinc-400">Want a metronome or backing beat? Open the <Link className="underline" href="/studio">Studio</Link> in another tab.</p>
    </main>
  </>);
}
