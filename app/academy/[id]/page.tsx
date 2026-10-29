import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import { AcademyLessonPlayer } from "@/components/AcademyLessonPlayer";
import { requireUser } from "@/lib/access";
import { LESSONS, isFreeLesson, lessonById } from "@/lib/lessons";
import { getLocale, translate } from "@/lib/i18n/server";
import { spanishLessons } from "@/lib/i18n/lessonTranslations";
import { query } from "@/lib/db";
export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lesson = lessonById(id);
  if (!lesson) notFound();
  const { user, isPro } = await requireUser();
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  if (!isPro && !isFreeLesson(id)) {
    return (<>
      <Nav signedIn />
      <main className="mx-auto max-w-2xl px-5 py-12">
        <Link href="/academy" className="text-sm text-zinc-300 hover:text-white">{t("lesson.backAcademy")}</Link>
        <div className="mt-6 rounded-2xl border border-amber-500 bg-zinc-900 p-8">
          <h1 className="text-2xl font-extrabold">{t("academy.lockedTitle")}</h1>
          <p className="mt-2 text-zinc-300">{t("academy.lockedText")}</p>
          <Link href="/dashboard" className="mt-5 inline-block rounded-lg bg-amber-500 text-zinc-950 hover:bg-amber-400 px-4 py-2 font-bold">{t("home.seePlan")}</Link>
        </div>
      </main>
    </>);
  }
  const localizedLesson = locale === "es" ? spanishLessons[id] ?? lesson : lesson;
  const { rows } = await query<{ lesson_id: string }>("select lesson_id from lesson_progress where user_id = $1 and lesson_id = $2", [user.id, id]);
  const instrumentLessons = LESSONS.filter((candidate) => candidate.instrument === lesson.instrument);
  const lessonIndex = instrumentLessons.findIndex((candidate) => candidate.id === lesson.id);
  return (<>
    <Nav signedIn />
    <main className="mx-auto max-w-2xl px-5 py-12">
      <Link href="/academy" className="text-sm text-zinc-300 hover:text-white">{t("lesson.backAcademy")}</Link>
      <p className="mt-6 text-sm text-amber-200">{localizedLesson.instrument}</p>
      <h1 className="mb-6 text-3xl font-extrabold">{localizedLesson.title}</h1>
      <AcademyLessonPlayer
        lesson={lesson}
        previousId={instrumentLessons[lessonIndex - 1]?.id}
        nextId={instrumentLessons[lessonIndex + 1]?.id}
        done={rows.length > 0}
      />
      <p className="mt-6 text-sm text-zinc-300">
        {t("lesson.studioHintBefore")}{" "}
        <Link className="underline" href="/studio">{locale === "es" ? "Estudio" : "Studio"}</Link>{" "}
        {t("lesson.studioHintAfter")}
      </p>
    </main>
  </>);
}
