import Link from "next/link";
import Nav from "@/components/Nav";
import { requireUser } from "@/lib/access";
import { getLocale, translate } from "@/lib/i18n/server";
import { THEORY_LESSONS } from "@/lib/learn/theory";
import Staff from "@/components/learn/Staff";
import NoteQuiz from "@/components/learn/NoteQuiz";
import { ChordDiagram, Tab } from "@/components/learn/TabDiagram";
import { Keyboard, NoteLengths } from "@/components/learn/TheoryVisuals";

export default async function TheoryPage() {
  const { isPro } = await requireUser();
  const locale = await getLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const es = locale === "es";
  const quizLabels = {
    title: t("theory.quizTitle"),
    prompt: t("theory.quizPrompt"),
    correct: t("theory.quizCorrect"),
    wrong: t("theory.quizWrong"),
    score: t("theory.quizScore"),
    best: t("theory.quizBest"),
  };
  const lengths = es
    ? ["Redonda: 4 pulsos", "Blanca: 2 pulsos", "Negra: 1 pulso", "Corchea: ½ pulso"]
    : ["Whole note: 4 beats", "Half note: 2 beats", "Quarter note: 1 beat", "Eighth note: ½ beat"];

  const visual = (id: string) => {
    switch (id) {
      case "sound-and-pitch": return <Keyboard />;
      case "the-staff": return (<>
        <Staff clef="treble" notes={["E4", "G4", "B4", "D5", "F5"]} caption={es ? "Notas en las 5 líneas, de abajo hacia arriba" : "Notes on the 5 lines, bottom to top"} />
        <Staff clef="treble" notes={["F4", "A4", "C5", "E5"]} caption={es ? "Notas en los 4 espacios" : "Notes in the 4 spaces"} />
        <NoteLengths labels={lengths} />
      </>);
      case "treble-clef": return (<>
        <Staff clef="treble" notes={["E4", "G4", "B4", "D5", "F5"]} labels caption="E G B D F" />
        <Staff clef="treble" notes={["F4", "A4", "C5", "E5"]} labels caption="F A C E" />
        <Staff clef="treble" notes={["C4"]} labels caption={es ? "Do central (C4)" : "Middle C (C4)"} />
        <NoteQuiz clef="treble" labels={quizLabels} />
      </>);
      case "bass-clef": return (<>
        <Staff clef="bass" notes={["G2", "B2", "D3", "F3", "A3"]} labels caption="G B D F A" />
        <Staff clef="bass" notes={["A2", "C3", "E3", "G3"]} labels caption="A C E G" />
        <NoteQuiz clef="bass" labels={quizLabels} />
      </>);
      case "rhythm-and-time": return <NoteLengths labels={lengths} />;
      case "scales-and-keys": return <Staff clef="treble" notes={["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"]} labels caption={es ? "Escala de Do mayor: solo teclas blancas" : "C major scale: white keys only"} />;
      case "guitar-tabs": return (<>
        <Tab columns={[[null, null, null, null, 3, null], [null, null, null, 0, null, null], [null, null, 0, null, null, null], [null, 1, null, null, null, null], [0, null, null, null, null, null]]} caption={es ? "Un riff sencillo: lee de izquierda a derecha, un número por nota" : "A simple riff: read left to right, one number per note"} />
        <div className="flex flex-wrap gap-3">
          <ChordDiagram name="Em" frets={[0, 2, 2, 0, 0, 0]} />
          <ChordDiagram name="C" frets={[-1, 3, 2, 0, 1, 0]} />
          <ChordDiagram name="G" frets={[3, 2, 0, 0, 0, 3]} />
          <ChordDiagram name="Am" frets={[-1, 0, 2, 2, 1, 0]} />
        </div>
      </>);
      default: return null;
    }
  };

  return (
    <>
      <Nav signedIn />
      <main className="mx-auto max-w-3xl px-5 py-12">
        <Link href="/learn" className="text-sm text-[#75DEFF] underline">{t("theory.back")}</Link>
        <h1 className="mt-3 text-3xl font-extrabold">{t("theory.title")}</h1>
        <p className="mt-2 text-zinc-400">{t("theory.intro")}</p>
        <div className="mt-8 space-y-5">
          {THEORY_LESSONS.map((lesson, index) => {
            const locked = lesson.pro && !isPro;
            return (
              <section key={lesson.id} className="rounded-2xl border border-[#3B3155] bg-[#241D3A] p-6" aria-labelledby={`theory-${lesson.id}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#B89CFF]">
                  {t("learn.lessonLabel", { n: index + 1, minutes: lesson.minutes })}
                  {lesson.pro && <span className="ml-2 rounded bg-[#B89CFF] px-1.5 py-0.5 text-[#19152B]">Pro</span>}
                </p>
                <h2 id={`theory-${lesson.id}`} className="mt-1 text-xl font-bold">{lesson.title[locale]}</h2>
                <p className="mt-1 text-sm text-zinc-400">{lesson.goal[locale]}</p>
                {locked ? (
                  <div className="mt-4 rounded-lg border border-[#B89CFF] p-4 text-sm text-zinc-300">
                    <p>{t("theory.locked")}</p>
                    <Link href="/dashboard" className="mt-3 inline-block rounded-lg bg-[#B89CFF] px-4 py-2 font-bold text-[#19152B] hover:bg-[#D0BCFF]">{t("home.seePlan")}</Link>
                  </div>
                ) : (
                  <>
                    <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-zinc-200">
                      {lesson.points.map((point, i) => <li key={i}>{point[locale]}</li>)}
                    </ul>
                    {visual(lesson.id)}
                    <p className="mt-4 text-sm text-[#4FE3C1]">{t("learn.tryIt")}: {lesson.tryIt[locale]}</p>
                  </>
                )}
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
}
